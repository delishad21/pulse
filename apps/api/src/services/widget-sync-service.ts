import type { FastifyInstance } from "fastify";

/** Called once per successful mutation that can change what a user's widgets show. */
export type UserDataChangeListener = (userId: string) => void | Promise<void>;

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
// Everything a widget renders: tasks (including undo/redo, which rewrites
// tasks), and the project and label names shown next to them. Comments and
// history never reach a widget.
const WIDGET_PREFIXES = ["/api/tasks", "/api/operations", "/api/projects", "/api/tags"];

export function changesWidgetData(method: string, url: string, statusCode: number): boolean {
  if (!MUTATING_METHODS.has(method.toUpperCase()) || statusCode >= 400) return false;
  const path = url.split("?")[0] ?? "";
  if (/^\/api\/tasks\/[^/]+\/(comments|history)(\/|$)/.test(path)) return false;
  return WIDGET_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

/**
 * Production listener: the API has no internet access, so it only records that
 * the user's data changed. The reminder worker debounces these per user and
 * sends the silent push that makes phones refresh their widgets.
 */
export async function recordWidgetSyncSignal(userId: string): Promise<void> {
  const { prisma } = await import("@pulse/db");
  const now = new Date();
  await prisma.widgetSyncSignal.upsert({ where: { userId }, create: { userId, firstRequestedAt: now, requestedAt: now }, update: { requestedAt: now } });
}

export function registerWidgetSyncHook(app: FastifyInstance, listener: UserDataChangeListener): void {
  app.addHook("onResponse", async (request, reply) => {
    if (!request.user || !changesWidgetData(request.method, request.url, reply.statusCode)) return;
    try { await listener(request.user.id); } catch (error) { request.log.warn({ err: error }, "unable to record widget sync signal"); }
  });
}
