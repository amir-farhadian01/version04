-- CreateTable: PackageStaffAssignment
CREATE TABLE "package_staff_assignments" (
    "id" TEXT NOT NULL,
    "package_id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "package_staff_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable: BusinessPortfolio
CREATE TABLE "business_portfolios" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "history" TEXT,
    "mission" TEXT,
    "gallery_urls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "business_hours" JSONB,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_portfolios_pkey" PRIMARY KEY ("id")
);

-- AlterTable: Add staffRole to CompanyUser
ALTER TABLE "CompanyUser" ADD COLUMN "staff_role" TEXT;

-- AlterTable: Add breakTimeMinutes to ProviderServicePackage
ALTER TABLE "ProviderServicePackage" ADD COLUMN "break_time_minutes" INTEGER DEFAULT 15;

-- AlterTable: Add isActive to Schedule
ALTER TABLE "Schedule" ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndexes for PackageStaffAssignment
CREATE UNIQUE INDEX "package_staff_assignments_package_id_staff_id_key" ON "package_staff_assignments"("package_id", "staff_id");
CREATE INDEX "package_staff_assignments_staff_id_idx" ON "package_staff_assignments"("staff_id");
CREATE INDEX "package_staff_assignments_package_id_idx" ON "package_staff_assignments"("package_id");

-- CreateIndexes for BusinessPortfolio
CREATE UNIQUE INDEX "business_portfolios_company_id_key" ON "business_portfolios"("company_id");

-- AddForeignKey: PackageStaffAssignment -> ProviderServicePackage
ALTER TABLE "package_staff_assignments" ADD CONSTRAINT "package_staff_assignments_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "ProviderServicePackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: PackageStaffAssignment -> User
ALTER TABLE "package_staff_assignments" ADD CONSTRAINT "package_staff_assignments_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: BusinessPortfolio -> Company
ALTER TABLE "business_portfolios" ADD CONSTRAINT "business_portfolios_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
