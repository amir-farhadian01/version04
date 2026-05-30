-- AlterTable: Add budget field to Order (Int?, cents)
ALTER TABLE "Order" ADD COLUMN "budget" INTEGER;

-- AlterTable: Convert Quote monetary fields from Float to Int (cents)
ALTER TABLE "quotes" ALTER COLUMN "subtotal" SET DEFAULT 0,
ALTER COLUMN "subtotal" SET DATA TYPE INTEGER USING (subtotal::integer),
ALTER COLUMN "tax" SET DEFAULT 0,
ALTER COLUMN "tax" SET DATA TYPE INTEGER USING (tax::integer),
ALTER COLUMN "total" SET DEFAULT 0,
ALTER COLUMN "total" SET DATA TYPE INTEGER USING (total::integer);
