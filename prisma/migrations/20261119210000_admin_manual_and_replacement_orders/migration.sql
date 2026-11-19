CREATE TYPE "OrderOrigin" AS ENUM ('STOREFRONT', 'MANUAL', 'REPLACEMENT');

ALTER TABLE "Order"
  ADD COLUMN "origin" "OrderOrigin" NOT NULL DEFAULT 'STOREFRONT',
  ADD COLUMN "originalOrderId" TEXT,
  ADD COLUMN "adminNote" TEXT,
  ADD COLUMN "externallyPaidAt" TIMESTAMP(3),
  ADD COLUMN "adminCreationKey" TEXT;

CREATE UNIQUE INDEX "Order_adminCreationKey_key" ON "Order"("adminCreationKey");

CREATE INDEX "Order_originalOrderId_idx" ON "Order"("originalOrderId");
CREATE INDEX "Order_origin_createdAt_idx" ON "Order"("origin", "createdAt");

ALTER TABLE "Order"
  ADD CONSTRAINT "Order_originalOrderId_fkey"
  FOREIGN KEY ("originalOrderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TYPE "MarketingBannerPlacement" ADD VALUE IF NOT EXISTS 'PAGE';
CREATE TYPE "MarketingBannerSlot" AS ENUM ('TOP', 'BOTTOM');
ALTER TABLE "MarketingBanner"
  ADD COLUMN "targetPath" TEXT,
  ADD COLUMN "slot" "MarketingBannerSlot" NOT NULL DEFAULT 'TOP',
  ADD COLUMN "isPublished" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Product" ADD COLUMN "isSoldOut" BOOLEAN NOT NULL DEFAULT false;
