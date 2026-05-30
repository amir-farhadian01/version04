-- CreateEnum
CREATE TYPE "OrderUrgency" AS ENUM ('standard', 'urgent', 'emergency');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "urgency" "OrderUrgency" DEFAULT 'standard';
