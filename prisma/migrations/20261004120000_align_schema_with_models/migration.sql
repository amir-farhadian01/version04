-- Align migrated schema with prisma/schema.prisma (forward-only corrective).
-- Generated with: prisma migrate diff --from-url <fresh-migrated-db> --to-schema-datamodel prisma/schema.prisma --script
-- then hand-reviewed and made idempotent (guarded CREATE/DROP). Prisma 5.22 / PostgreSQL 16.
-- Scope: models whose historical migrations were stubbed (home_intelligence), incomplete (monetization),
-- or never created (social_layer.sql was never a Prisma migration). See ADR + decision-history 2026-10-04.
-- NOTE: destructive steps (PostReaction drop, PostComment.userId drop, PostMedia.type / Post.moderationStatus
-- recreate, Service.price -> INTEGER) reflect schema.prisma decisions already taken; on schema-synced
-- environments (e.g. dev db-pushed) this migration is baselined via migrate resolve, never executed.

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "AttendeeStatus" AS ENUM ('registered', 'confirmed', 'cancelled', 'attended');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "PostModerationStatus" AS ENUM ('pending', 'approved', 'rejected', 'flagged');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AlterEnum
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'OrderPhase' AND e.enumlabel = 'draft') THEN
    ALTER TYPE "OrderPhase" ADD VALUE 'draft';
  END IF;
END $$;

-- AlterEnum
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'PaymentStatus' AND e.enumlabel = 'releaseScheduled') THEN
    ALTER TYPE "PaymentStatus" ADD VALUE 'releaseScheduled';
  END IF;
END $$;

-- DropForeignKey
ALTER TABLE "PostComment" DROP CONSTRAINT IF EXISTS "PostComment_postId_fkey";

-- DropForeignKey
ALTER TABLE "PostComment" DROP CONSTRAINT IF EXISTS "PostComment_userId_fkey";

-- DropForeignKey
ALTER TABLE "PostLike" DROP CONSTRAINT IF EXISTS "PostLike_postId_fkey";

-- DropForeignKey
ALTER TABLE "PostLike" DROP CONSTRAINT IF EXISTS "PostLike_userId_fkey";

-- DropForeignKey
ALTER TABLE "PostMedia" DROP CONSTRAINT IF EXISTS "PostMedia_postId_fkey";

-- DropForeignKey
ALTER TABLE "PostReaction" DROP CONSTRAINT IF EXISTS "PostReaction_postId_fkey";

-- DropForeignKey
ALTER TABLE "PostReaction" DROP CONSTRAINT IF EXISTS "PostReaction_userId_fkey";

-- DropForeignKey
ALTER TABLE "PostSave" DROP CONSTRAINT IF EXISTS "PostSave_postId_fkey";

-- DropForeignKey
ALTER TABLE "PostSave" DROP CONSTRAINT IF EXISTS "PostSave_userId_fkey";

-- DropForeignKey
ALTER TABLE "UtilityLinkClick" DROP CONSTRAINT IF EXISTS "UtilityLinkClick_linkId_fkey";

-- DropForeignKey
ALTER TABLE "package_staff_assignments" DROP CONSTRAINT IF EXISTS "package_staff_assignments_staff_id_fkey";

-- DropIndex
DROP INDEX IF EXISTS "Post_createdAt_idx";

-- DropIndex
DROP INDEX IF EXISTS "PostComment_userId_idx";

-- AlterTable
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "interac_email" TEXT,
ADD COLUMN IF NOT EXISTS "interac_enabled" BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS "paypal_email" TEXT,
ADD COLUMN IF NOT EXISTS "paypal_enabled" BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS "square_enabled" BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS "square_location_id" TEXT,
ADD COLUMN IF NOT EXISTS "stripe_account_id" TEXT,
ADD COLUMN IF NOT EXISTS "stripe_charges_enabled" BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS "stripe_enabled" BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS "stripe_payouts_enabled" BOOLEAN DEFAULT false;

-- AlterTable
ALTER TABLE "OrderReview" ADD COLUMN IF NOT EXISTS "reviewType" TEXT NOT NULL DEFAULT 'customer',
ADD COLUMN IF NOT EXISTS "reviewerId" TEXT;

