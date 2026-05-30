-- Drop the unique constraint on original_order_id to allow repeat reorders
ALTER TABLE "Order" DROP CONSTRAINT IF EXISTS "Order_original_order_id_key";