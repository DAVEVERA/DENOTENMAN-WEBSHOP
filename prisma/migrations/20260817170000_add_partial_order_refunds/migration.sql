-- Additive refund ledger for idempotent partial order cancellations and Mollie refunds.
CREATE TYPE "OrderRefundStatus" AS ENUM (
  'CREATING',
  'QUEUED',
  'PENDING',
  'PROCESSING',
  'REFUNDED',
  'FAILED',
  'CANCELED'
);

CREATE TABLE "OrderRefund" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "requestedByAdminUserId" TEXT NOT NULL,
  "mollieRefundId" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "reason" TEXT,
  "includesShipping" BOOLEAN NOT NULL DEFAULT false,
  "status" "OrderRefundStatus" NOT NULL DEFAULT 'CREATING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "OrderRefund_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrderRefundItem" (
  "refundId" TEXT NOT NULL,
  "orderItemId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "grossAmountCents" INTEGER NOT NULL,

  CONSTRAINT "OrderRefundItem_pkey" PRIMARY KEY ("refundId", "orderItemId")
);

CREATE UNIQUE INDEX "OrderRefund_mollieRefundId_key" ON "OrderRefund"("mollieRefundId");
CREATE UNIQUE INDEX "OrderRefund_idempotencyKey_key" ON "OrderRefund"("idempotencyKey");
CREATE INDEX "OrderRefund_orderId_status_idx" ON "OrderRefund"("orderId", "status");
CREATE INDEX "OrderRefund_requestedByAdminUserId_idx" ON "OrderRefund"("requestedByAdminUserId");
CREATE INDEX "OrderRefundItem_orderItemId_idx" ON "OrderRefundItem"("orderItemId");

ALTER TABLE "OrderRefund"
  ADD CONSTRAINT "OrderRefund_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrderRefund"
  ADD CONSTRAINT "OrderRefund_requestedByAdminUserId_fkey"
  FOREIGN KEY ("requestedByAdminUserId") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OrderRefundItem"
  ADD CONSTRAINT "OrderRefundItem_refundId_fkey"
  FOREIGN KEY ("refundId") REFERENCES "OrderRefund"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrderRefundItem"
  ADD CONSTRAINT "OrderRefundItem_orderItemId_fkey"
  FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
