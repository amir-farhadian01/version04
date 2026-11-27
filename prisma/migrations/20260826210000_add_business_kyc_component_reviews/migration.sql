ALTER TABLE "BusinessKycSubmission"
ADD COLUMN "registrationReviewStatus" TEXT NOT NULL DEFAULT 'pending',
ADD COLUMN "registrationReviewNote" TEXT,
ADD COLUMN "insuranceReviewStatus" TEXT NOT NULL DEFAULT 'pending',
ADD COLUMN "insuranceReviewNote" TEXT;
