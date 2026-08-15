-- Additive product-admin expansion. Existing catalog, media and order rows are
-- intentionally left untouched; all new fields are nullable or have defaults.
ALTER TABLE "Product" ADD COLUMN "salePriceCents" INTEGER;
ALTER TABLE "ProductVariant" ADD COLUMN "salePriceCents" INTEGER;

CREATE TYPE "StockNotificationStatus" AS ENUM ('PENDING', 'SENT', 'CANCELLED');
CREATE TYPE "GoogleAdsStatus" AS ENUM ('DRAFT', 'ENABLED', 'PAUSED', 'ERROR');

CREATE TABLE "ProductSlugAlias" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "locale" "Locale" NOT NULL,
  "slug" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductSlugAlias_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductRecommendation" (
  "sourceProductId" TEXT NOT NULL,
  "targetProductId" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "ProductRecommendation_pkey" PRIMARY KEY ("sourceProductId", "targetProductId")
);

CREATE TABLE "StockNotification" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "emailNormalized" TEXT NOT NULL,
  "locale" "Locale" NOT NULL DEFAULT 'nl',
  "consentSource" TEXT NOT NULL,
  "activeKey" TEXT,
  "status" "StockNotificationStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "notifiedAt" TIMESTAMP(3),
  CONSTRAINT "StockNotification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GoogleAdsConfiguration" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "status" "GoogleAdsStatus" NOT NULL DEFAULT 'DRAFT',
  "headlines" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "descriptions" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "finalUrl" TEXT,
  "dailyBudgetMicros" INTEGER,
  "campaignResourceName" TEXT,
  "adGroupResourceName" TEXT,
  "adResourceName" TEXT,
  "lastSyncedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GoogleAdsConfiguration_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductSlugAlias_locale_slug_key" ON "ProductSlugAlias"("locale", "slug");
CREATE INDEX "ProductSlugAlias_productId_idx" ON "ProductSlugAlias"("productId");
CREATE UNIQUE INDEX "ProductRecommendation_sourceProductId_sortOrder_key" ON "ProductRecommendation"("sourceProductId", "sortOrder");
CREATE INDEX "ProductRecommendation_targetProductId_idx" ON "ProductRecommendation"("targetProductId");
CREATE UNIQUE INDEX "StockNotification_activeKey_key" ON "StockNotification"("activeKey");
CREATE INDEX "StockNotification_productId_status_idx" ON "StockNotification"("productId", "status");
CREATE INDEX "StockNotification_emailNormalized_idx" ON "StockNotification"("emailNormalized");
CREATE UNIQUE INDEX "GoogleAdsConfiguration_productId_key" ON "GoogleAdsConfiguration"("productId");
CREATE INDEX "GoogleAdsConfiguration_status_idx" ON "GoogleAdsConfiguration"("status");

ALTER TABLE "Product" ADD CONSTRAINT "Product_salePriceCents_check" CHECK ("salePriceCents" IS NULL OR "salePriceCents" >= 0);
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_salePriceCents_check" CHECK ("salePriceCents" IS NULL OR "salePriceCents" >= 0);
ALTER TABLE "ProductRecommendation" ADD CONSTRAINT "ProductRecommendation_distinct_products_check" CHECK ("sourceProductId" <> "targetProductId");
ALTER TABLE "GoogleAdsConfiguration" ADD CONSTRAINT "GoogleAdsConfiguration_dailyBudgetMicros_check" CHECK ("dailyBudgetMicros" IS NULL OR "dailyBudgetMicros" > 0);

ALTER TABLE "ProductSlugAlias" ADD CONSTRAINT "ProductSlugAlias_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductRecommendation" ADD CONSTRAINT "ProductRecommendation_sourceProductId_fkey" FOREIGN KEY ("sourceProductId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductRecommendation" ADD CONSTRAINT "ProductRecommendation_targetProductId_fkey" FOREIGN KEY ("targetProductId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockNotification" ADD CONSTRAINT "StockNotification_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GoogleAdsConfiguration" ADD CONSTRAINT "GoogleAdsConfiguration_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
