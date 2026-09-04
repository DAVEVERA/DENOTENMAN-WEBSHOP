-- Existing discount rows deliberately inherit SINGLE_USE / EMAIL / 1.
-- This makes current admin-created codes one-time per normalized email too.
CREATE TYPE "DiscountRedemptionMode" AS ENUM ('SINGLE_USE', 'MULTIPLE_USE');
CREATE TYPE "DiscountIdentityScope" AS ENUM ('EMAIL', 'CUSTOMER', 'EMAIL_AND_CUSTOMER');
CREATE TYPE "DiscountRedemptionStatus" AS ENUM ('RESERVED', 'REDEEMED', 'RELEASED');

ALTER TABLE "Discount"
ADD COLUMN "minimumOrderCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "maximumDiscountCents" INTEGER,
ADD COLUMN "redemptionMode" "DiscountRedemptionMode" NOT NULL DEFAULT 'SINGLE_USE',
ADD COLUMN "identityScope" "DiscountIdentityScope" NOT NULL DEFAULT 'EMAIL',
ADD COLUMN "maxUsesPerIdentity" INTEGER DEFAULT 1;

CREATE TABLE "DiscountUsageCounter" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "identityKey" TEXT NOT NULL,
  "usageCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DiscountUsageCounter_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DiscountRedemption" (
  "id" TEXT NOT NULL,
  "counterId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "status" "DiscountRedemptionStatus" NOT NULL DEFAULT 'RESERVED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DiscountRedemption_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DiscountUsageCounter_code_identityKey_key" ON "DiscountUsageCounter"("code", "identityKey");
CREATE INDEX "DiscountUsageCounter_code_usageCount_idx" ON "DiscountUsageCounter"("code", "usageCount");
CREATE UNIQUE INDEX "DiscountRedemption_orderId_key" ON "DiscountRedemption"("orderId");
CREATE INDEX "DiscountRedemption_counterId_status_idx" ON "DiscountRedemption"("counterId", "status");

ALTER TABLE "DiscountRedemption"
ADD CONSTRAINT "DiscountRedemption_counterId_fkey"
FOREIGN KEY ("counterId") REFERENCES "DiscountUsageCounter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DiscountRedemption"
ADD CONSTRAINT "DiscountRedemption_orderId_fkey"
FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Discount" ADD CONSTRAINT "Discount_minimumOrderCents_nonnegative" CHECK ("minimumOrderCents" >= 0);
ALTER TABLE "Discount" ADD CONSTRAINT "Discount_maximumDiscountCents_positive" CHECK ("maximumDiscountCents" IS NULL OR "maximumDiscountCents" > 0);
ALTER TABLE "Discount" ADD CONSTRAINT "Discount_maxUsesPerIdentity_positive" CHECK ("maxUsesPerIdentity" IS NULL OR "maxUsesPerIdentity" > 0);
ALTER TABLE "DiscountUsageCounter" ADD CONSTRAINT "DiscountUsageCounter_usageCount_nonnegative" CHECK ("usageCount" >= 0);
