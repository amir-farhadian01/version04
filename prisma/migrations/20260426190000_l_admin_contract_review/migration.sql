-- AlterEnum
ALTER TYPE "ContractActionType" ADD VALUE 'admin_marked_reviewed';
ALTER TYPE "ContractActionType" ADD VALUE 'admin_internal_note';

-- AlterTable
ALTER TABLE "OrderContract" ADD COLUMN "adminLastReviewAt" TIMESTAMP(3);
ALTER TABLE "OrderContract" ADD COLUMN "adminLastReviewById" TEXT;
