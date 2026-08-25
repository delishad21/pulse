import crypto from "node:crypto";
import nodemailer from "nodemailer";

export interface ReminderMessageInput {
  title: string;
  description?: string | null;
  project?: string | null;
  priority?: string | null;
  dueDate?: string | null;
  dueAt?: Date | null;
  remindAt: Date;
  timezone: string;
}

export interface MessageOptions {
  style: "compact" | "detailed";
  includeDescription: boolean;
  includeProject: boolean;
  includePriority: boolean;
  includeDue: boolean;
}

function formatInstant(value: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-SG", { timeZone: timezone, dateStyle: "medium", timeStyle: "short" }).format(value);
}

export function formatReminderMessage(input: ReminderMessageInput, options: MessageOptions): string {
  const lines = [`🔔 ${input.title}`];
  if (options.style === "detailed") {
    if (options.includeDescription && input.description) lines.push(input.description);
    if (options.includeProject && input.project) lines.push(`Project: ${input.project}`);
    if (options.includePriority && input.priority && input.priority !== "NONE") lines.push(`Priority: ${input.priority.toLowerCase()}`);
    if (options.includeDue && input.dueAt) lines.push(`Due: ${formatInstant(input.dueAt, input.timezone)}`);
    else if (options.includeDue && input.dueDate) lines.push(`Due: ${input.dueDate}`);
  }
  lines.push(`Reminder: ${formatInstant(input.remindAt, input.timezone)}`);
  return lines.join("\n");
}

export async function sendHermes(input: { url: string; secret: string; message: string; deliveryId: string; timeoutSeconds: number }): Promise<{ externalId: string }> {
  const body = JSON.stringify({ message: input.message, deliveryId: input.deliveryId });
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = crypto.createHmac("sha256", input.secret).update(`${timestamp}.${body}`).digest("hex");
  const response = await fetch(input.url, {
    method: "POST",
    headers: { "content-type": "application/json", "x-webhook-timestamp": timestamp, "x-webhook-signature-v2": signature, "x-request-id": input.deliveryId },
    body,
    signal: AbortSignal.timeout(input.timeoutSeconds * 1000),
  });
  const result = await response.json().catch(() => ({})) as { status?: string; delivery_id?: string; error?: string };
  if (!response.ok || result.status !== "delivered") throw new Error(result.error || `Hermes returned ${response.status}`);
  return { externalId: result.delivery_id || input.deliveryId };
}

export async function sendTelegram(input: { token: string; chatId: string; threadId?: string | null; message: string; silent?: boolean; publicUrl?: string }): Promise<{ externalId: string }> {
  const replyMarkup = input.publicUrl ? { inline_keyboard: [[{ text: "Open Pulse", url: input.publicUrl }]] } : undefined;
  const response = await fetch(`https://api.telegram.org/bot${input.token}/sendMessage`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: input.chatId, message_thread_id: input.threadId ? Number(input.threadId) : undefined, text: input.message, disable_notification: Boolean(input.silent), reply_markup: replyMarkup }),
    signal: AbortSignal.timeout(15000),
  });
  const result = await response.json().catch(() => ({})) as { ok?: boolean; result?: { message_id?: number }; description?: string };
  if (!response.ok || !result.ok) throw new Error(result.description || `Telegram returned ${response.status}`);
  return { externalId: String(result.result?.message_id ?? "unknown") };
}

export async function sendEmail(input: { to: string; subject: string; message: string }): Promise<{ externalId: string }> {
  const host = process.env.SMTP_HOST; const from = process.env.SMTP_FROM;
  if (!host || !from) throw new Error("Email delivery is not configured");
  const transport = nodemailer.createTransport({
    host, port: Number(process.env.SMTP_PORT ?? 587), secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD ?? "" } : undefined,
  });
  const result = await transport.sendMail({ from, to: input.to, subject: input.subject, text: input.message });
  return { externalId: result.messageId };
}

export async function sendExpoPush(input: { tokens: string[]; title: string; message: string; silent?: boolean; taskId: string }): Promise<{ externalId: string }> {
  if (input.tokens.length === 0) throw new Error("No registered phone is available for push delivery");
  const response = await fetch(process.env.EXPO_PUSH_URL ?? "https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "content-type": "application/json", "accept": "application/json", ...(process.env.EXPO_ACCESS_TOKEN ? { authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` } : {}) },
    body: JSON.stringify(input.tokens.map((to) => ({ to, title: input.title, body: input.message, sound: input.silent ? null : "default", data: { taskId: input.taskId }, channelId: "reminders" }))),
    signal: AbortSignal.timeout(15000),
  });
  const result = await response.json().catch(() => ({})) as { data?: Array<{ status?: string; id?: string; message?: string }>; errors?: Array<{ message?: string }> };
  const tickets = result.data ?? [];
  const failed = tickets.find((ticket) => ticket.status !== "ok");
  if (!response.ok || result.errors?.length || tickets.length !== input.tokens.length || failed) throw new Error(failed?.message || result.errors?.[0]?.message || `Expo Push returned ${response.status}`);
  return { externalId: tickets.map((ticket) => ticket.id).filter(Boolean).join(",") || "accepted" };
}

export function isQuietTime(now: Date, timezone: string, start: string, end: string): boolean {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  const current = hour * 60 + minute;
  const parse = (value: string) => { const [h, m] = value.split(":").map(Number); return h * 60 + m; };
  const from = parse(start), to = parse(end);
  return from === to ? true : from < to ? current >= from && current < to : current >= from || current < to;
}
