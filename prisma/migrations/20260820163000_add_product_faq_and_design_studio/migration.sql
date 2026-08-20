-- Additive FAQ and Design Studio persistence. Existing product/order data is untouched.
CREATE TYPE "ProductFaqStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'HIDDEN');
CREATE TYPE "ProductFaqPlacement" AS ENUM ('BELOW_DESCRIPTION', 'BELOW_PRODUCT_DETAILS', 'BEFORE_REVIEWS', 'PAGE_BOTTOM');
CREATE TYPE "ProductFaqMediaType" AS ENUM ('IMAGE', 'INFOGRAPHIC', 'INSTRUCTION');
CREATE TYPE "DesignProvider" AS ENUM ('PHOTOROOM');
CREATE TYPE "DesignJobStatus" AS ENUM ('QUEUED', 'PROCESSING', 'SUCCEEDED', 'FAILED');
CREATE TYPE "DesignAssetStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'DISCARDED');

CREATE TABLE "ProductFaqSet" (
  "id" TEXT NOT NULL, "productId" TEXT NOT NULL, "aggregateRevision" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProductFaqSet_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProductFaqSet_revision_check" CHECK ("aggregateRevision" >= 0)
);
CREATE UNIQUE INDEX "ProductFaqSet_productId_key" ON "ProductFaqSet"("productId");

CREATE TABLE "ProductFaqMediaAsset" (
  "id" TEXT NOT NULL, "productId" TEXT NOT NULL, "type" "ProductFaqMediaType" NOT NULL,
  "storageKey" TEXT NOT NULL, "originalFilename" TEXT NOT NULL, "contentType" TEXT NOT NULL,
  "fileSize" INTEGER NOT NULL, "width" INTEGER, "height" INTEGER, "pageCount" INTEGER, "durationMs" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "deletedAt" TIMESTAMP(3),
  CONSTRAINT "ProductFaqMediaAsset_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProductFaqMediaAsset_metadata_check" CHECK (
    "fileSize" > 0 AND ("width" IS NULL OR "width" > 0) AND ("height" IS NULL OR "height" > 0)
    AND ("pageCount" IS NULL OR ("pageCount" > 0 AND "pageCount" <= 50)) AND ("durationMs" IS NULL OR "durationMs" > 0)
  )
);
CREATE UNIQUE INDEX "ProductFaqMediaAsset_storageKey_key" ON "ProductFaqMediaAsset"("storageKey");
CREATE INDEX "ProductFaqMediaAsset_productId_deletedAt_idx" ON "ProductFaqMediaAsset"("productId", "deletedAt");

CREATE TABLE "ProductFaqItem" (
  "id" TEXT NOT NULL, "faqSetId" TEXT NOT NULL, "status" "ProductFaqStatus" NOT NULL DEFAULT 'DRAFT',
  "placement" "ProductFaqPlacement" NOT NULL DEFAULT 'BELOW_PRODUCT_DETAILS', "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "version" INTEGER NOT NULL DEFAULT 0, "draftRevisionId" TEXT, "publishedRevisionId" TEXT, "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProductFaqItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProductFaqItem_order_version_check" CHECK ("sortOrder" >= 0 AND "version" >= 0),
  CONSTRAINT "ProductFaqItem_published_pointer_check" CHECK ("status" <> 'PUBLISHED' OR "publishedRevisionId" IS NOT NULL)
);
CREATE UNIQUE INDEX "ProductFaqItem_draftRevisionId_key" ON "ProductFaqItem"("draftRevisionId");
CREATE UNIQUE INDEX "ProductFaqItem_publishedRevisionId_key" ON "ProductFaqItem"("publishedRevisionId");
CREATE INDEX "ProductFaqItem_faqSetId_deletedAt_placement_sortOrder_idx" ON "ProductFaqItem"("faqSetId", "deletedAt", "placement", "sortOrder");
CREATE INDEX "ProductFaqItem_faqSetId_status_placement_sortOrder_idx" ON "ProductFaqItem"("faqSetId", "status", "placement", "sortOrder");