-- AlterTable
ALTER TABLE "Post" ALTER COLUMN "updatedAt" DROP DEFAULT,
DROP COLUMN IF EXISTS "moderationStatus",
ADD COLUMN IF NOT EXISTS "moderationStatus" "PostModerationStatus" NOT NULL DEFAULT 'pending';

-- AlterTable
ALTER TABLE "PostComment" DROP COLUMN IF EXISTS "userId",
ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "authorId" TEXT NOT NULL,
ADD COLUMN IF NOT EXISTS "likeCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "moderationStatus" "PostModerationStatus" NOT NULL DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS "parentId" TEXT,
ADD COLUMN IF NOT EXISTS "replyCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "PostMedia" DROP COLUMN IF EXISTS "type",
ADD COLUMN IF NOT EXISTS "type" "PostMediaType" NOT NULL;

-- AlterTable
ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "imageUrl" TEXT,
ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3),
ALTER COLUMN "price" SET DEFAULT 0,
ALTER COLUMN "price" SET DATA TYPE INTEGER;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "onboardingCompletedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "onboardingInterests" DROP DEFAULT;

-- AlterTable
ALTER TABLE "business_portfolios" ALTER COLUMN "gallery_urls" DROP DEFAULT,
ALTER COLUMN "tags" DROP DEFAULT;

-- DropTable
DROP TABLE IF EXISTS "PostReaction";

