-- CreateEnum
CREATE TYPE "BookingMode" AS ENUM ('auto_appointment', 'negotiation', 'inherit_from_catalog');

-- AlterTable
ALTER TABLE "ServiceCatalog" ADD COLUMN     "lockedBookingMode" TEXT;

-- CreateTable
CREATE TABLE "ProviderServicePackage" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "serviceCatalogId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "finalPrice" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CAD',
    "bookingMode" "BookingMode" NOT NULL DEFAULT 'inherit_from_catalog',
    "durationMinutes" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "archivedAt" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderServicePackage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProviderServicePackage_workspaceId_idx" ON "ProviderServicePackage"("workspaceId");

-- CreateIndex
CREATE INDEX "ProviderServicePackage_serviceCatalogId_idx" ON "ProviderServicePackage"("serviceCatalogId");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderServicePackage_workspaceId_serviceCatalogId_name_key" ON "ProviderServicePackage"("workspaceId", "serviceCatalogId", "name");

-- AddForeignKey
ALTER TABLE "ProviderServicePackage" ADD CONSTRAINT "ProviderServicePackage_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderServicePackage" ADD CONSTRAINT "ProviderServicePackage_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderServicePackage" ADD CONSTRAINT "ProviderServicePackage_serviceCatalogId_fkey" FOREIGN KEY ("serviceCatalogId") REFERENCES "ServiceCatalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
