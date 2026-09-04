ALTER TYPE "BusinessEventType" ADD VALUE 'ORDER_CANCELLATION_REQUESTED';

-- Under the previous workflow PAID and CANCELLED closed the reusable list.
-- They now describe concrete Order rows, so reopen existing fixed lists
-- without sending mail or changing their saved products and prices.
UPDATE "BusinessOrderList"
SET "status" = 'SENT'
WHERE "status" IN ('PAID', 'CANCELLED');

CREATE TYPE "BusinessCancellationRequestStatus" AS ENUM ('PENDING', 'PROCESSED', 'REJECTED');

CREATE TABLE "BusinessOrderCancellationRequest" (
  "id" TEXT NOT NULL,
  "businessAccountId" TEXT NOT NULL,
  "orderListId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "status" "BusinessCancellationRequestStatus" NOT NULL DEFAULT 'PENDING',
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BusinessOrderCancellationRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BusinessOrderCancellationRequestItem" (
  "requestId" TEXT NOT NULL,
  "orderItemId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  CONSTRAINT "BusinessOrderCancellationRequestItem_pkey" PRIMARY KEY ("requestId", "orderItemId")
);

CREATE INDEX "BusinessOrderCancellationRequest_businessAccountId_createdAt_idx" ON "BusinessOrderCancellationRequest"("businessAccountId", "createdAt");
CREATE INDEX "BusinessOrderCancellationRequest_orderListId_createdAt_idx" ON "BusinessOrderCancellationRequest"("orderListId", "createdAt");
CREATE INDEX "BusinessOrderCancellationRequest_orderId_status_idx" ON "BusinessOrderCancellationRequest"("orderId", "status");
CREATE INDEX "BusinessOrderCancellationRequestItem_orderItemId_idx" ON "BusinessOrderCancellationRequestItem"("orderItemId");

ALTER TABLE "BusinessOrderCancellationRequest" ADD CONSTRAINT "BusinessOrderCancellationRequest_businessAccountId_fkey" FOREIGN KEY ("businessAccountId") REFERENCES "BusinessAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BusinessOrderCancellationRequest" ADD CONSTRAINT "BusinessOrderCancellationRequest_orderListId_fkey" FOREIGN KEY ("orderListId") REFERENCES "BusinessOrderList"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BusinessOrderCancellationRequest" ADD CONSTRAINT "BusinessOrderCancellationRequest_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BusinessOrderCancellationRequestItem" ADD CONSTRAINT "BusinessOrderCancellationRequestItem_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "BusinessOrderCancellationRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BusinessOrderCancellationRequestItem" ADD CONSTRAINT "BusinessOrderCancellationRequestItem_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BusinessOrderCancellationRequestItem" ADD CONSTRAINT "BusinessOrderCancellationRequestItem_quantity_positive" CHECK ("quantity" > 0);
