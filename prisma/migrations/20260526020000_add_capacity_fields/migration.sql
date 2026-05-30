-- AlterTable: Add capacity fields to ProviderServicePackage
ALTER TABLE "ProviderServicePackage" ADD COLUMN "max_daily_bookings" INTEGER NOT NULL DEFAULT 10;
ALTER TABLE "ProviderServicePackage" ADD COLUMN "slot_duration_minutes" INTEGER NOT NULL DEFAULT 60;
