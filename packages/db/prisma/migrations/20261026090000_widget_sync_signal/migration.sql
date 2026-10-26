CREATE TABLE "WidgetSyncSignal" (
  "userId" TEXT NOT NULL,
  "firstRequestedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "requestedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WidgetSyncSignal_pkey" PRIMARY KEY ("userId")
);

CREATE INDEX "WidgetSyncSignal_requestedAt_idx" ON "WidgetSyncSignal"("requestedAt");

ALTER TABLE "WidgetSyncSignal" ADD CONSTRAINT "WidgetSyncSignal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
