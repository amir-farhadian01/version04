-- Drop the old case-sensitive unique constraint on displayName
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_displayName_key";

-- Add normalizedDisplayName column
ALTER TABLE "User" ADD COLUMN "normalizedDisplayName" TEXT;

-- Backfill normalizedDisplayName with lowercase of displayName
UPDATE "User" SET "normalizedDisplayName" = LOWER("displayName") WHERE "displayName" IS NOT NULL;

-- Add unique constraint on normalizedDisplayName
CREATE UNIQUE INDEX "User_normalizedDisplayName_key" ON "User"("normalizedDisplayName");
