-- Delivery & Driver Operations Phase 1 foundation (default off).

CREATE TYPE "SchedulePurpose" AS ENUM ('service', 'delivery');
CREATE TYPE "DriverEngagementType" AS ENUM ('hourly', 'long_term');
CREATE TYPE "BusinessDriverStatus" AS ENUM ('invited', 'active', 'paused', 'declined', 'ended');
CREATE TYPE "DriverAvailabilityMode" AS ENUM ('on_demand', 'scheduled');
CREATE TYPE "DriverPresence" AS ENUM ('available', 'offline');
CREATE TYPE "DriverCompensationTermStatus" AS ENUM ('proposed', 'accepted', 'rejected', 'superseded');
CREATE TYPE "FulfillmentProviderKind" AS ENUM ('internal_driver', 'external_carrier');
CREATE TYPE "FulfillmentStatus" AS ENUM ('unassigned', 'assigned', 'accepted', 'picked_up', 'in_transit', 'delivered', 'failed', 'cancelled', 'unable_to_deliver');
CREATE TYPE "DeliveryAssignmentStatus" AS ENUM ('offered', 'accepted', 'rejected', 'revoked', 'completed', 'failed', 'cancelled', 'unable_to_deliver');

ALTER TABLE "Company"
  ADD COLUMN "delivery_operations_enabled" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Schedule"
  ADD COLUMN "purpose" "SchedulePurpose" NOT NULL DEFAULT 'service';

CREATE TABLE "business_drivers" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "engagement_type" "DriverEngagementType" NOT NULL,
  "status" "BusinessDriverStatus" NOT NULL DEFAULT 'invited',
  "availability_mode" "DriverAvailabilityMode" NOT NULL DEFAULT 'on_demand',
  "presence" "DriverPresence" NOT NULL DEFAULT 'offline',
  "version" INTEGER NOT NULL DEFAULT 1,
  "current_accepted_term_id" TEXT,
  "invited_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "responded_at" TIMESTAMP(3),
  "activated_at" TIMESTAMP(3),
  "paused_at" TIMESTAMP(3),
  "declined_at" TIMESTAMP(3),
  "ended_at" TIMESTAMP(3),
  "archived_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "business_drivers_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "business_drivers_version_check" CHECK ("version" > 0)
);

CREATE TABLE "driver_compensation_term_versions" (
  "id" TEXT NOT NULL,
  "business_driver_id" TEXT NOT NULL,
  "version_number" INTEGER NOT NULL,
  "schema_version" INTEGER NOT NULL DEFAULT 1,
  "currency" VARCHAR(3) NOT NULL,
  "components" JSONB NOT NULL,
  "status" "DriverCompensationTermStatus" NOT NULL DEFAULT 'proposed',
  "proposed_by_id" TEXT NOT NULL,
  "accepted_by_id" TEXT,
  "proposed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "accepted_at" TIMESTAMP(3),
  "rejected_at" TIMESTAMP(3),
  "superseded_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "driver_compensation_term_versions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "driver_compensation_term_version_positive" CHECK ("version_number" > 0 AND "schema_version" > 0),
  CONSTRAINT "driver_compensation_term_currency" CHECK ("currency" ~ '^[A-Z]{3}$')
);

CREATE TABLE "fulfillments" (
  "id" TEXT NOT NULL,
  "order_id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "provider_kind" "FulfillmentProviderKind" NOT NULL DEFAULT 'internal_driver',
  "provider_key" TEXT NOT NULL DEFAULT 'internal',
  "status" "FulfillmentStatus" NOT NULL DEFAULT 'unassigned',
  "version" INTEGER NOT NULL DEFAULT 1,
  "current_assignment_id" TEXT,
  "address_schema_version" INTEGER NOT NULL DEFAULT 1,
  "pickup_address_snapshot" JSONB NOT NULL,
  "dropoff_address_snapshot" JSONB NOT NULL,
  "created_by_id" TEXT NOT NULL,
  "assigned_at" TIMESTAMP(3),
  "accepted_at" TIMESTAMP(3),
  "picked_up_at" TIMESTAMP(3),
  "in_transit_at" TIMESTAMP(3),
  "delivered_at" TIMESTAMP(3),
  "terminal_at" TIMESTAMP(3),
  "archived_at" TIMESTAMP(3),
  "archived_by_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "fulfillments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "fulfillments_version_check" CHECK ("version" > 0 AND "address_schema_version" > 0)
);

