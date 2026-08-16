-- CreateEnum
CREATE TYPE "ChatRestrictionLevel" AS ENUM ('none', 'warning', 'temporary_restricted', 'permanent_restricted');

-- AlterTable: User — chat restriction, circumvention, and location fields
ALTER TABLE "User" ADD COLUMN "chat_restriction_level" "ChatRestrictionLevel" NOT NULL DEFAULT 'none';
ALTER TABLE "User" ADD COLUMN "chat_restriction_expires_at" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "circumventionScore" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "circumvention_score_decayed_at" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "locationLat" DOUBLE PRECISION;
ALTER TABLE "User" ADD COLUMN "locationLng" DOUBLE PRECISION;
