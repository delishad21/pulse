import { defineConfig } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../..");

export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  fullyParallel: false,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3010",
    channel: "chrome",
    headless: true,
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "npm exec -w @pulse/api -- tsx tests/e2e-server.ts",
      cwd: repoRoot,
      port: 4010,
      env: { ...process.env, PORT: "4010", DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5433/pulse", PULSE_WEB_TOKEN: "e2e-web-token" },
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: "npm run dev -w @pulse/web -- --hostname 127.0.0.1 --port 3010",
      cwd: repoRoot,
      port: 3010,
      env: { ...process.env, PULSE_API_INTERNAL_URL: "http://127.0.0.1:4010", DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5433/pulse", PULSE_WEB_TOKEN: "e2e-web-token", AUTH_SECRET: "test-only-auth-secret-for-pulse-e2e", AUTH_URL: "http://127.0.0.1:3010", PULSE_REGISTRATION_ENABLED: "true" },
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
