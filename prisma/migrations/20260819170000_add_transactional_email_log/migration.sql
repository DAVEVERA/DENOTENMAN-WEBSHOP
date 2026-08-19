-- CreateEnum
CREATE TYPE "EmailDeliveryKind" AS ENUM ('ORDER_CONFIRMATION', 'ORDER_FULFILLED', 'AFTERSALES_TEST', 'BACK_IN_STOCK');

-- CreateEnum
CREATE TYPE "EmailDeliveryStatus" AS ENUM ('PENDING', 'ACCEPTED', 'FAILED');

-- CreateEnum
CREATE TYPE "EmailDeliveryAttemptStatus" AS ENUM ('STARTED', 'ACCEPTED', 'FAILED');

-- CreateTable
CREATE TABLE "EmailDeliveryLog" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "kind" "EmailDeliveryKind" NOT NULL,
    "status" "EmailDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "recipientEmail" TEXT NOT NULL,
    "recipientName" TEXT,
    "subject" TEXT NOT NULL,
    "htmlBody" TEXT NOT NULL,
    "textBody" TEXT NOT NULL,
    "provider" TEXT,
    "providerMessageId" TEXT,
    "providerStatus" TEXT,
    "orderId" TEXT,
    "trigger" "AftersalesTrigger",
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "lastAttemptAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailDeliveryLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailDeliveryAttempt" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "provider" TEXT NOT NULL,
    "status" "EmailDeliveryAttemptStatus" NOT NULL DEFAULT 'STARTED',
    "providerMessageId" TEXT,
    "providerStatus" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "EmailDeliveryAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmailDeliveryLog_idempotencyKey_key" ON "EmailDeliveryLog"("idempotencyKey");

-- CreateIndex
CREATE INDEX "EmailDeliveryLog_status_createdAt_idx" ON "EmailDeliveryLog"("status", "createdAt");

-- CreateIndex
CREATE INDEX "EmailDeliveryLog_kind_createdAt_idx" ON "EmailDeliveryLog"("kind", "createdAt");

-- CreateIndex
CREATE INDEX "EmailDeliveryLog_orderId_createdAt_idx" ON "EmailDeliveryLog"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "EmailDeliveryLog_recipientEmail_createdAt_idx" ON "EmailDeliveryLog"("recipientEmail", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmailDeliveryAttempt_deliveryId_attemptNumber_key" ON "EmailDeliveryAttempt"("deliveryId", "attemptNumber");

-- CreateIndex
CREATE INDEX "EmailDeliveryAttempt_status_startedAt_idx" ON "EmailDeliveryAttempt"("status", "startedAt");

-- AddForeignKey
ALTER TABLE "EmailDeliveryLog" ADD CONSTRAINT "EmailDeliveryLog_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailDeliveryAttempt" ADD CONSTRAINT "EmailDeliveryAttempt_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "EmailDeliveryLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;
