-- Add an independent processing ledger; existing image keys remain unchanged.
CREATE TYPE "ProductImageProcessingStatus" AS ENUM (
  'SUCCEEDED',
  'NEEDS_MANUAL_REVIEW',
  'FAILED'
);

CREATE TABLE "ProductImageProcessing" (
  "id" TEXT NOT NULL,
  "productImageId" TEXT NOT NULL,
  "originalStorageKey" TEXT NOT NULL,
  "sourceSha256" TEXT,
  "sourceGeneration" TEXT,
  "status" "ProductImageProcessingStatus" NOT NULL,
  "processingVersion" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "masterWebpKey" TEXT,
  "thumbnailWebpKey" TEXT,
  "thumbnailAvifKey" TEXT,
  "cardWebpKey" TEXT,
  "cardAvifKey" TEXT,
  "productWebpKey" TEXT,
  "productAvifKey" TEXT,
  "detectedCenterX" DOUBLE PRECISION,
  "detectedCenterY" DOUBLE PRECISION,
  "detectedRadius" DOUBLE PRECISION,
  "detectedConfidence" DOUBLE PRECISION,
  "marginRatio" DOUBLE PRECISION,
  "cropLeft" INTEGER,
  "cropTop" INTEGER,
  "cropSize" INTEGER,
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "details" JSONB,
  "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ProductImageProcessing_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProductImageProcessing_succeeded_outputs_check" CHECK (
    "status" <> 'SUCCEEDED'
    OR (
      "masterWebpKey" IS NOT NULL
      AND "thumbnailWebpKey" IS NOT NULL
      AND "thumbnailAvifKey" IS NOT NULL
      AND "cardWebpKey" IS NOT NULL
      AND "cardAvifKey" IS NOT NULL
      AND "productWebpKey" IS NOT NULL
      AND "productAvifKey" IS NOT NULL
    )
  )
);

CREATE UNIQUE INDEX "ProductImageProcessing_productImageId_processingVersion_key"
  ON "ProductImageProcessing"("productImageId", "processingVersion");
CREATE INDEX "ProductImageProcessing_status_processingVersion_idx"
  ON "ProductImageProcessing"("status", "processingVersion");
CREATE INDEX "ProductImageProcessing_processingVersion_sourceSha256_idx"
  ON "ProductImageProcessing"("processingVersion", "sourceSha256");

ALTER TABLE "ProductImageProcessing"
  ADD CONSTRAINT "ProductImageProcessing_productImageId_fkey"
  FOREIGN KEY ("productImageId") REFERENCES "ProductImage"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
