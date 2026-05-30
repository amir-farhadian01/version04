-- CreateEnum (with IF NOT EXISTS guard for idempotency)
DO $$ BEGIN
    CREATE TYPE "KycStatus" AS ENUM ('pending', 'approved', 'rejected', 'resubmit_requested');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "KycSubmissionType" AS ENUM ('level0', 'personal', 'business');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE "KycLevel0Profile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emailVerifiedAt" TIMESTAMP(3),
    "phoneVerifiedAt" TIMESTAMP(3),
    "address" TEXT,
    "addressCapturedAt" TIMESTAMP(3),
    "addressVerifiedAt" TIMESTAMP(3),
    "adminAcknowledgedAt" TIMESTAMP(3),
    "adminAcknowledgedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KycLevel0Profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KycPersonalSubmission" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "declaredLegalName" TEXT NOT NULL,
    "idDocumentType" TEXT NOT NULL,
    "idDocumentNumber" TEXT,
    "idFrontUrl" TEXT NOT NULL,
    "idBackUrl" TEXT,
    "selfieUrl" TEXT NOT NULL,
    "aiAnalysis" JSONB,
    "status" "KycStatus" NOT NULL DEFAULT 'pending',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KycPersonalSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessKycFormSchema" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "schema" JSONB NOT NULL,
    "description" TEXT,
    "publishedById" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessKycFormSchema_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessKycSubmission" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyId" TEXT,
    "schemaVersion" INTEGER NOT NULL,
    "answers" JSONB NOT NULL,
    "uploads" JSONB NOT NULL,
    "inquiryResults" JSONB,
    "expiryFlags" JSONB,
    "status" "KycStatus" NOT NULL DEFAULT 'pending',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessKycSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KycReviewAuditLog" (
    "id" TEXT NOT NULL,
    "submissionType" "KycSubmissionType" NOT NULL,
    "submissionId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "note" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KycReviewAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "KycLevel0Profile_userId_key" ON "KycLevel0Profile"("userId");

-- CreateIndex
CREATE INDEX "KycPersonalSubmission_userId_idx" ON "KycPersonalSubmission"("userId");

-- CreateIndex
CREATE INDEX "KycPersonalSubmission_status_idx" ON "KycPersonalSubmission"("status");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessKycFormSchema_version_key" ON "BusinessKycFormSchema"("version");

-- CreateIndex
CREATE INDEX "BusinessKycSubmission_userId_idx" ON "BusinessKycSubmission"("userId");

-- CreateIndex
CREATE INDEX "BusinessKycSubmission_status_idx" ON "BusinessKycSubmission"("status");

-- CreateIndex
CREATE INDEX "KycReviewAuditLog_submissionType_submissionId_idx" ON "KycReviewAuditLog"("submissionType", "submissionId");

-- AddForeignKey
ALTER TABLE "KycLevel0Profile" ADD CONSTRAINT "KycLevel0Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KycPersonalSubmission" ADD CONSTRAINT "KycPersonalSubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessKycSubmission" ADD CONSTRAINT "BusinessKycSubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessKycSubmission" ADD CONSTRAINT "BusinessKycSubmission_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
