-- Additive only: a new table for invoice page views; existing tables are untouched.

-- CreateTable
CREATE TABLE "DeveloperInvoiceView" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "invoiceId" TEXT,
    "adminUserId" TEXT,
    "viewerName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeveloperInvoiceView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DeveloperInvoiceView_createdAt_idx" ON "DeveloperInvoiceView"("createdAt");

-- CreateIndex
CREATE INDEX "DeveloperInvoiceView_invoiceId_createdAt_idx" ON "DeveloperInvoiceView"("invoiceId", "createdAt");

-- AddForeignKey
ALTER TABLE "DeveloperInvoiceView" ADD CONSTRAINT "DeveloperInvoiceView_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "DeveloperInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

