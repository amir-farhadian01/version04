-- AlterTable
ALTER TABLE "User" ADD COLUMN "orderPriorities" JSONB;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "matchingExpiresAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "OfferMatchAttempt"
ADD COLUMN "supersededAt" TIMESTAMP(3),
ADD COLUMN "lostReason" TEXT,
ADD COLUMN "lostFeedback" JSONB;
