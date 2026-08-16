-- CreateTable: UtilityLink (missing from valid migration history; was only in a bare snapshot)
CREATE TABLE IF NOT EXISTS "UtilityLink" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "iconUrl" TEXT,
    "description" TEXT,
    "commissionRate" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "uniqueClicks" INTEGER NOT NULL DEFAULT 0,
    "revenue" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "UtilityLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable: UtilityLinkClick
CREATE TABLE IF NOT EXISTS "UtilityLinkClick" (
    "id" TEXT NOT NULL,
    "linkId" TEXT NOT NULL,
    "userId" TEXT,
    "ipHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UtilityLinkClick_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "UtilityLinkClick" ADD CONSTRAINT "UtilityLinkClick_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "UtilityLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: HomeBanner
CREATE TABLE IF NOT EXISTS "HomeBanner" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "imageUrl" TEXT,
    "linkUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),
    CONSTRAINT "HomeBanner_pkey" PRIMARY KEY ("id")
);

-- CreateTable: HomeNewsArticle
CREATE TABLE IF NOT EXISTS "HomeNewsArticle" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "summary" TEXT,
    "imageUrl" TEXT,
    "category" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "scheduledAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),
    CONSTRAINT "HomeNewsArticle_pkey" PRIMARY KEY ("id")
);

-- CreateTable: WeatherConfig
CREATE TABLE IF NOT EXISTS "WeatherConfig" (
    "id" TEXT NOT NULL,
    "apiKey" TEXT,
    "apiEndpoint" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "units" TEXT NOT NULL DEFAULT 'metric',
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WeatherConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable: TrafficAlertSource
CREATE TABLE IF NOT EXISTS "TrafficAlertSource" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "apiEndpoint" TEXT,
    "apiKey" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "region" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TrafficAlertSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable: SafetyAlert
CREATE TABLE IF NOT EXISTS "SafetyAlert" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "severity" TEXT NOT NULL DEFAULT 'info',
    "location" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "source" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SafetyAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable: LocalInsightConfig
CREATE TABLE IF NOT EXISTS "LocalInsightConfig" (
    "id" TEXT NOT NULL,
    "insightType" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "minDataThreshold" INTEGER NOT NULL DEFAULT 100,
    "granularity" TEXT NOT NULL DEFAULT 'neighbourhood',
    "refreshHours" INTEGER NOT NULL DEFAULT 24,
    "displayPriority" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LocalInsightConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "HomeNewsArticle_category_idx" ON "HomeNewsArticle"("category");
CREATE INDEX IF NOT EXISTS "HomeNewsArticle_publishedAt_idx" ON "HomeNewsArticle"("publishedAt");
CREATE INDEX IF NOT EXISTS "UtilityLink_category_idx" ON "UtilityLink"("category");
CREATE INDEX IF NOT EXISTS "UtilityLinkClick_linkId_idx" ON "UtilityLinkClick"("linkId");
CREATE INDEX IF NOT EXISTS "UtilityLinkClick_createdAt_idx" ON "UtilityLinkClick"("createdAt");