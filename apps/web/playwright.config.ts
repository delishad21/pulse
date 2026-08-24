import { defineConfig } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../..");
const e2eDatabaseUrl = process.env.PULSE_E2E_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:5433/pulse";
const webPort = Number(process.env.PULSE_E2E_WEB_PORT ?? 3010);
const apiPort = Number(process.env.PULSE_E2E_API_PORT ?? 4010);

export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  fullyParallel: false,
  reporter: "list",
  use: {
    baseURL: `http://127.0.0.1:${webPort}`,
    channel: "chrome",
    headless: true,
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "npm exec -w @pulse/api -- tsx tests/e2e-server.ts",
      cwd: repoRoot,
      port: apiPort,
      env: { ...process.env, PORT: String(apiPort), DATABASE_URL: e2eDatabaseUrl, PULSE_WEB_TOKEN: "e2e-web-token" },
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: `npm run dev -w @pulse/web -- --hostname 127.0.0.1 --port ${webPort}`,
      cwd: repoRoot,
      port: webPort,
      env: { ...process.env, PULSE_API_INTERNAL_URL: `http://127.0.0.1:${apiPort}`, DATABASE_URL: e2eDatabaseUrl, PULSE_WEB_TOKEN: "e2e-web-token", AUTH_SECRET: "test-only-auth-secret-for-pulse-e2e", AUTH_URL: `http://127.0.0.1:${webPort}`, PULSE_REGISTRATION_ENABLED: "true" },
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
