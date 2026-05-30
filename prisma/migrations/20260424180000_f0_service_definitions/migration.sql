-- AlterTable
ALTER TABLE "Service" ADD COLUMN "serviceCatalogId" TEXT;

-- AlterTable
ALTER TABLE "ServiceCatalog" ADD COLUMN "categoryId" TEXT;
ALTER TABLE "ServiceCatalog" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "ServiceCatalog" ADD COLUMN "defaultMatchingMode" TEXT NOT NULL DEFAULT 'manual_review';
ALTER TABLE "ServiceCatalog" ADD COLUMN "description" TEXT;
ALTER TABLE "ServiceCatalog" ADD COLUMN "dynamicFieldsSchema" JSONB;
ALTER TABLE "ServiceCatalog" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "ServiceCatalog" ADD COLUMN "slug" TEXT;
ALTER TABLE "ServiceCatalog" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "ServiceCatalog" ALTER COLUMN "complianceTags" SET DEFAULT ARRAY[]::TEXT[];

-- CreateIndex
CREATE INDEX "Service_serviceCatalogId_idx" ON "Service"("serviceCatalogId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceCatalog_slug_key" ON "ServiceCatalog"("slug");

-- CreateIndex
CREATE INDEX "ServiceCatalog_categoryId_idx" ON "ServiceCatalog"("categoryId");

-- CreateIndex
CREATE INDEX "ServiceCatalog_isActive_idx" ON "ServiceCatalog"("isActive");

-- AddForeignKey
ALTER TABLE "ServiceCatalog" ADD CONSTRAINT "ServiceCatalog_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_serviceCatalogId_fkey" FOREIGN KEY ("serviceCatalogId") REFERENCES "ServiceCatalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;
