-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('scheduled', 'in_progress', 'completed', 'cancelled');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "completed_sessions" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "is_multi_session" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "total_sessions" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "order_sessions" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "sessionIndex" INTEGER NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'scheduled',
    "scheduledAt" TIMESTAMP(3),
    "actualStartAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "durationMinutes" INTEGER,
    "providerNotes" TEXT,
    "completionPhotos" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "order_sessions_orderId_idx" ON "order_sessions"("orderId");

-- CreateIndex
CREATE INDEX "order_sessions_status_idx" ON "order_sessions"("status");

-- AddForeignKey
ALTER TABLE "order_sessions" ADD CONSTRAINT "order_sessions_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
