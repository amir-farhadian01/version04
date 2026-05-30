-- CreateEnum
CREATE TYPE "MatchAttemptStatus" AS ENUM ('invited', 'matched', 'accepted', 'declined', 'expired', 'superseded');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "autoMatchExhausted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "matchedPackageId" TEXT,
ADD COLUMN     "matchedProviderId" TEXT,
ADD COLUMN     "matchedWorkspaceId" TEXT;

-- CreateTable
CREATE TABLE "OfferMatchAttempt" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "status" "MatchAttemptStatus" NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "distanceKm" DOUBLE PRECISION,
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "matchedAt" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "declineReason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfferMatchAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OfferMatchAttempt_offerId_idx" ON "OfferMatchAttempt"("offerId");

-- CreateIndex
CREATE INDEX "OfferMatchAttempt_workspaceId_status_idx" ON "OfferMatchAttempt"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "OfferMatchAttempt_providerId_status_idx" ON "OfferMatchAttempt"("providerId", "status");

-- AddForeignKey
ALTER TABLE "OfferMatchAttempt" ADD CONSTRAINT "OfferMatchAttempt_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferMatchAttempt" ADD CONSTRAINT "OfferMatchAttempt_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "ProviderServicePackage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferMatchAttempt" ADD CONSTRAINT "OfferMatchAttempt_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferMatchAttempt" ADD CONSTRAINT "OfferMatchAttempt_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_matchedPackageId_fkey" FOREIGN KEY ("matchedPackageId") REFERENCES "ProviderServicePackage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_matchedProviderId_fkey" FOREIGN KEY ("matchedProviderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_matchedWorkspaceId_fkey" FOREIGN KEY ("matchedWorkspaceId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
