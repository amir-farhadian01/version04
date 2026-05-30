-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('pending', 'expired', 'converted', 'cancelled');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('scheduled', 'in_progress', 'completed', 'disputed', 'cancelled');

-- AlterEnum
ALTER TYPE "OrderStatus" ADD VALUE 'disputed';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "broadcastList" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Note: Existing rows may already be in Order.phase='job' without a matching JobRecord.
-- Backfill is intentionally deferred to seed/backfill scripts (no auto-create in migration).

-- CreateTable
CREATE TABLE "JobRecord" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'scheduled',
    "scheduledStartAt" TIMESTAMP(3),
    "actualStartAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "providerNotes" TEXT,
    "completionPhotos" JSONB,
    "responseTimeMinutes" INTEGER,
    "priceDelta" DOUBLE PRECISION,
    "customerRating" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dispute" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Dispute_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JobRecord_orderId_key" ON "JobRecord"("orderId");

-- CreateIndex
CREATE INDEX "JobRecord_orderId_idx" ON "JobRecord"("orderId");

-- CreateIndex
CREATE INDEX "JobRecord_status_idx" ON "JobRecord"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Dispute_orderId_key" ON "Dispute"("orderId");

-- CreateIndex
CREATE INDEX "Dispute_customerId_idx" ON "Dispute"("customerId");

-- AddForeignKey
ALTER TABLE "JobRecord" ADD CONSTRAINT "JobRecord_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
