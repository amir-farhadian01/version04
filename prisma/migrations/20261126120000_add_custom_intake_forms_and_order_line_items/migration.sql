-- CreateEnum
CREATE TYPE "FormFieldType" AS ENUM ('text', 'number', 'date', 'single_select', 'multi_select', 'file_upload');

-- CreateEnum
CREATE TYPE "BaseOrderStatus" AS ENUM ('Draft', 'Submitted', 'InReview', 'Accepted', 'InProgress', 'Completed', 'Cancelled');

-- CreateEnum
CREATE TYPE "OrderKind" AS ENUM ('service_request', 'goods_purchase', 'package_purchase', 'custom_bundle', 'mixed_order');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "current_stage_id" TEXT,
ADD COLUMN     "intake_answers" JSONB,
ADD COLUMN     "order_kind" "OrderKind" NOT NULL DEFAULT 'service_request',
ADD COLUMN     "overall_end_at" TIMESTAMP(3),
ADD COLUMN     "overall_start_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "custom_intake_forms" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "service_catalog_id" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_intake_forms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_fields" (
    "id" TEXT NOT NULL,
    "form_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "field_type" "FormFieldType" NOT NULL,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "placeholder" TEXT,
    "options" JSONB,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "form_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_pipeline_stages" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "base_status" "BaseOrderStatus" NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspace_pipeline_stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_line_items" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "package_id" TEXT,
    "package_snapshot" JSONB,
    "title" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_price_cents" INTEGER NOT NULL,
    "total_price_cents" INTEGER NOT NULL,
    "scheduled_start_at" TIMESTAMP(3),
    "scheduled_end_at" TIMESTAMP(3),
    "session_index" INTEGER,
    "status" "BaseOrderStatus" NOT NULL DEFAULT 'Draft',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "custom_intake_forms_workspace_id_is_active_idx" ON "custom_intake_forms"("workspace_id", "is_active");

-- CreateIndex
CREATE INDEX "form_fields_form_id_sort_order_idx" ON "form_fields"("form_id", "sort_order");

-- CreateIndex
CREATE INDEX "workspace_pipeline_stages_workspace_id_base_status_idx" ON "workspace_pipeline_stages"("workspace_id", "base_status");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_pipeline_stages_workspace_id_name_key" ON "workspace_pipeline_stages"("workspace_id", "name");

-- CreateIndex
CREATE INDEX "order_line_items_order_id_idx" ON "order_line_items"("order_id");

-- CreateIndex
CREATE INDEX "order_line_items_package_id_idx" ON "order_line_items"("package_id");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_current_stage_id_fkey" FOREIGN KEY ("current_stage_id") REFERENCES "workspace_pipeline_stages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_intake_forms" ADD CONSTRAINT "custom_intake_forms_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_intake_forms" ADD CONSTRAINT "custom_intake_forms_service_catalog_id_fkey" FOREIGN KEY ("service_catalog_id") REFERENCES "ServiceCatalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_fields" ADD CONSTRAINT "form_fields_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "custom_intake_forms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_pipeline_stages" ADD CONSTRAINT "workspace_pipeline_stages_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_line_items" ADD CONSTRAINT "order_line_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_line_items" ADD CONSTRAINT "order_line_items_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "ProviderServicePackage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
