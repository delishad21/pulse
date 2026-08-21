import { buildApp } from "../src/server.js";
import { createMemoryRepository } from "../src/repositories/memory.js";
import { clearRepository } from "../src/repositories/registry.js";

const port = Number(process.env.PORT ?? 4010);
const user = { id: "e2e_user", email: "e2e@pulse.local", name: "E2E User", timezone: "Asia/Singapore" };
const app = await buildApp({ repository: createMemoryRepository(user.id), defaultUser: user });
await app.listen({ port, host: "127.0.0.1" });
console.log(`Pulse E2E API listening on http://127.0.0.1:${port}`);

const close = async () => {
  await app.close();
  clearRepository();
  process.exit(0);
};
process.on("SIGTERM", close);
process.on("SIGINT", close);