CREATE TABLE "delivery_assignments" (
  "id" TEXT NOT NULL,
  "fulfillment_id" TEXT NOT NULL,
  "business_driver_id" TEXT NOT NULL,
  "compensation_term_id" TEXT NOT NULL,
  "status" "DeliveryAssignmentStatus" NOT NULL DEFAULT 'offered',
  "version" INTEGER NOT NULL DEFAULT 1,
  "planned_start_at" TIMESTAMP(3),
  "planned_end_at" TIMESTAMP(3),
  "offered_by_id" TEXT NOT NULL,
  "responded_by_id" TEXT,
  "outcome_by_id" TEXT,
  "staff_slot_block_id" TEXT,
  "offered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "responded_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "failed_at" TIMESTAMP(3),
  "cancelled_at" TIMESTAMP(3),
  "revoked_at" TIMESTAMP(3),
  "reservation_released_at" TIMESTAMP(3),
  "reason_code" TEXT,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "delivery_assignments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "delivery_assignments_version_check" CHECK ("version" > 0),
  CONSTRAINT "delivery_assignments_planned_interval" CHECK (
    (("planned_start_at" IS NULL) = ("planned_end_at" IS NULL))
    AND ("planned_start_at" IS NULL OR "planned_start_at" < "planned_end_at")
  )
);

CREATE UNIQUE INDEX "business_drivers_company_id_user_id_key" ON "business_drivers"("company_id", "user_id");
CREATE UNIQUE INDEX "business_drivers_current_accepted_term_id_key" ON "business_drivers"("current_accepted_term_id");
CREATE INDEX "business_drivers_company_id_status_idx" ON "business_drivers"("company_id", "status");
CREATE INDEX "business_drivers_user_id_status_idx" ON "business_drivers"("user_id", "status");
CREATE UNIQUE INDEX "driver_compensation_term_versions_business_driver_id_versio_key" ON "driver_compensation_term_versions"("business_driver_id", "version_number");
CREATE INDEX "driver_compensation_term_versions_business_driver_id_status_idx" ON "driver_compensation_term_versions"("business_driver_id", "status");
CREATE UNIQUE INDEX "fulfillments_order_id_key" ON "fulfillments"("order_id");
CREATE UNIQUE INDEX "fulfillments_current_assignment_id_key" ON "fulfillments"("current_assignment_id");
CREATE INDEX "fulfillments_workspace_id_status_idx" ON "fulfillments"("workspace_id", "status");
CREATE INDEX "delivery_assignments_fulfillment_id_created_at_idx" ON "delivery_assignments"("fulfillment_id", "created_at");
CREATE INDEX "delivery_assignments_business_driver_id_status_idx" ON "delivery_assignments"("business_driver_id", "status");
CREATE UNIQUE INDEX "delivery_assignments_staff_slot_block_id_key" ON "delivery_assignments"("staff_slot_block_id");

ALTER TABLE "business_drivers" ADD CONSTRAINT "business_drivers_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "business_drivers" ADD CONSTRAINT "business_drivers_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "driver_compensation_term_versions" ADD CONSTRAINT "driver_compensation_term_versions_business_driver_id_fkey"
  FOREIGN KEY ("business_driver_id") REFERENCES "business_drivers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "driver_compensation_term_versions" ADD CONSTRAINT "driver_compensation_term_versions_proposed_by_id_fkey"
  FOREIGN KEY ("proposed_by_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "driver_compensation_term_versions" ADD CONSTRAINT "driver_compensation_term_versions_accepted_by_id_fkey"
  FOREIGN KEY ("accepted_by_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "business_drivers" ADD CONSTRAINT "business_drivers_current_accepted_term_id_fkey"
  FOREIGN KEY ("current_accepted_term_id") REFERENCES "driver_compensation_term_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "fulfillments" ADD CONSTRAINT "fulfillments_order_id_fkey"
  FOREIGN KEY ("order_id") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "fulfillments" ADD CONSTRAINT "fulfillments_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "fulfillments" ADD CONSTRAINT "fulfillments_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "fulfillments" ADD CONSTRAINT "fulfillments_archived_by_id_fkey"
  FOREIGN KEY ("archived_by_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "delivery_assignments" ADD CONSTRAINT "delivery_assignments_fulfillment_id_fkey"
  FOREIGN KEY ("fulfillment_id") REFERENCES "fulfillments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "delivery_assignments" ADD CONSTRAINT "delivery_assignments_business_driver_id_fkey"
  FOREIGN KEY ("business_driver_id") REFERENCES "business_drivers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "delivery_assignments" ADD CONSTRAINT "delivery_assignments_compensation_term_id_fkey"
  FOREIGN KEY ("compensation_term_id") REFERENCES "driver_compensation_term_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "delivery_assignments" ADD CONSTRAINT "delivery_assignments_offered_by_id_fkey"
  FOREIGN KEY ("offered_by_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "delivery_assignments" ADD CONSTRAINT "delivery_assignments_responded_by_id_fkey"
  FOREIGN KEY ("responded_by_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "delivery_assignments" ADD CONSTRAINT "delivery_assignments_outcome_by_id_fkey"
  FOREIGN KEY ("outcome_by_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "delivery_assignments" ADD CONSTRAINT "delivery_assignments_staff_slot_block_id_fkey"
  FOREIGN KEY ("staff_slot_block_id") REFERENCES "staff_slot_blocks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "fulfillments" ADD CONSTRAINT "fulfillments_current_assignment_id_fkey"
  FOREIGN KEY ("current_assignment_id") REFERENCES "delivery_assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
