import crypto from "node:crypto";
import { prisma } from "@pulse/db";
import { formatReminderMessage, isQuietTime, sendEmail, sendExpoPush, sendHermes, sendTelegram } from "./delivery.js";

const batchSize = Number(process.env.REMINDER_BATCH_SIZE ?? 20);
const maxAttempts = Number(process.env.REMINDER_MAX_ATTEMPTS ?? 8);

async function claimDue(now: Date) {
  const candidates = await prisma.reminder.findMany({
    where: {
      deletedAt: null, remindAt: { lte: now }, status: { in: ["pending", "retrying", "processing"] },
      OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
      AND: [{ OR: [{ claimedAt: null }, { claimedAt: { lt: new Date(now.getTime() - 5 * 60_000) } }] }],
      task: { status: "OPEN", deletedAt: null }, user: { notificationPreference: { is: { enabled: true } } },
    },
    include: { deliveries: { where: { status: "delivered" } }, task: { include: { project: true } }, user: { include: { notificationPreference: true, pushDevices: { where: { active: true } } } } },
    orderBy: { remindAt: "asc" }, take: batchSize,
  });
  const claimed = [];
  for (const reminder of candidates) {
    const claimToken = crypto.randomUUID();
    const result = await prisma.reminder.updateMany({
      where: { id: reminder.id, OR: [{ claimedAt: null }, { claimedAt: { lt: new Date(now.getTime() - 5 * 60_000) } }] },
      data: { status: "processing", claimedAt: now, claimToken, attemptCount: { increment: 1 } },
    });
    if (result.count === 1) claimed.push({ ...reminder, claimToken, attemptCount: reminder.attemptCount + 1 });
  }
  return claimed;
}

async function record(reminder: { id: string; userId: string }, channel: string, status: string, externalId?: string, error?: string) {
  await prisma.reminderDelivery.create({ data: { reminderId: reminder.id, userId: reminder.userId, channel, status, externalId, error: error?.slice(0, 2000) } });
}

async function finish(reminderId: string, claimToken: string, externalChannel: string) {
  await prisma.reminder.updateMany({ where: { id: reminderId, claimToken }, data: { status: "sent", deliveredAt: new Date(), claimToken: null, claimedAt: null, nextAttemptAt: null, lastError: null, channel: externalChannel } });
}

async function retry(reminder: { id: string; claimToken: string; attemptCount: number }, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const terminal = reminder.attemptCount >= maxAttempts;
  const delay = Math.min(60, 2 ** Math.min(reminder.attemptCount, 6));
  await prisma.reminder.updateMany({ where: { id: reminder.id, claimToken: reminder.claimToken }, data: { status: terminal ? "failed" : "retrying", claimToken: null, claimedAt: null, nextAttemptAt: terminal ? null : new Date(Date.now() + delay * 60_000), lastError: message.slice(0, 2000) } });
}

