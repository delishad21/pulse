import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { getUser, requireUserSession } from "../lib/auth.js";
import { parseBody, parseParams } from "../lib/validation.js";
import * as apiKeyService from "../services/api-key-service.js";

const CreateApiKey = z.object({ name: z.string().trim().min(1).max(80) });
const ApiKeyId = z.object({ id: z.string().min(1) });

export default async function apiKeyRoutes(app: FastifyInstance): Promise<void> {
  app.get("/", async (request, reply) => {
    requireUserSession(request);
    reply.header("Cache-Control", "no-store");
    reply.send(await apiKeyService.listApiKeys(getUser(request).id));
  });

  app.post("/", async (request, reply) => {
    requireUserSession(request);
    reply.header("Cache-Control", "no-store");
    const { name } = parseBody<{ name: string }>(CreateApiKey, request.body);
    reply.status(201).send(await apiKeyService.createApiKey(getUser(request).id, name));
  });

  app.delete("/:id", async (request, reply) => {
    requireUserSession(request);
    const { id } = parseParams(ApiKeyId, request.params);
    await apiKeyService.revokeApiKey(getUser(request).id, id);
    reply.status(204).send();
  });
}
