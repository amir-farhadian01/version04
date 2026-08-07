-- AlterTable: Add onboarding fields + Apple OAuth support
ALTER TABLE "User" ADD COLUMN "appleId" TEXT;
ALTER TABLE "User" ADD COLUMN "onboardingCompletedAt" TIMESTAMPTZ;
ALTER TABLE "User" ADD COLUMN "onboardingInterests" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateIndex
CREATE UNIQUE INDEX "User_appleId_key" ON "User"("appleId");