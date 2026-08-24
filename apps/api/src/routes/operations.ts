import { z } from "zod";
import { getUser } from "../lib/auth.js";
import { parseParams } from "../lib/validation.js";
import * as operationService from "../services/operation-service.js";
import type { FastifyInstance } from "fastify";

const IdParam = z.object({ id: z.string().cuid() });

export default async function operationRoutes(app: FastifyInstance): Promise<void> {
  app.get("/", async (request, reply) => {
    const user = getUser(request);
    reply.send(await operationService.listOperations(user.id));
  });

  app.post("/undo-last", async (request, reply) => {
    const user = getUser(request);
    reply.send(await operationService.undoLast(user.id));
  });

  app.post("/redo-last", async (request, reply) => {
    const user = getUser(request);
    reply.send(await operationService.redoLast(user.id));
  });

  app.post("/:id/undo", async (request, reply) => {
    const user = getUser(request);
    const { id } = parseParams(IdParam, request.params);
    reply.send(await operationService.undoOperation(user.id, id));
  });

  app.post("/:id/redo", async (request, reply) => {
    const user = getUser(request);
    const { id } = parseParams(IdParam, request.params);
    reply.send(await operationService.redoOperation(user.id, id));
  });
}
