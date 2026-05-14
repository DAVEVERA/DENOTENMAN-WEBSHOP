-- Intent: Add missing FK indexes, revokedAt index for token invalidation, and
--         full-text search via tsvector generated column + GIN index on Product.
--
-- Rollback: See ROLLBACK.md in this directory.
--
-- Safe to run on a live database:
--   - All CREATE INDEX CONCURRENTLY can be added without a table lock.
--   - The tsvector column uses ALTER TABLE … ADD COLUMN which acquires an ACCESS
--     EXCLUSIVE lock for a short period; the GIN index is built CONCURRENTLY.
--   - The trigger is created with CREATE OR REPLACE — idempotent.

-- CartLine: index on variantId and productId (FK reverse-lookup)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "CartLine_variantId_idx" ON "CartLine"("variantId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "CartLine_productId_idx" ON "CartLine"("productId");

-- OrderLine: index on variantId and productId (FK reverse-lookup)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "OrderLine_variantId_idx" ON "OrderLine"("variantId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "OrderLine_productId_idx" ON "OrderLine"("productId");

-- Order: index on shippingAddressId and billingAddressId (FK reverse-lookup)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Order_shippingAddressId_idx" ON "Order"("shippingAddressId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Order_billingAddressId_idx" ON "Order"("billingAddressId");

-- RefreshToken: index on revokedAt (used in revokeAllForUser WHERE revokedAt IS NULL)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "RefreshToken_revokedAt_idx" ON "RefreshToken"("revokedAt");

-- ============================================================================
-- Full-text search on Product
-- ============================================================================

-- Add the generated tsvector column (Postgres 12+ generated columns are not
-- supported as GENERATED ALWAYS by Prisma, so we use a plain nullable column
-- maintained by a trigger instead).
ALTER TABLE "Product"
  ADD COLUMN IF NOT EXISTS "searchVector" tsvector;

-- Backfill existing rows.
UPDATE "Product"
SET "searchVector" = to_tsvector(
  'dutch',
  coalesce("name", '') || ' ' ||
  coalesce("description", '') || ' ' ||
  coalesce("tasteNotes", '') || ' ' ||
  coalesce("usageTip", '') || ' ' ||
  coalesce("origin", '') || ' ' ||
  coalesce(array_to_string("allergens", ' '), '')
);

-- Trigger function: keeps searchVector in sync on INSERT/UPDATE.
CREATE OR REPLACE FUNCTION product_search_vector_update()
RETURNS trigger AS $$
BEGIN
  NEW."searchVector" := to_tsvector(
    'dutch',
    coalesce(NEW."name", '') || ' ' ||
    coalesce(NEW."description", '') || ' ' ||
    coalesce(NEW."tasteNotes", '') || ' ' ||
    coalesce(NEW."usageTip", '') || ' ' ||
    coalesce(NEW."origin", '') || ' ' ||
    coalesce(array_to_string(NEW."allergens", ' '), '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger (drop first for idempotency).
DROP TRIGGER IF EXISTS product_search_vector_trigger ON "Product";
CREATE TRIGGER product_search_vector_trigger
  BEFORE INSERT OR UPDATE OF "name", "description", "tasteNotes", "usageTip", "origin", "allergens"
  ON "Product"
  FOR EACH ROW
  EXECUTE FUNCTION product_search_vector_update();

-- GIN index for fast full-text queries (CONCURRENTLY avoids table lock).
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Product_searchVector_idx" ON "Product" USING GIN ("searchVector");
