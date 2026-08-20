import type { FastifyInstance } from "fastify";
import { getRepository } from "../repositories/registry.js";

export default async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/live", async (_request, reply) => {
    reply.send({ status: "ok", service: "pulse-api" });
  });

  app.get("/ready", async (_request, reply) => {
    const { database } = await getRepository().healthCheck();
    reply.status(database === "connected" ? 200 : 503).send({
      status: database === "connected" ? "ok" : "error",
      service: "pulse-api",
      database,
    });
  });
}
