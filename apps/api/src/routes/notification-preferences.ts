import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { getUser } from "../lib/auth.js";
import { parseBody } from "../lib/validation.js";
import * as service from "../services/notification-preference-service.js";

const Time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const MinuteList = z.array(z.number().int().min(0).max(10080)).max(8);
const Update = z.object({
  enabled: z.boolean().optional(), hermesEnabled: z.boolean().optional(), fallbackEnabled: z.boolean().optional(),
  fallbackAfterSeconds: z.number().int().min(3).max(120).optional(), quietHoursEnabled: z.boolean().optional(),
  emailEnabled: z.boolean().optional(), emailAddress: z.string().email().max(320).nullable().optional(), pushEnabled: z.boolean().optional(),
  quietStart: Time.optional(), quietEnd: Time.optional(), quietMode: z.enum(["delay", "silent", "send"]).optional(),
  includeDescription: z.boolean().optional(), includeProject: z.boolean().optional(), includeDue: z.boolean().optional(),
  includePriority: z.boolean().optional(), deliveryStyle: z.enum(["compact", "detailed"]).optional(),
  defaultLeadMinutes: MinuteList.optional(), snoozeMinutes: MinuteList.optional(),
  telegramChatId: z.string().max(100).nullable().optional(), telegramThreadId: z.string().max(100).nullable().optional(),
}).strict();

export default async function routes(app: FastifyInstance) {
  app.get("/", async (request, reply) => reply.send(await service.getPreferences(getUser(request).id)));
  app.patch("/", async (request, reply) => reply.send(await service.updatePreferences(getUser(request).id, parseBody(Update, request.body))));
}
