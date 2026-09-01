-- CreateEnum
CREATE TYPE "BusinessVatRegime" AS ENUM ('STANDARD', 'REVERSE_CHARGE');

-- CreateEnum
CREATE TYPE "InvoiceRecipientType" AS ENUM ('CUSTOMER', 'MERCHANT');

-- CreateEnum
CREATE TYPE "InvoicePeppolStatus" AS ENUM ('NOT_APPLICABLE', 'PENDING', 'SENT', 'FAILED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "BusinessEventType" ADD VALUE 'ORDER_LIST_ITEMS_UPDATED';
ALTER TYPE "BusinessEventType" ADD VALUE 'ORDER_LIST_DELETED';
ALTER TYPE "BusinessEventType" ADD VALUE 'ORDER_LIST_CHECKOUT_STARTED';
ALTER TYPE "BusinessEventType" ADD VALUE 'ORDER_LIST_PAID';
ALTER TYPE "BusinessEventType" ADD VALUE 'INVOICE_GENERATED';
ALTER TYPE "BusinessEventType" ADD VALUE 'INVOICE_SENT';
ALTER TYPE "BusinessEventType" ADD VALUE 'INVOICE_PEPPOL_SENT';
ALTER TYPE "BusinessEventType" ADD VALUE 'INVOICE_PEPPOL_FAILED';

-- AlterEnum
ALTER TYPE "BusinessOrderListStatus" ADD VALUE 'PAID';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EmailDeliveryKind" ADD VALUE 'BUSINESS_INVITATION';
ALTER TYPE "EmailDeliveryKind" ADD VALUE 'BUSINESS_ORDER_LIST_CHANGED';
ALTER TYPE "EmailDeliveryKind" ADD VALUE 'BUSINESS_INVOICE';

-- AlterTable
ALTER TABLE "BusinessAccount" ADD COLUMN     "country" TEXT NOT NULL DEFAULT 'NL',
ADD COLUMN     "kvkNumber" TEXT,
ADD COLUMN     "peppolConfigured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "shadowUserId" TEXT,
ADD COLUMN     "vatRatePercent" DECIMAL(5,2) NOT NULL DEFAULT 9.00,
ADD COLUMN     "vatRegime" "BusinessVatRegime" NOT NULL DEFAULT 'STANDARD';

-- AlterTable
ALTER TABLE "BusinessOrderList" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "businessOrderListId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isBusinessShadow" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "InvoiceCounter" (
    "year" INTEGER NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "InvoiceCounter_pkey" PRIMARY KEY ("year")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "recipientType" "InvoiceRecipientType" NOT NULL,
    "businessAccountId" TEXT,
    "subtotalCents" INTEGER NOT NULL,
    "vatRatePercent" DECIMAL(5,2) NOT NULL,
    "vatRegime" "BusinessVatRegime" NOT NULL,
    "vatAmountCents" INTEGER NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "invoiceNote" TEXT,
    "pdfStorageKey" TEXT,
    "peppolStatus" "InvoicePeppolStatus" NOT NULL DEFAULT 'NOT_APPLICABLE',
    "peppolMessageId" TEXT,
    "peppolSentAt" TIMESTAMP(3),
    "peppolError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");

-- CreateIndex
CREATE INDEX "Invoice_orderId_idx" ON "Invoice"("orderId");

-- CreateIndex
CREATE INDEX "Invoice_businessAccountId_idx" ON "Invoice"("businessAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessAccount_shadowUserId_key" ON "BusinessAccount"("shadowUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_businessOrderListId_key" ON "Order"("businessOrderListId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_businessOrderListId_fkey" FOREIGN KEY ("businessOrderListId") REFERENCES "BusinessOrderList"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessAccount" ADD CONSTRAINT "BusinessAccount_shadowUserId_fkey" FOREIGN KEY ("shadowUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_businessAccountId_fkey" FOREIGN KEY ("businessAccountId") REFERENCES "BusinessAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

