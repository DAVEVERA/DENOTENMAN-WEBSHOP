-- Additive only: new tables used by the developer invoicing portal; existing tables are untouched.

-- CreateEnum
CREATE TYPE "DeveloperInvoiceStatus" AS ENUM ('DRAFT', 'SENT', 'PAID', 'CANCELLED');

-- CreateTable
CREATE TABLE "DeveloperInvoice" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "lines" JSONB NOT NULL,
    "subtotalCents" INTEGER NOT NULL,
    "vatCents" INTEGER NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "notes" TEXT,
    "status" "DeveloperInvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "sentAt" TIMESTAMP(3),
    "firstReminderAt" TIMESTAMP(3),
    "secondReminderAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "paidVia" TEXT,
    "stripeCheckoutSessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeveloperInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeveloperInvoiceEvent" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "detail" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeveloperInvoiceEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeveloperBillingProfile" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "businessName" TEXT NOT NULL DEFAULT '',
    "contactName" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "postalCode" TEXT NOT NULL DEFAULT '',
    "city" TEXT NOT NULL DEFAULT '',
    "country" TEXT NOT NULL DEFAULT 'Nederland',
    "kvkNumber" TEXT NOT NULL DEFAULT '',
    "vatNumber" TEXT NOT NULL DEFAULT '',
    "paymentTermDays" INTEGER NOT NULL DEFAULT 14,
    "notificationEmail" TEXT NOT NULL DEFAULT '',
    "bankTransferEnabled" BOOLEAN NOT NULL DEFAULT true,
    "iban" TEXT NOT NULL DEFAULT '',
    "bic" TEXT NOT NULL DEFAULT '',
    "accountHolder" TEXT NOT NULL DEFAULT '',
    "stripeEnabled" BOOLEAN NOT NULL DEFAULT false,
    "stripeSecretKeyEncrypted" TEXT,
    "paymentLinkEnabled" BOOLEAN NOT NULL DEFAULT false,
    "paymentLinkUrl" TEXT NOT NULL DEFAULT '',
    "paymentLinkLabel" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeveloperBillingProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeveloperInvoice_number_key" ON "DeveloperInvoice"("number");

-- CreateIndex
CREATE INDEX "DeveloperInvoice_status_sentAt_idx" ON "DeveloperInvoice"("status", "sentAt");

-- CreateIndex
CREATE INDEX "DeveloperInvoiceEvent_invoiceId_createdAt_idx" ON "DeveloperInvoiceEvent"("invoiceId", "createdAt");

-- AddForeignKey
ALTER TABLE "DeveloperInvoiceEvent" ADD CONSTRAINT "DeveloperInvoiceEvent_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "DeveloperInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

