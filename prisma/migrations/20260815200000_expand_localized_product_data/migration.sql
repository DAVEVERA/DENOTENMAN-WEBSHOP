-- Additive product content fields. The existing plain description remains the
-- rollback-safe representation while descriptionHtml stores sanitized rich text.
ALTER TABLE "ProductTranslation"
  ADD COLUMN "descriptionHtml" TEXT,
  ADD COLUMN "seoTitle" TEXT,
  ADD COLUMN "metaDescription" TEXT,
  ADD COLUMN "promotionText" TEXT;

-- Product/category membership owns both the primary marker and the product's
-- position inside that category.
ALTER TABLE "ProductCategory"
  ADD COLUMN "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

WITH ranked_positions AS (
  SELECT
    pc."productId",
    pc."categoryId",
    ROW_NUMBER() OVER (
      PARTITION BY pc."categoryId"
      ORDER BY product."createdAt", pc."productId"
    ) - 1 AS position
  FROM "ProductCategory" AS pc
  JOIN "Product" AS product ON product."id" = pc."productId"
)
UPDATE "ProductCategory" AS pc
SET "sortOrder" = ranked_positions.position
FROM ranked_positions
WHERE pc."productId" = ranked_positions."productId"
  AND pc."categoryId" = ranked_positions."categoryId";

WITH ranked_primary AS (
  SELECT
    pc."productId",
    pc."categoryId",
    ROW_NUMBER() OVER (
      PARTITION BY pc."productId"
      ORDER BY
        CASE category."type" WHEN 'STANDARD' THEN 0 ELSE 1 END,
        category."sortOrder",
        pc."categoryId"
    ) AS position
  FROM "ProductCategory" AS pc
  JOIN "Category" AS category ON category."id" = pc."categoryId"
)
UPDATE "ProductCategory" AS pc
SET "isPrimary" = true
FROM ranked_primary
WHERE pc."productId" = ranked_primary."productId"
  AND pc."categoryId" = ranked_primary."categoryId"
  AND ranked_primary.position = 1;

CREATE INDEX "ProductCategory_categoryId_sortOrder_idx"
  ON "ProductCategory"("categoryId", "sortOrder");
CREATE INDEX "ProductCategory_productId_isPrimary_idx"
  ON "ProductCategory"("productId", "isPrimary");
CREATE UNIQUE INDEX "ProductCategory_one_primary_per_product_key"
  ON "ProductCategory"("productId")
  WHERE "isPrimary" = true;

-- Preflight before enforcing deterministic key/value upserts. Abort without
-- changing duplicate rows so catalog data is never silently discarded.
DO $$
DECLARE
  duplicate_groups INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO duplicate_groups
  FROM (
    SELECT "productId", "key"
    FROM "ProductAttribute"
    GROUP BY "productId", "key"
    HAVING COUNT(*) > 1
  ) AS duplicates;

  IF duplicate_groups > 0 THEN
    RAISE EXCEPTION USING
      MESSAGE = format(
        'ProductAttribute unique-index preflight failed: %s duplicate (productId, key) group(s) require manual resolution',
        duplicate_groups
      ),
      ERRCODE = '23505';
  END IF;
END $$;

CREATE UNIQUE INDEX "ProductAttribute_productId_key_key"
  ON "ProductAttribute"("productId", "key");
