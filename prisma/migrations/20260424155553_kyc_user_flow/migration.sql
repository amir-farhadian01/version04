-- AlterEnum
ALTER TYPE "KycStatus" ADD VALUE 'draft';

-- AlterTable
ALTER TABLE "BusinessKycSubmission" ALTER COLUMN "submittedAt" DROP NOT NULL,
ALTER COLUMN "submittedAt" DROP DEFAULT;

UPDATE "BusinessKycSubmission" SET "submittedAt" = "createdAt" WHERE "submittedAt" IS NULL;

-- AlterTable
ALTER TABLE "KycPersonalSubmission" ADD COLUMN     "declaredAddress" TEXT;
