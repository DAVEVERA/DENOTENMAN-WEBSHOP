Rollback:

1. Drop the GIN index:
   DROP INDEX IF EXISTS "Product_searchVector_idx";

2. Drop the trigger and function:
   DROP TRIGGER IF EXISTS product_search_vector_trigger ON "Product";
   DROP FUNCTION IF EXISTS product_search_vector_update();

3. Drop the tsvector column:
   ALTER TABLE "Product" DROP COLUMN IF EXISTS "searchVector";

4. Drop the FK and revokedAt indexes:
   DROP INDEX IF EXISTS "CartLine_variantId_idx";
   DROP INDEX IF EXISTS "CartLine_productId_idx";
   DROP INDEX IF EXISTS "OrderLine_variantId_idx";
   DROP INDEX IF EXISTS "OrderLine_productId_idx";
   DROP INDEX IF EXISTS "Order_shippingAddressId_idx";
   DROP INDEX IF EXISTS "Order_billingAddressId_idx";
   DROP INDEX IF EXISTS "RefreshToken_revokedAt_idx";

Data loss: none. All operations are additive (indexes + column + trigger).
Duration estimate (empty dev DB): < 1 second. On a large production table the
CONCURRENTLY index builds will take longer but will not block reads or writes.
