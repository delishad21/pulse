ALTER TABLE "Reminder"
  ADD COLUMN "claimToken" TEXT,
  ADD COLUMN "claimedAt" TIMESTAMPTZ(3),
  ADD COLUMN "nextAttemptAt" TIMESTAMPTZ(3),
  ADD COLUMN "attemptCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "deliveredAt" TIMESTAMPTZ(3),
  ADD COLUMN "lastError" TEXT;

CREATE TABLE "NotificationPreference" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "hermesEnabled" BOOLEAN NOT NULL DEFAULT true,
  "fallbackEnabled" BOOLEAN NOT NULL DEFAULT true,
  "fallbackAfterSeconds" INTEGER NOT NULL DEFAULT 15,
  "emailEnabled" BOOLEAN NOT NULL DEFAULT false,
  "emailAddress" TEXT,
  "pushEnabled" BOOLEAN NOT NULL DEFAULT false,
  "quietHoursEnabled" BOOLEAN NOT NULL DEFAULT false,
  "quietStart" TEXT NOT NULL DEFAULT '22:00',
  "quietEnd" TEXT NOT NULL DEFAULT '07:00',
  "quietMode" TEXT NOT NULL DEFAULT 'delay',
  "includeDescription" BOOLEAN NOT NULL DEFAULT true,
  "includeProject" BOOLEAN NOT NULL DEFAULT true,
  "includeDue" BOOLEAN NOT NULL DEFAULT true,
  "includePriority" BOOLEAN NOT NULL DEFAULT true,
  "deliveryStyle" TEXT NOT NULL DEFAULT 'detailed',
  "defaultLeadMinutes" JSONB NOT NULL DEFAULT '[0,10,60]',
  "snoozeMinutes" JSONB NOT NULL DEFAULT '[10,60]',
  "telegramChatId" TEXT,
  "telegramThreadId" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PushDevice" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "platform" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "lastSeenAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "PushDevice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReminderDelivery" (
  "id" TEXT NOT NULL,
  "reminderId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "externalId" TEXT,
  "error" TEXT,
  "attemptedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReminderDelivery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NotificationPreference_userId_key" ON "NotificationPreference"("userId");
CREATE UNIQUE INDEX "PushDevice_token_key" ON "PushDevice"("token");
CREATE INDEX "PushDevice_userId_active_lastSeenAt_idx" ON "PushDevice"("userId", "active", "lastSeenAt");
CREATE INDEX "ReminderDelivery_reminderId_attemptedAt_idx" ON "ReminderDelivery"("reminderId", "attemptedAt");
CREATE INDEX "ReminderDelivery_userId_attemptedAt_idx" ON "ReminderDelivery"("userId", "attemptedAt");
CREATE INDEX "Reminder_dispatch_idx" ON "Reminder"("status", "remindAt", "nextAttemptAt", "deletedAt");
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PushDevice" ADD CONSTRAINT "PushDevice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReminderDelivery" ADD CONSTRAINT "ReminderDelivery_reminderId_fkey" FOREIGN KEY ("reminderId") REFERENCES "Reminder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReminderDelivery" ADD CONSTRAINT "ReminderDelivery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
