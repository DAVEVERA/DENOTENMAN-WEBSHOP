-- The price monitor was removed from the admin. Drop its tables and enums;
-- this permanently deletes the collected competitor prices and recommendations.

-- DropForeignKey
ALTER TABLE "PriceMonitorCompetitorProduct" DROP CONSTRAINT "PriceMonitorCompetitorProduct_sourceId_fkey";

-- DropForeignKey
ALTER TABLE "PriceMonitorCrawlRun" DROP CONSTRAINT "PriceMonitorCrawlRun_requestedByAdminUserId_fkey";

-- DropForeignKey
ALTER TABLE "PriceMonitorCrawlRun" DROP CONSTRAINT "PriceMonitorCrawlRun_sourceId_fkey";

-- DropForeignKey
ALTER TABLE "PriceMonitorMatch" DROP CONSTRAINT "PriceMonitorMatch_competitorProductId_fkey";

-- DropForeignKey
ALTER TABLE "PriceMonitorMatch" DROP CONSTRAINT "PriceMonitorMatch_productVariantId_fkey";

-- DropForeignKey
ALTER TABLE "PriceMonitorObservation" DROP CONSTRAINT "PriceMonitorObservation_competitorProductId_fkey";

-- DropForeignKey
ALTER TABLE "PriceMonitorObservation" DROP CONSTRAINT "PriceMonitorObservation_crawlRunId_fkey";

-- DropForeignKey
ALTER TABLE "PriceMonitorReportSchedule" DROP CONSTRAINT "PriceMonitorReportSchedule_createdByAdminUserId_fkey";

-- DropForeignKey
ALTER TABLE "PriceMonitorReportSchedule" DROP CONSTRAINT "PriceMonitorReportSchedule_sourceId_fkey";

-- DropForeignKey
ALTER TABLE "PricingRecommendation" DROP CONSTRAINT "PricingRecommendation_appliedByAdminUserId_fkey";

-- DropForeignKey
ALTER TABLE "PricingRecommendation" DROP CONSTRAINT "PricingRecommendation_matchId_fkey";

-- DropForeignKey
ALTER TABLE "PricingRecommendation" DROP CONSTRAINT "PricingRecommendation_observationId_fkey";

-- DropForeignKey
ALTER TABLE "PricingRecommendation" DROP CONSTRAINT "PricingRecommendation_productVariantId_fkey";

-- DropForeignKey
ALTER TABLE "PricingRecommendation" DROP CONSTRAINT "PricingRecommendation_reviewedByAdminUserId_fkey";

-- DropTable
DROP TABLE "PriceMonitorCompetitorProduct";

-- DropTable
DROP TABLE "PriceMonitorCrawlRun";

-- DropTable
DROP TABLE "PriceMonitorMatch";

-- DropTable
DROP TABLE "PriceMonitorObservation";

-- DropTable
DROP TABLE "PriceMonitorReportSchedule";

-- DropTable
DROP TABLE "PriceMonitorSource";

-- DropTable
DROP TABLE "PricingRecommendation";

-- DropEnum
DROP TYPE "PriceMonitorMatchStatus";

-- DropEnum
DROP TYPE "PriceMonitorRecommendationStatus";

-- DropEnum
DROP TYPE "PriceMonitorRecommendationType";

-- DropEnum
DROP TYPE "PriceMonitorReportFrequency";

-- DropEnum
DROP TYPE "PriceMonitorRunStatus";

-- DropEnum
DROP TYPE "PriceMonitorSourceStatus";