export async function processDueReminders(now = new Date()): Promise<number> {
  const reminders = await claimDue(now);
  for (const reminder of reminders) {
    const preference = reminder.user.notificationPreference!;
    try {
      const quiet = preference.quietHoursEnabled && isQuietTime(now, reminder.user.timezone, preference.quietStart, preference.quietEnd);
      if (quiet && preference.quietMode === "delay") {
        await prisma.reminder.updateMany({ where: { id: reminder.id, claimToken: reminder.claimToken }, data: { status: "pending", claimToken: null, claimedAt: null, nextAttemptAt: new Date(now.getTime() + 15 * 60_000), attemptCount: { decrement: 1 } } });
        continue;
      }
      const message = formatReminderMessage({ title: reminder.task.title, description: reminder.task.description, project: reminder.task.project?.name, priority: reminder.task.priority, dueDate: reminder.task.dueDate?.toISOString().slice(0, 10), dueAt: reminder.task.dueAt, remindAt: reminder.remindAt, timezone: reminder.user.timezone }, {
        style: preference.deliveryStyle as "compact" | "detailed", includeDescription: preference.includeDescription,
        includeProject: preference.includeProject, includePriority: preference.includePriority, includeDue: preference.includeDue,
      });
      const deliveredChannels = new Set(reminder.deliveries.map((delivery) => delivery.channel));
      const errors: unknown[] = [];
      const telegramEnabled = preference.hermesEnabled || preference.fallbackEnabled;
      if (telegramEnabled && !deliveredChannels.has("hermes_telegram") && !deliveredChannels.has("telegram_fallback")) {
        let primaryError: unknown = null;
        if (preference.hermesEnabled && process.env.HERMES_REMINDER_WEBHOOK_URL && process.env.HERMES_REMINDER_WEBHOOK_SECRET) {
          try {
            const sent = await sendHermes({ url: process.env.HERMES_REMINDER_WEBHOOK_URL, secret: process.env.HERMES_REMINDER_WEBHOOK_SECRET, message, deliveryId: reminder.id, timeoutSeconds: preference.fallbackAfterSeconds });
            await record(reminder, "hermes_telegram", "delivered", sent.externalId); deliveredChannels.add("hermes_telegram");
          } catch (error) { primaryError = error; await record(reminder, "hermes_telegram", "failed", undefined, error instanceof Error ? error.message : String(error)); }
        }
        if (!deliveredChannels.has("hermes_telegram") && preference.fallbackEnabled && process.env.TELEGRAM_FALLBACK_BOT_TOKEN) {
          try {
            const chatId = preference.telegramChatId || process.env.TELEGRAM_REMINDER_CHAT_ID;
            const threadId = preference.telegramThreadId || process.env.TELEGRAM_REMINDER_THREAD_ID;
            if (!chatId) throw new Error("Fallback Telegram chat is not configured");
            const sent = await sendTelegram({ token: process.env.TELEGRAM_FALLBACK_BOT_TOKEN, chatId, threadId, message, silent: quiet && preference.quietMode === "silent", publicUrl: process.env.PULSE_PUBLIC_URL });
            await record(reminder, "telegram_fallback", "delivered", sent.externalId); deliveredChannels.add("telegram_fallback");
          } catch (error) { errors.push(error); await record(reminder, "telegram_fallback", "failed", undefined, error instanceof Error ? error.message : String(error)); }
        }
        if (!deliveredChannels.has("hermes_telegram") && !deliveredChannels.has("telegram_fallback")) errors.push(primaryError || new Error("No Telegram reminder delivery channel is configured"));
      }
      if (preference.emailEnabled && !deliveredChannels.has("email")) {
        try {
          const to = preference.emailAddress || reminder.user.email; if (!to) throw new Error("No reminder email address is configured");
          const sent = await sendEmail({ to, subject: `Pulse reminder: ${reminder.task.title}`, message });
          await record(reminder, "email", "delivered", sent.externalId); deliveredChannels.add("email");
        } catch (error) { errors.push(error); await record(reminder, "email", "failed", undefined, error instanceof Error ? error.message : String(error)); }
      }
      if (preference.pushEnabled && !deliveredChannels.has("mobile_push")) {
        try {
          const sent = await sendExpoPush({ tokens: reminder.user.pushDevices.map((device) => device.token), title: reminder.task.title, message, silent: quiet && preference.quietMode === "silent", taskId: reminder.task.id });
          await record(reminder, "mobile_push", "delivered", sent.externalId); deliveredChannels.add("mobile_push");
        } catch (error) { errors.push(error); await record(reminder, "mobile_push", "failed", undefined, error instanceof Error ? error.message : String(error)); }
      }
      if (!telegramEnabled && !preference.emailEnabled && !preference.pushEnabled) throw new Error("No reminder delivery channel is enabled");
      if (errors.length) throw errors[0];
      const finalChannel = ["hermes_telegram", "telegram_fallback", "email", "mobile_push"].filter((channel) => deliveredChannels.has(channel)).join(",");
      await finish(reminder.id, reminder.claimToken, finalChannel);
    } catch (error) { await retry(reminder, error); }
  }
  return reminders.length;
}