-- CreateTable
CREATE TABLE IF NOT EXISTS "CommentLike" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommentLike_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CommentAttachment" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "fileName" TEXT,
    "fileSize" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommentAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "BusinessHours" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "openTime" TEXT NOT NULL,
    "closeTime" TEXT NOT NULL,
    "isOpen" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessHours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "home_content_configs" (
    "id" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT,
    "api_endpoint" TEXT,
    "api_key" TEXT,
    "refresh_interval" INTEGER NOT NULL DEFAULT 3600,
    "max_items" INTEGER NOT NULL DEFAULT 5,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "home_content_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "service_rates_by_location" (
    "id" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "neighborhood" TEXT,
    "category_id" TEXT,
    "service_name" TEXT NOT NULL,
    "avg_price" DECIMAL(65,30) NOT NULL,
    "min_price" DECIMAL(65,30) NOT NULL,
    "max_price" DECIMAL(65,30) NOT NULL,
    "sample_size" INTEGER NOT NULL,
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_rates_by_location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "demand_analytics" (
    "id" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "neighborhood" TEXT,
    "category_id" TEXT,
    "search_count" INTEGER NOT NULL DEFAULT 0,
    "order_count" INTEGER NOT NULL DEFAULT 0,
    "unique_clients" INTEGER NOT NULL DEFAULT 0,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "demand_analytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "service_form_templates" (
    "id" TEXT NOT NULL,
    "service_catalog_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "schema" JSONB NOT NULL,
    "generated_by_ai" BOOLEAN NOT NULL DEFAULT false,
    "ai_prompt" TEXT,
    "ai_model" TEXT,
    "published_by_id" TEXT,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_form_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "group_service_sessions" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "max_attendees" INTEGER NOT NULL DEFAULT 10,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "duration_minutes" INTEGER NOT NULL,
    "locationId" TEXT,
    "price_per_attendee" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "group_service_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "group_session_attendees" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "AttendeeStatus" NOT NULL DEFAULT 'registered',
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "group_session_attendees_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CommentLike_commentId_idx" ON "CommentLike"("commentId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "CommentLike_commentId_userId_key" ON "CommentLike"("commentId", "userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CommentAttachment_commentId_idx" ON "CommentAttachment"("commentId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BusinessHours_workspaceId_idx" ON "BusinessHours"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "BusinessHours_workspaceId_dayOfWeek_key" ON "BusinessHours"("workspaceId", "dayOfWeek");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "home_content_configs_section_key" ON "home_content_configs"("section");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "service_rates_by_location_city_neighborhood_idx" ON "service_rates_by_location"("city", "neighborhood");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "demand_analytics_city_neighborhood_period_start_idx" ON "demand_analytics"("city", "neighborhood", "period_start");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "service_form_templates_service_catalog_id_is_active_idx" ON "service_form_templates"("service_catalog_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "service_form_templates_service_catalog_id_version_key" ON "service_form_templates"("service_catalog_id", "version");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "group_service_sessions_orderId_idx" ON "group_service_sessions"("orderId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "group_session_attendees_sessionId_idx" ON "group_session_attendees"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "group_session_attendees_sessionId_userId_key" ON "group_session_attendees"("sessionId", "userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OrderReview_reviewerId_idx" ON "OrderReview"("reviewerId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Post_moderationStatus_idx" ON "Post"("moderationStatus");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PostComment_parentId_idx" ON "PostComment"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "User_phone_key" ON "User"("phone");

-- AddForeignKey
ALTER TABLE "package_staff_assignments" DROP CONSTRAINT IF EXISTS "package_staff_assignments_staff_id_fkey";
ALTER TABLE "package_staff_assignments" ADD CONSTRAINT "package_staff_assignments_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderReview" DROP CONSTRAINT IF EXISTS "OrderReview_reviewerId_fkey";
ALTER TABLE "OrderReview" ADD CONSTRAINT "OrderReview_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" DROP CONSTRAINT IF EXISTS "Post_serviceCatalogId_fkey";
ALTER TABLE "Post" ADD CONSTRAINT "Post_serviceCatalogId_fkey" FOREIGN KEY ("serviceCatalogId") REFERENCES "ServiceCatalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostMedia" DROP CONSTRAINT IF EXISTS "PostMedia_postId_fkey";
ALTER TABLE "PostMedia" ADD CONSTRAINT "PostMedia_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostComment" DROP CONSTRAINT IF EXISTS "PostComment_postId_fkey";
ALTER TABLE "PostComment" ADD CONSTRAINT "PostComment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostComment" DROP CONSTRAINT IF EXISTS "PostComment_authorId_fkey";
ALTER TABLE "PostComment" ADD CONSTRAINT "PostComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostComment" DROP CONSTRAINT IF EXISTS "PostComment_parentId_fkey";
ALTER TABLE "PostComment" ADD CONSTRAINT "PostComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "PostComment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostLike" DROP CONSTRAINT IF EXISTS "PostLike_postId_fkey";
ALTER TABLE "PostLike" ADD CONSTRAINT "PostLike_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostLike" DROP CONSTRAINT IF EXISTS "PostLike_userId_fkey";
ALTER TABLE "PostLike" ADD CONSTRAINT "PostLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostSave" DROP CONSTRAINT IF EXISTS "PostSave_postId_fkey";
ALTER TABLE "PostSave" ADD CONSTRAINT "PostSave_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostSave" DROP CONSTRAINT IF EXISTS "PostSave_userId_fkey";
ALTER TABLE "PostSave" ADD CONSTRAINT "PostSave_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommentLike" DROP CONSTRAINT IF EXISTS "CommentLike_commentId_fkey";
ALTER TABLE "CommentLike" ADD CONSTRAINT "CommentLike_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "PostComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommentLike" DROP CONSTRAINT IF EXISTS "CommentLike_userId_fkey";
ALTER TABLE "CommentLike" ADD CONSTRAINT "CommentLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommentAttachment" DROP CONSTRAINT IF EXISTS "CommentAttachment_commentId_fkey";
ALTER TABLE "CommentAttachment" ADD CONSTRAINT "CommentAttachment_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "PostComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessHours" DROP CONSTRAINT IF EXISTS "BusinessHours_workspaceId_fkey";
ALTER TABLE "BusinessHours" ADD CONSTRAINT "BusinessHours_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UtilityLinkClick" DROP CONSTRAINT IF EXISTS "UtilityLinkClick_linkId_fkey";
ALTER TABLE "UtilityLinkClick" ADD CONSTRAINT "UtilityLinkClick_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "UtilityLink"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_form_templates" DROP CONSTRAINT IF EXISTS "service_form_templates_service_catalog_id_fkey";
ALTER TABLE "service_form_templates" ADD CONSTRAINT "service_form_templates_service_catalog_id_fkey" FOREIGN KEY ("service_catalog_id") REFERENCES "ServiceCatalog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_service_sessions" DROP CONSTRAINT IF EXISTS "group_service_sessions_orderId_fkey";
ALTER TABLE "group_service_sessions" ADD CONSTRAINT "group_service_sessions_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_session_attendees" DROP CONSTRAINT IF EXISTS "group_session_attendees_sessionId_fkey";
ALTER TABLE "group_session_attendees" ADD CONSTRAINT "group_session_attendees_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "group_service_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

