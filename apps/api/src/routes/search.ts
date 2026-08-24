import { z } from "zod";
import { getUser } from "../lib/auth.js";
import * as taskService from "../services/task-service.js";
import type { FastifyInstance } from "fastify";

export default async function searchRoutes(app: FastifyInstance): Promise<void> {
  app.get("/tasks", async (request, reply) => {
    const user = getUser(request);
    const schema = z.object({ q: z.string().min(1).max(200) });
    const { q } = schema.parse(request.query);
    reply.send(await taskService.searchTasks(user.id, q));
  });
}
