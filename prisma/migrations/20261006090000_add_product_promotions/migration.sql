-- CreateEnum
CREATE TYPE "PromotionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PromotionKind" AS ENUM ('PRICE', 'VOLUME', 'LOYALTY', 'LABEL');

-- CreateEnum
CREATE TYPE "PromotionDiscountType" AS ENUM ('PERCENT', 'AMOUNT_OFF', 'FIXED_PRICE');

-- CreateEnum
CREATE TYPE "PromotionScope" AS ENUM ('ALL', 'PRODUCTS', 'CATEGORIES');

-- CreateEnum
CREATE TYPE "PromotionVolumeScope" AS ENUM ('LINE', 'PRODUCT', 'PROMOTION');

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "promotionLabel" TEXT,
ADD COLUMN     "regularUnitPriceCents" INTEGER;

-- CreateTable
CREATE TABLE "Promotion" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "PromotionKind" NOT NULL,
    "status" "PromotionStatus" NOT NULL DEFAULT 'DRAFT',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "discountType" "PromotionDiscountType",
    "discountValue" INTEGER,
    "variantPrices" JSONB,
    "volumeTiers" JSONB,
    "volumeScope" "PromotionVolumeScope",
    "loyaltyMinOrders" INTEGER,
    "newWithinDays" INTEGER,
    "stackWithVolume" BOOLEAN NOT NULL DEFAULT false,
    "allowDiscountCodes" BOOLEAN NOT NULL DEFAULT true,
    "scope" "PromotionScope" NOT NULL DEFAULT 'PRODUCTS',
    "productIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "categoryIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "excludedProductIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "weekdays" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "dailyStartMinute" INTEGER,
    "dailyEndMinute" INTEGER,
    "badge" JSONB NOT NULL,
    "createdByAdminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Promotion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Promotion_status_endsAt_idx" ON "Promotion"("status", "endsAt");

