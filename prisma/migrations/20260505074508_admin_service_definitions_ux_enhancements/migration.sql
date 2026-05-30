-- AlterTable
ALTER TABLE "ServiceCatalog" ADD COLUMN     "icon" TEXT,
ADD COLUMN     "showInHomeClient" BOOLEAN NOT NULL DEFAULT false;
