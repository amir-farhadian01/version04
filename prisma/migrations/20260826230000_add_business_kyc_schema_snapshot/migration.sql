ALTER TABLE "BusinessKycSubmission" ADD COLUMN "schemaSnapshot" JSONB;

UPDATE "BusinessKycSubmission" AS submission
SET "schemaSnapshot" = form."schema"
FROM "BusinessKycFormSchema" AS form
WHERE submission."schemaVersion" = form."version" AND submission."schemaSnapshot" IS NULL;
