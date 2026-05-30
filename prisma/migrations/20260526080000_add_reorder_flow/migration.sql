-- Add originalOrderId field to Order model for reorder flow
ALTER TABLE "Order" ADD COLUMN "original_order_id" TEXT UNIQUE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_original_order_id_fkey" FOREIGN KEY ("original_order_id") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
