ALTER TABLE "User" ADD COLUMN "username" TEXT;

UPDATE "User"
SET "username" = CASE
  WHEN "email" = 'pulse@local' THEN 'pulse-local'
  ELSE 'user-' || "id"
END
WHERE "username" IS NULL;

ALTER TABLE "User" ALTER COLUMN "username" SET NOT NULL;
ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL;
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
