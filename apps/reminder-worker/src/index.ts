import "dotenv/config";
import { prisma } from "@pulse/db";
import { processDueReminders } from "./worker.js";

const intervalMs = Math.max(1000, Number(process.env.REMINDER_POLL_INTERVAL_MS ?? 5000));
let stopping = false;

async function run() {
  console.log(`Pulse reminder worker started; interval=${intervalMs}ms`);
  while (!stopping) {
    try { await processDueReminders(); } catch (error) { console.error("Reminder worker cycle failed", error); }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  await prisma.$disconnect();
}

process.on("SIGTERM", () => { stopping = true; });
process.on("SIGINT", () => { stopping = true; });
run().catch((error) => { console.error("Reminder worker failed", error); process.exit(1); });
