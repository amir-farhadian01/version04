-- CreateTable: BusinessTrustScore (missing from valid migration history; was only in a bare snapshot).
-- Replaces a broken ALTER that referenced a snake_case table/column that never existed.
CREATE TABLE IF NOT EXISTS "BusinessTrustScore" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "kycVerified" BOOLEAN NOT NULL DEFAULT false,
    "licenseVerified" BOOLEAN NOT NULL DEFAULT false,
    "insuranceVerified" BOOLEAN NOT NULL DEFAULT false,
    "avgRating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "totalScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessTrustScore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "BusinessTrustScore_workspaceId_key" ON "BusinessTrustScore"("workspaceId");
