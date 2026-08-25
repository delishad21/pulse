import "dotenv/config";
import Fastify from "fastify";
import { setRepository } from "./repositories/registry.js";
import { registerAuth, type AuthOptions } from "./lib/auth.js";
import { registerErrorHandler } from "./lib/errors.js";
import { registerRoutes } from "./routes/index.js";
import { resolveApiKey } from "./services/api-key-service.js";
import type { PulseRepository } from "./repositories/types.js";

export interface ServerOptions {
  repository?: PulseRepository;
  port?: number;
  defaultUser?: { id: string; username: string; name: string | null; timezone: string };
  auth?: AuthOptions;
}

export async function ensureDefaultUser(): Promise<{ id: string; username: string; name: string | null; timezone: string }> {
  const { prisma } = await import("@pulse/db");
  const username = process.env.PULSE_DEFAULT_USERNAME ?? "pulse";
  const name = process.env.PULSE_DEFAULT_USER_NAME ?? "Pulse User";
  const timezone = process.env.PULSE_DEFAULT_TIMEZONE ?? "UTC";
  let user = await prisma.user.findUnique({ where: { username } });

  if (!user) {
    const legacyEmail = process.env.PULSE_LEGACY_DEFAULT_USER_EMAIL;
    const legacy = legacyEmail ? await prisma.user.findUnique({ where: { email: legacyEmail } }) : null;
    user = legacy
      ? await prisma.user.update({ where: { id: legacy.id }, data: { username, email: null, name, timezone } })
      : await prisma.user.create({ data: { username, name, timezone } });
  } else if (user.name !== name || user.timezone !== timezone) {
    user = await prisma.user.update({ where: { id: user.id }, data: { name, timezone } });
  }
  return { id: user.id, username: user.username, name: user.name, timezone: user.timezone };
}

export async function buildApp(options: ServerOptions = {}) {
  const app = Fastify({ logger: false });

  const defaultUser = options.defaultUser ?? (await ensureDefaultUser());
  const repository = options.repository ?? (await import("./repositories/prisma.js")).prismaRepository;
  setRepository(repository);

  await registerAuth(app, defaultUser, options.auth ?? {
    webToken: process.env.PULSE_WEB_TOKEN,
    serviceToken: process.env.PULSE_SERVICE_TOKEN,
    resolveUser: async (id) => {
      const { prisma } = await import("@pulse/db");
      const user = await prisma.user.findUnique({ where: { id } });
      return user ? { id: user.id, username: user.username, name: user.name, timezone: user.timezone } : null;
    },
    resolveApiKey,
  });
  await registerErrorHandler(app);
  await registerRoutes(app);

  return app;
}

export async function startServer(options: ServerOptions = {}) {
  const app = await buildApp(options);
  const port = options.port ?? Number(process.env.PORT ?? 4000);
  await app.listen({ port, host: "0.0.0.0" });
  console.log(`Pulse API listening on http://localhost:${port}`);
  return app;
}

async function main() {
  const app = await startServer();

  process.on("SIGTERM", async () => {
    await app.close();
    const { prisma } = await import("@pulse/db");
    await prisma.$disconnect();
  });

  return app;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error("Failed to start server:", error);
    process.exit(1);
  });
}
