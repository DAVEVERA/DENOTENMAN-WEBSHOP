-- DropIndex
DROP INDEX "Order_businessOrderListId_key";

-- AlterTable
ALTER TABLE "BusinessOrderListItem" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "Order_businessOrderListId_idx" ON "Order"("businessOrderListId");

-- Partial unique index: Prisma's schema DSL cannot express a WHERE-scoped
-- unique constraint, so it is added here directly. A business order list is
-- now continuous and accumulates many Orders over time (one per checkout
-- round), so the old full-column uniqueness on businessOrderListId is gone
-- (see DropIndex above) — but at most one *PENDING* order per list must
-- still be enforced, or a double-checkout race could create two concurrent
-- Mollie payments for the same round.
CREATE UNIQUE INDEX "Order_pending_business_order_list_unique" ON "Order"("businessOrderListId") WHERE status = 'PENDING' AND "businessOrderListId" IS NOT NULL;
