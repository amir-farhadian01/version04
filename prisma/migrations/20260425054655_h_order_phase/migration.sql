-- CreateEnum
CREATE TYPE "OrderPhase" AS ENUM ('offer', 'order', 'job');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "phase" "OrderPhase";

-- CreateIndex
CREATE INDEX "Order_phase_idx" ON "Order"("phase");
