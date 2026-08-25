import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { getUser } from "../lib/auth.js";
import { parseBody } from "../lib/validation.js";

const Device = z.object({
  token: z.string().regex(/^ExponentPushToken\[[A-Za-z0-9_-]+\]$|^ExpoPushToken\[[A-Za-z0-9_-]+\]$/).max(256),
  platform: z.enum(["ios", "android"]),
}).strict();

export default async function routes(app: FastifyInstance) {
  app.post("/", async (request, reply) => {
    const user = getUser(request); const input = parseBody<{ token: string; platform: "ios" | "android" }>(Device, request.body); const { prisma } = await import("@pulse/db");
    await prisma.pushDevice.upsert({ where: { token: input.token }, create: { userId: user.id, ...input }, update: { userId: user.id, platform: input.platform, active: true, lastSeenAt: new Date() } });
    return reply.code(204).send();
  });
  app.delete("/", async (request, reply) => {
    const user = getUser(request); const input = parseBody<{ token: string }>(Device.pick({ token: true }), request.body); const { prisma } = await import("@pulse/db");
    await prisma.pushDevice.updateMany({ where: { userId: user.id, token: input.token }, data: { active: false } });
    return reply.code(204).send();
  });
}
