-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED');

-- AlterTable: Add postId to Order
ALTER TABLE "Order" ADD COLUMN "post_id" TEXT;

-- CreateIndex
CREATE INDEX "Order_post_id_idx" ON "Order"("post_id");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "Post"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: Quote
CREATE TABLE "quotes" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "status" "QuoteStatus" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "line_items" JSONB NOT NULL,
    "subtotal" DOUBLE PRECISION NOT NULL,
    "tax" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CAD',
    "valid_until" TIMESTAMP(3),
    "notes" TEXT,
    "customer_message" TEXT,
    "sent_at" TIMESTAMP(3),
    "responded_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quotes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "quotes_order_id_idx" ON "quotes"("order_id");
CREATE INDEX "quotes_workspace_id_status_idx" ON "quotes"("workspace_id", "status");

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable: WorkspaceCustomerNote
CREATE TABLE "workspace_customer_notes" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "workspace_customer_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "workspace_customer_notes_workspace_id_customer_id_idx" ON "workspace_customer_notes"("workspace_id", "customer_id");
CREATE INDEX "workspace_customer_notes_workspace_id_idx" ON "workspace_customer_notes"("workspace_id");

-- AddForeignKey
ALTER TABLE "workspace_customer_notes" ADD CONSTRAINT "workspace_customer_notes_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workspace_customer_notes" ADD CONSTRAINT "workspace_customer_notes_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workspace_customer_notes" ADD CONSTRAINT "workspace_customer_notes_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
