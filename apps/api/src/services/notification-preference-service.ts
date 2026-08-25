import type { NotificationPreferences, UpdateNotificationPreferences } from "@pulse/api-client";

const defaults = {
  enabled: false, hermesEnabled: true, fallbackEnabled: true, fallbackAfterSeconds: 15,
  emailEnabled: false, emailAddress: null, pushEnabled: false,
  quietHoursEnabled: false, quietStart: "22:00", quietEnd: "07:00", quietMode: "delay",
  includeDescription: true, includeProject: true, includeDue: true, includePriority: true,
  deliveryStyle: "detailed", defaultLeadMinutes: [0, 10, 60], snoozeMinutes: [10, 60],
  telegramChatId: null, telegramThreadId: null,
} as const;

function present(row: Record<string, unknown>): NotificationPreferences {
  return {
    enabled: Boolean(row.enabled), hermesEnabled: Boolean(row.hermesEnabled), fallbackEnabled: Boolean(row.fallbackEnabled),
    fallbackAfterSeconds: Number(row.fallbackAfterSeconds), quietHoursEnabled: Boolean(row.quietHoursEnabled),
    emailEnabled: Boolean(row.emailEnabled), emailAddress: row.emailAddress ? String(row.emailAddress) : null, pushEnabled: Boolean(row.pushEnabled),
    quietStart: String(row.quietStart), quietEnd: String(row.quietEnd), quietMode: row.quietMode as NotificationPreferences["quietMode"],
    includeDescription: Boolean(row.includeDescription), includeProject: Boolean(row.includeProject), includeDue: Boolean(row.includeDue),
    includePriority: Boolean(row.includePriority), deliveryStyle: row.deliveryStyle as NotificationPreferences["deliveryStyle"],
    defaultLeadMinutes: row.defaultLeadMinutes as number[], snoozeMinutes: row.snoozeMinutes as number[],
    telegramChatId: row.telegramChatId ? String(row.telegramChatId) : null,
    telegramThreadId: row.telegramThreadId ? String(row.telegramThreadId) : null,
    hermesConfigured: Boolean(process.env.HERMES_REMINDER_WEBHOOK_URL && process.env.HERMES_REMINDER_WEBHOOK_SECRET),
    fallbackConfigured: Boolean(process.env.TELEGRAM_FALLBACK_BOT_TOKEN),
    emailConfigured: Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM),
    pushConfigured: true,
    registeredPushDevices: Number(row.registeredPushDevices ?? 0),
  };
}

export async function getPreferences(userId: string): Promise<NotificationPreferences> {
  const { prisma } = await import("@pulse/db");
  const [row, registeredPushDevices] = await Promise.all([
    prisma.notificationPreference.upsert({ where: { userId }, create: { userId, ...defaults }, update: {} }),
    prisma.pushDevice.count({ where: { userId, active: true } }),
  ]);
  return present({ ...(row as unknown as Record<string, unknown>), registeredPushDevices });
}

export async function updatePreferences(userId: string, input: Partial<UpdateNotificationPreferences>): Promise<NotificationPreferences> {
  const { prisma } = await import("@pulse/db");
  const row = await prisma.notificationPreference.upsert({ where: { userId }, create: { userId, ...defaults, ...input }, update: input });
  const registeredPushDevices = await prisma.pushDevice.count({ where: { userId, active: true } });
  return present({ ...(row as unknown as Record<string, unknown>), registeredPushDevices });
}
