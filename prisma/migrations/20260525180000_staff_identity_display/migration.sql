-- Staff Identity Display Feature
-- Add assignedStaffId to Order model
ALTER TABLE "Order" ADD COLUMN "assigned_staff_id" TEXT;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_assigned_staff_id_fkey" FOREIGN KEY ("assigned_staff_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add photoRequired to ProviderServicePackage
ALTER TABLE "ProviderServicePackage" ADD COLUMN "photo_required" BOOLEAN NOT NULL DEFAULT true;
