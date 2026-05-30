-- AlterTable
ALTER TABLE "SystemConfig" ADD COLUMN IF NOT EXISTS "dependencyCatalog" JSONB;
