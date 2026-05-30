-- AlterTable: Add budget fields to Order
ALTER TABLE "Order" ADD COLUMN     "budget_min" INTEGER,
ADD COLUMN     "budget_max" INTEGER;
