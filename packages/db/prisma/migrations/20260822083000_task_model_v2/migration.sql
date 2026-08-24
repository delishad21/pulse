-- Task model v2: scheduled windows, canonical multi-reminders, no sections.
ALTER TABLE "Task" ADD COLUMN "startAt" TIMESTAMPTZ(3), ADD COLUMN "endAt" TIMESTAMPTZ(3);

-- Some pre-v2 installs were created before Reminder soft-delete/update columns were stabilized.
ALTER TABLE "Reminder" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Reminder" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMPTZ(3);

INSERT INTO "Reminder" ("id", "userId", "taskId", "remindAt", "channel", "status", "createdAt", "updatedAt")
SELECT 'legacy_' || md5("id" || "reminderAt"::text), "userId", "id", "reminderAt", 'hermes_telegram', 'pending', NOW(), NOW()
FROM "Task"
WHERE "reminderAt" IS NOT NULL;

DROP INDEX IF EXISTS "Task_userId_projectId_sectionId_sortOrder_idx";
ALTER TABLE "Task" DROP CONSTRAINT IF EXISTS "Task_sectionId_fkey";
ALTER TABLE "Task" DROP COLUMN "sectionId", DROP COLUMN "reminderAt";
DROP TABLE IF EXISTS "Section";
CREATE INDEX "Task_userId_projectId_sortOrder_idx" ON "Task"("userId", "projectId", "sortOrder");

ALTER TABLE "Reminder" ALTER COLUMN "channel" SET DEFAULT 'hermes_telegram';
