-- CreateTable: BusinessVerification — license/insurance verification for business workspaces
CREATE TABLE "BusinessVerification" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "requiresLicense" BOOLEAN NOT NULL DEFAULT false,
    "licenseNumber" TEXT,
    "licenseDocUrl" TEXT,
    "licenseVerifiedAt" TIMESTAMP(3),
    "hasLiabilityInsurance" BOOLEAN NOT NULL DEFAULT false,
    "insuranceDocUrl" TEXT,
    "insuranceVerifiedAt" TIMESTAMP(3),
    "verifiedByAdminId" TEXT,
    "notes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessVerification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BusinessVerification_workspaceId_key" ON "BusinessVerification"("workspaceId");
