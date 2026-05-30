-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('draft', 'submitted', 'cancelled', 'matching', 'matched', 'contracted', 'paid', 'in_progress', 'completed');

-- CreateEnum
CREATE TYPE "OrderEntryPoint" AS ENUM ('explorer', 'ai_suggestion', 'direct');

-- AlterTable
ALTER TABLE "ServiceCatalog" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "serviceCatalogId" TEXT NOT NULL,
    "schemaSnapshot" JSONB NOT NULL,
    "answers" JSONB NOT NULL,
    "photos" JSONB NOT NULL,
    "description" TEXT NOT NULL,
    "descriptionAiAssisted" BOOLEAN NOT NULL DEFAULT false,
    "scheduledAt" TIMESTAMP(3),
    "scheduleFlexibility" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "locationLat" DOUBLE PRECISION,
    "locationLng" DOUBLE PRECISION,
    "entryPoint" "OrderEntryPoint" NOT NULL DEFAULT 'direct',
    "status" "OrderStatus" NOT NULL DEFAULT 'draft',
    "cancelReason" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Order_customerId_idx" ON "Order"("customerId");

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");

-- CreateIndex
CREATE INDEX "Order_serviceCatalogId_idx" ON "Order"("serviceCatalogId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_serviceCatalogId_fkey" FOREIGN KEY ("serviceCatalogId") REFERENCES "ServiceCatalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
