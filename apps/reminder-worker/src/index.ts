import "dotenv/config";
import { writeFile } from "node:fs/promises";
import { prisma } from "@pulse/db";
import { processDueReminders } from "./worker.js";
import { processWidgetSyncSignals } from "./widget-sync.js";

const intervalMs = Math.max(1000, Number(process.env.REMINDER_POLL_INTERVAL_MS ?? 5000));
// Touched after every successful cycle so the container healthcheck can spot a stalled worker.
const heartbeatFile = process.env.REMINDER_HEARTBEAT_FILE;
let stopping = false;

async function run() {
  console.log(`Pulse reminder worker started; interval=${intervalMs}ms`);
  while (!stopping) {
    try {
      await processDueReminders();
      // A failing widget push must not stall reminders (or the heartbeat).
      await processWidgetSyncSignals(prisma).catch((error) => console.error("Widget sync cycle failed", error));
      if (heartbeatFile) await writeFile(heartbeatFile, new Date().toISOString());
    } catch (error) { console.error("Reminder worker cycle failed", error); }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  await prisma.$disconnect();
}

process.on("SIGTERM", () => { stopping = true; });
process.on("SIGINT", () => { stopping = true; });
run().catch((error) => { console.error("Reminder worker failed", error); process.exit(1); });