CREATE TABLE "ProductFaqRevision" (
  "id" TEXT NOT NULL, "itemId" TEXT NOT NULL, "revision" INTEGER NOT NULL, "mediaAssetId" TEXT,
  "createdById" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductFaqRevision_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProductFaqRevision_revision_check" CHECK ("revision" > 0)
);
CREATE UNIQUE INDEX "ProductFaqRevision_itemId_revision_key" ON "ProductFaqRevision"("itemId", "revision");
CREATE INDEX "ProductFaqRevision_mediaAssetId_idx" ON "ProductFaqRevision"("mediaAssetId");

CREATE TABLE "ProductFaqTranslation" (
  "id" TEXT NOT NULL, "revisionId" TEXT NOT NULL, "locale" "Locale" NOT NULL,
  "question" TEXT NOT NULL, "answerHtml" TEXT NOT NULL, "mediaLabel" TEXT,
  CONSTRAINT "ProductFaqTranslation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProductFaqTranslation_content_check" CHECK (length(btrim("question")) > 0 AND length(btrim("answerHtml")) > 0)
);
CREATE UNIQUE INDEX "ProductFaqTranslation_revisionId_locale_key" ON "ProductFaqTranslation"("revisionId", "locale");

CREATE TABLE "ProductFaqMutation" (
  "id" TEXT NOT NULL, "faqSetId" TEXT NOT NULL, "idempotencyKey" TEXT NOT NULL, "operation" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL, "itemId" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductFaqMutation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProductFaqMutation_request_hash_check" CHECK ("requestHash" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "ProductFaqMutation_target_check" CHECK (
    ("operation" = 'REORDER' AND "itemId" IS NULL)
    OR ("operation" IN ('CREATE', 'SAVE_DRAFT', 'PUBLISH', 'HIDE', 'UNPUBLISH', 'DELETE', 'ATTACH_MEDIA', 'DETACH_MEDIA') AND "itemId" IS NOT NULL)
  )
);
CREATE UNIQUE INDEX "ProductFaqMutation_faqSetId_idempotencyKey_key" ON "ProductFaqMutation"("faqSetId", "idempotencyKey");
CREATE INDEX "ProductFaqMutation_createdAt_idx" ON "ProductFaqMutation"("createdAt");

