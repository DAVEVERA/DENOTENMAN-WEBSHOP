-- Review requests: a manually sent mail that points customers at the Google
-- review form, plus the daily rating snapshot that backs the analysis.
-- Both enum values are additive, so existing rows keep their values.

-- AlterEnum
ALTER TYPE "AftersalesTrigger" ADD VALUE IF NOT EXISTS 'REVIEW_REQUEST';

-- AlterEnum
ALTER TYPE "EmailDeliveryKind" ADD VALUE IF NOT EXISTS 'REVIEW_REQUEST';

-- CreateTable
CREATE TABLE "GoogleReviewSnapshot" (
    "id" TEXT NOT NULL,
    "capturedOn" DATE NOT NULL,
    "rating" DOUBLE PRECISION NOT NULL,
    "reviewCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoogleReviewSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GoogleReviewSnapshot_capturedOn_key" ON "GoogleReviewSnapshot"("capturedOn");

-- CreateIndex
CREATE INDEX "GoogleReviewSnapshot_capturedOn_idx" ON "GoogleReviewSnapshot"("capturedOn");
