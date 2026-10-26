/**
 * Silent "refresh your widgets" pushes. The API records a WidgetSyncSignal row
 * per user on every task mutation (from the web, MCP, Hermes or a phone); this
 * worker turns each user's burst of edits into a single background push once
 * the edits have gone quiet, so a bulk edit or an undo storm sends one push.
 */

export interface WidgetSyncSignalRow { userId: string; firstRequestedAt: Date; requestedAt: Date; }
export interface WidgetSyncDevice { token: string; platform: string; }
export interface WidgetSyncOptions {
  /** Send once a user has made no further change for this long. */
  quietMs: number;
  /** ...but never hold a continuously editing user back longer than this. */
  maxWaitMs: number;
  /** After a failed send, wait this long before trying that user again. */
  retryMs: number;
}

export const defaultWidgetSyncOptions: WidgetSyncOptions = {
  quietMs: Math.max(0, Number(process.env.WIDGET_SYNC_QUIET_MS ?? 4000)),
  maxWaitMs: Math.max(0, Number(process.env.WIDGET_SYNC_MAX_WAIT_MS ?? 30_000)),
  retryMs: 60_000,
};

/** Trailing debounce per user, capped by a maximum wait from the first change. */
export function isWidgetSyncDue(signal: WidgetSyncSignalRow, now: Date, options: Pick<WidgetSyncOptions, "quietMs" | "maxWaitMs">): boolean {
  const at = now.getTime();
  return at - signal.requestedAt.getTime() >= options.quietMs || at - signal.firstRequestedAt.getTime() >= options.maxWaitMs;
}

/**
 * iOS: a background (content-available) notification, which Apple requires to
 * have no alert/sound and normal (5) priority. Android: a data-only FCM message;
 * high priority so Doze delivers it promptly. Both wake the app's headless task.
 */
export function widgetSyncMessages(devices: WidgetSyncDevice[], sentAt: Date): Array<Record<string, unknown>> {
  const data = { type: "widget-sync", sentAt: sentAt.toISOString() };
  return devices.map((device) => device.platform === "ios"
    ? { to: device.token, _contentAvailable: true, priority: "normal", data }
    : { to: device.token, priority: "high", data });
}

export interface ExpoTicket { status?: string; id?: string; message?: string; details?: { error?: string } }

export async function sendExpoWidgetSync(devices: WidgetSyncDevice[], sentAt = new Date()): Promise<ExpoTicket[]> {
  const response = await fetch(process.env.EXPO_PUSH_URL ?? "https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "content-type": "application/json", "accept": "application/json", ...(process.env.EXPO_ACCESS_TOKEN ? { authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` } : {}) },
    body: JSON.stringify(widgetSyncMessages(devices, sentAt)),
    signal: AbortSignal.timeout(15000),
  });
  const result = await response.json().catch(() => ({})) as { data?: ExpoTicket[]; errors?: Array<{ message?: string }> };
  if (!response.ok || result.errors?.length || !Array.isArray(result.data)) throw new Error(result.errors?.[0]?.message || `Expo Push returned ${response.status}`);
  return result.data;
}

/** The slice of Prisma this needs, so the debounce can be tested without a database. */
export interface WidgetSyncStore {
  widgetSyncSignal: {
    findMany(args: { where: { OR: Array<Record<string, unknown>> }; orderBy: { requestedAt: "asc" }; take: number }): Promise<WidgetSyncSignalRow[]>;
    deleteMany(args: { where: { userId: string; requestedAt: Date } }): Promise<unknown>;
  };
  pushDevice: {
    findMany(args: { where: { userId: string; active: true } }): Promise<WidgetSyncDevice[]>;
    updateMany(args: { where: { token: { in: string[] } }; data: { active: false } }): Promise<unknown>;
  };
}

const retryAfter = new Map<string, number>();

export async function processWidgetSyncSignals(store: WidgetSyncStore, now = new Date(), options = defaultWidgetSyncOptions, send = sendExpoWidgetSync): Promise<number> {
  const signals = await store.widgetSyncSignal.findMany({
    where: { OR: [{ requestedAt: { lte: new Date(now.getTime() - options.quietMs) } }, { firstRequestedAt: { lte: new Date(now.getTime() - options.maxWaitMs) } }] },
    orderBy: { requestedAt: "asc" }, take: 50,
  });
  let sent = 0;
  for (const signal of signals) {
    if (!isWidgetSyncDue(signal, now, options) || (retryAfter.get(signal.userId) ?? 0) > now.getTime()) continue;
    const devices = await store.pushDevice.findMany({ where: { userId: signal.userId, active: true } });
    try {
      if (devices.length) {
        const tickets = await send(devices, now);
        const gone = devices.filter((_, index) => tickets[index]?.details?.error === "DeviceNotRegistered").map((device) => device.token);
        if (gone.length) await store.pushDevice.updateMany({ where: { token: { in: gone } }, data: { active: false } });
        sent += 1;
      }
      retryAfter.delete(signal.userId);
      // Only clear the signal we handled: a change that landed while sending
      // bumped requestedAt and gets its own push after the next quiet period.
      await store.widgetSyncSignal.deleteMany({ where: { userId: signal.userId, requestedAt: signal.requestedAt } });
    } catch (error) {
      retryAfter.set(signal.userId, now.getTime() + options.retryMs);
      console.warn(`Widget sync push for ${signal.userId} failed`, error instanceof Error ? error.message : error);
    }
  }
  return sent;
}