CREATE TABLE "DesignJob" (
  "id" TEXT NOT NULL, "productId" TEXT NOT NULL, "sourceImageId" TEXT NOT NULL, "requestedByAdminUserId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL, "provider" "DesignProvider" NOT NULL DEFAULT 'PHOTOROOM',
  "status" "DesignJobStatus" NOT NULL DEFAULT 'QUEUED', "options" JSONB NOT NULL, "providerRequestId" TEXT,
  "errorCode" TEXT, "errorMessage" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DesignJob_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DesignJob_idempotencyKey_key" ON "DesignJob"("idempotencyKey");
CREATE INDEX "DesignJob_productId_createdAt_idx" ON "DesignJob"("productId", "createdAt");
CREATE INDEX "DesignJob_status_createdAt_idx" ON "DesignJob"("status", "createdAt");

CREATE TABLE "DesignAsset" (
  "id" TEXT NOT NULL, "jobId" TEXT NOT NULL, "productId" TEXT NOT NULL, "sourceImageId" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL, "contentType" TEXT NOT NULL, "width" INTEGER NOT NULL, "height" INTEGER NOT NULL,
  "fileSize" INTEGER NOT NULL, "status" "DesignAssetStatus" NOT NULL DEFAULT 'DRAFT', "productImageId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DesignAsset_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DesignAsset_dimensions_check" CHECK ("width" > 0 AND "height" > 0 AND "fileSize" > 0)
);
CREATE UNIQUE INDEX "DesignAsset_storageKey_key" ON "DesignAsset"("storageKey");
CREATE UNIQUE INDEX "DesignAsset_productImageId_key" ON "DesignAsset"("productImageId");
CREATE INDEX "DesignAsset_productId_status_createdAt_idx" ON "DesignAsset"("productId", "status", "createdAt");

CREATE TABLE "DesignProviderUsage" (
  "id" TEXT NOT NULL, "dayKey" TEXT NOT NULL, "provider" "DesignProvider" NOT NULL, "attempts" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DesignProviderUsage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DesignProviderUsage_attempts_check" CHECK ("attempts" >= 0 AND "attempts" <= 25)
);
CREATE UNIQUE INDEX "DesignProviderUsage_dayKey_provider_key" ON "DesignProviderUsage"("dayKey", "provider");

ALTER TABLE "ProductFaqSet" ADD CONSTRAINT "ProductFaqSet_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductFaqMediaAsset" ADD CONSTRAINT "ProductFaqMediaAsset_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductFaqItem" ADD CONSTRAINT "ProductFaqItem_faqSetId_fkey" FOREIGN KEY ("faqSetId") REFERENCES "ProductFaqSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductFaqRevision" ADD CONSTRAINT "ProductFaqRevision_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ProductFaqItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductFaqRevision" ADD CONSTRAINT "ProductFaqRevision_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "ProductFaqMediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProductFaqRevision" ADD CONSTRAINT "ProductFaqRevision_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductFaqItem" ADD CONSTRAINT "ProductFaqItem_draftRevisionId_fkey" FOREIGN KEY ("draftRevisionId") REFERENCES "ProductFaqRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProductFaqItem" ADD CONSTRAINT "ProductFaqItem_publishedRevisionId_fkey" FOREIGN KEY ("publishedRevisionId") REFERENCES "ProductFaqRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProductFaqTranslation" ADD CONSTRAINT "ProductFaqTranslation_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "ProductFaqRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductFaqMutation" ADD CONSTRAINT "ProductFaqMutation_faqSetId_fkey" FOREIGN KEY ("faqSetId") REFERENCES "ProductFaqSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DesignJob" ADD CONSTRAINT "DesignJob_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DesignJob" ADD CONSTRAINT "DesignJob_sourceImageId_fkey" FOREIGN KEY ("sourceImageId") REFERENCES "ProductImage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DesignJob" ADD CONSTRAINT "DesignJob_requestedByAdminUserId_fkey" FOREIGN KEY ("requestedByAdminUserId") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DesignAsset" ADD CONSTRAINT "DesignAsset_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "DesignJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DesignAsset" ADD CONSTRAINT "DesignAsset_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DesignAsset" ADD CONSTRAINT "DesignAsset_sourceImageId_fkey" FOREIGN KEY ("sourceImageId") REFERENCES "ProductImage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DesignAsset" ADD CONSTRAINT "DesignAsset_productImageId_fkey" FOREIGN KEY ("productImageId") REFERENCES "ProductImage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- A pointer can only reference a revision belonging to the same FAQ item.
CREATE FUNCTION product_faq_validate_revision_pointer() RETURNS trigger AS $$
DECLARE
  revision_belongs BOOLEAN;
BEGIN
  IF NEW."draftRevisionId" IS NOT NULL THEN
    EXECUTE format(
      'SELECT EXISTS (SELECT 1 FROM %I."ProductFaqRevision" r WHERE r."id" = $1 AND r."itemId" = $2)',
      TG_TABLE_SCHEMA
    ) INTO revision_belongs USING NEW."draftRevisionId", NEW."id";
    IF NOT revision_belongs THEN
      RAISE EXCEPTION 'draft revision does not belong to FAQ item';
    END IF;
  END IF;
  IF NEW."publishedRevisionId" IS NOT NULL THEN
    EXECUTE format(
      'SELECT EXISTS (SELECT 1 FROM %I."ProductFaqRevision" r WHERE r."id" = $1 AND r."itemId" = $2)',
      TG_TABLE_SCHEMA
    ) INTO revision_belongs USING NEW."publishedRevisionId", NEW."id";
    IF NOT revision_belongs THEN
      RAISE EXCEPTION 'published revision does not belong to FAQ item';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE CONSTRAINT TRIGGER "ProductFaqItem_revision_pointer_guard"
AFTER INSERT OR UPDATE OF "draftRevisionId", "publishedRevisionId" ON "ProductFaqItem"
DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION product_faq_validate_revision_pointer();
