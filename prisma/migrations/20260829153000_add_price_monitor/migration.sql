-- Add the isolated competitor price-monitor domain. This migration is additive;
-- it does not crawl sources or change any storefront price.

CREATE TYPE "PriceMonitorSourceStatus" AS ENUM ('READY', 'NEEDS_SETUP', 'PAUSED');
CREATE TYPE "PriceMonitorRunStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'PARTIAL', 'FAILED');
CREATE TYPE "PriceMonitorMatchStatus" AS ENUM ('SUGGESTED', 'APPROVED', 'REJECTED');
CREATE TYPE "PriceMonitorRecommendationType" AS ENUM ('LOWER', 'RAISE', 'KEEP', 'REVIEW');
CREATE TYPE "PriceMonitorRecommendationStatus" AS ENUM ('OPEN', 'APPROVED', 'APPLIED', 'DISMISSED', 'FAILED');
CREATE TYPE "PriceMonitorReportFrequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');

CREATE TABLE "PriceMonitorSource" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "baseUrl" TEXT NOT NULL,
  "adapterKey" TEXT NOT NULL,
  "status" "PriceMonitorSourceStatus" NOT NULL DEFAULT 'NEEDS_SETUP',
  "statusNote" TEXT,
  "lastRunAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PriceMonitorSource_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PriceMonitorCrawlRun" (
  "id" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "requestedByAdminUserId" TEXT NOT NULL,
  "status" "PriceMonitorRunStatus" NOT NULL DEFAULT 'RUNNING',
  "trigger" TEXT NOT NULL DEFAULT 'MANUAL',
  "requestedLimit" INTEGER NOT NULL DEFAULT 25,
  "discoveredCount" INTEGER NOT NULL DEFAULT 0,
  "processedCount" INTEGER NOT NULL DEFAULT 0,
  "successCount" INTEGER NOT NULL DEFAULT 0,
  "errorCount" INTEGER NOT NULL DEFAULT 0,
  "dataQualityScore" INTEGER,
  "errorMessage" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  CONSTRAINT "PriceMonitorCrawlRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PriceMonitorCompetitorProduct" (
  "id" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "sourceUrl" TEXT NOT NULL,
  "externalKey" TEXT,
  "canonicalName" TEXT NOT NULL,
  "description" TEXT,
  "sku" TEXT,
  "ean" TEXT,
  "packageQuantity" INTEGER,
  "packageUnit" TEXT,
  "currency" TEXT NOT NULL DEFAULT 'EUR',
  "inStock" BOOLEAN,
  "raw" JSONB,
  "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PriceMonitorCompetitorProduct_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PriceMonitorObservation" (
  "id" TEXT NOT NULL,
  "crawlRunId" TEXT NOT NULL,
  "competitorProductId" TEXT NOT NULL,
  "priceCents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'EUR',
  "normalizedPriceCents" INTEGER,
  "normalizedUnit" TEXT,
  "dataQualityScore" INTEGER NOT NULL,
  "qualityFlags" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "inStock" BOOLEAN,
  "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PriceMonitorObservation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PriceMonitorMatch" (
  "id" TEXT NOT NULL,
  "productVariantId" TEXT NOT NULL,
  "competitorProductId" TEXT NOT NULL,
  "status" "PriceMonitorMatchStatus" NOT NULL DEFAULT 'SUGGESTED',
  "confidenceScore" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "approvedAt" TIMESTAMP(3),
  "rejectedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PriceMonitorMatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PricingRecommendation" (
  "id" TEXT NOT NULL,
  "productVariantId" TEXT NOT NULL,
  "matchId" TEXT NOT NULL,
  "observationId" TEXT NOT NULL,
  "type" "PriceMonitorRecommendationType" NOT NULL,
  "status" "PriceMonitorRecommendationStatus" NOT NULL DEFAULT 'OPEN',
  "currentPriceCents" INTEGER NOT NULL,
  "competitorPriceCents" INTEGER NOT NULL,
  "suggestedPriceCents" INTEGER NOT NULL,
  "differenceBps" INTEGER NOT NULL,
  "scenarioImpactPer100Cents" INTEGER NOT NULL,
  "confidenceScore" INTEGER NOT NULL,
  "rationale" TEXT NOT NULL,
  "caveat" TEXT,
  "rulesVersion" TEXT NOT NULL DEFAULT 'price-coach-v1',
  "reviewedByAdminUserId" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "appliedByAdminUserId" TEXT,
  "appliedAt" TIMESTAMP(3),
  "appliedPriceCents" INTEGER,
  "failureReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PricingRecommendation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PriceMonitorReportSchedule" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "sourceId" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "frequency" "PriceMonitorReportFrequency" NOT NULL DEFAULT 'WEEKLY',
  "hourLocal" INTEGER NOT NULL DEFAULT 7,
  "dayOfWeek" INTEGER,
  "dayOfMonth" INTEGER,
  "timezone" TEXT NOT NULL DEFAULT 'Europe/Amsterdam',
  "recipientEmail" TEXT,
  "formats" TEXT[] DEFAULT ARRAY['CSV']::TEXT[],
  "minDifferenceBps" INTEGER NOT NULL DEFAULT 1000,
  "includeOpenActions" BOOLEAN NOT NULL DEFAULT true,
  "nextRunAt" TIMESTAMP(3),
  "lastRunAt" TIMESTAMP(3),
  "lastSentAt" TIMESTAMP(3),
  "lastStatus" TEXT NOT NULL DEFAULT 'NEVER',
  "lastError" TEXT,
  "createdByAdminUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PriceMonitorReportSchedule_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PriceMonitorSource_key_key" ON "PriceMonitorSource"("key");
CREATE INDEX "PriceMonitorSource_status_name_idx" ON "PriceMonitorSource"("status", "name");
CREATE INDEX "PriceMonitorCrawlRun_sourceId_startedAt_idx" ON "PriceMonitorCrawlRun"("sourceId", "startedAt");
CREATE INDEX "PriceMonitorCrawlRun_status_startedAt_idx" ON "PriceMonitorCrawlRun"("status", "startedAt");
CREATE INDEX "PriceMonitorCrawlRun_requestedByAdminUserId_startedAt_idx" ON "PriceMonitorCrawlRun"("requestedByAdminUserId", "startedAt");
CREATE UNIQUE INDEX "PriceMonitorCrawlRun_one_running_per_source_idx" ON "PriceMonitorCrawlRun"("sourceId") WHERE "status" = 'RUNNING';
CREATE UNIQUE INDEX "PriceMonitorCompetitorProduct_sourceId_sourceUrl_key" ON "PriceMonitorCompetitorProduct"("sourceId", "sourceUrl");
CREATE INDEX "PriceMonitorCompetitorProduct_sourceId_lastSeenAt_idx" ON "PriceMonitorCompetitorProduct"("sourceId", "lastSeenAt");
CREATE INDEX "PriceMonitorCompetitorProduct_ean_idx" ON "PriceMonitorCompetitorProduct"("ean");
CREATE INDEX "PriceMonitorCompetitorProduct_sku_idx" ON "PriceMonitorCompetitorProduct"("sku");
CREATE INDEX "PriceMonitorObservation_competitorProductId_observedAt_idx" ON "PriceMonitorObservation"("competitorProductId", "observedAt");
CREATE INDEX "PriceMonitorObservation_crawlRunId_idx" ON "PriceMonitorObservation"("crawlRunId");
CREATE INDEX "PriceMonitorObservation_dataQualityScore_observedAt_idx" ON "PriceMonitorObservation"("dataQualityScore", "observedAt");
CREATE UNIQUE INDEX "PriceMonitorMatch_productVariantId_competitorProductId_key" ON "PriceMonitorMatch"("productVariantId", "competitorProductId");
CREATE INDEX "PriceMonitorMatch_status_confidenceScore_idx" ON "PriceMonitorMatch"("status", "confidenceScore");
CREATE INDEX "PriceMonitorMatch_competitorProductId_idx" ON "PriceMonitorMatch"("competitorProductId");
CREATE UNIQUE INDEX "PricingRecommendation_productVariantId_observationId_key" ON "PricingRecommendation"("productVariantId", "observationId");
CREATE INDEX "PricingRecommendation_status_createdAt_idx" ON "PricingRecommendation"("status", "createdAt");
CREATE INDEX "PricingRecommendation_type_differenceBps_idx" ON "PricingRecommendation"("type", "differenceBps");
CREATE INDEX "PricingRecommendation_matchId_createdAt_idx" ON "PricingRecommendation"("matchId", "createdAt");
CREATE INDEX "PriceMonitorReportSchedule_enabled_nextRunAt_idx" ON "PriceMonitorReportSchedule"("enabled", "nextRunAt");
CREATE INDEX "PriceMonitorReportSchedule_sourceId_enabled_idx" ON "PriceMonitorReportSchedule"("sourceId", "enabled");

ALTER TABLE "PriceMonitorCrawlRun" ADD CONSTRAINT "PriceMonitorCrawlRun_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "PriceMonitorSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PriceMonitorCrawlRun" ADD CONSTRAINT "PriceMonitorCrawlRun_requestedByAdminUserId_fkey" FOREIGN KEY ("requestedByAdminUserId") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PriceMonitorCompetitorProduct" ADD CONSTRAINT "PriceMonitorCompetitorProduct_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "PriceMonitorSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PriceMonitorObservation" ADD CONSTRAINT "PriceMonitorObservation_crawlRunId_fkey" FOREIGN KEY ("crawlRunId") REFERENCES "PriceMonitorCrawlRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PriceMonitorObservation" ADD CONSTRAINT "PriceMonitorObservation_competitorProductId_fkey" FOREIGN KEY ("competitorProductId") REFERENCES "PriceMonitorCompetitorProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PriceMonitorMatch" ADD CONSTRAINT "PriceMonitorMatch_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PriceMonitorMatch" ADD CONSTRAINT "PriceMonitorMatch_competitorProductId_fkey" FOREIGN KEY ("competitorProductId") REFERENCES "PriceMonitorCompetitorProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PricingRecommendation" ADD CONSTRAINT "PricingRecommendation_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PricingRecommendation" ADD CONSTRAINT "PricingRecommendation_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "PriceMonitorMatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PricingRecommendation" ADD CONSTRAINT "PricingRecommendation_observationId_fkey" FOREIGN KEY ("observationId") REFERENCES "PriceMonitorObservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PricingRecommendation" ADD CONSTRAINT "PricingRecommendation_reviewedByAdminUserId_fkey" FOREIGN KEY ("reviewedByAdminUserId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PricingRecommendation" ADD CONSTRAINT "PricingRecommendation_appliedByAdminUserId_fkey" FOREIGN KEY ("appliedByAdminUserId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PriceMonitorReportSchedule" ADD CONSTRAINT "PriceMonitorReportSchedule_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "PriceMonitorSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PriceMonitorReportSchedule" ADD CONSTRAINT "PriceMonitorReportSchedule_createdByAdminUserId_fkey" FOREIGN KEY ("createdByAdminUserId") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
