-- Additive only: a new table for uploaded developer invoice files; existing tables are untouched.

-- CreateTable
CREATE TABLE "DeveloperInvoiceAttachment" (
    "invoiceId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "extracted" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeveloperInvoiceAttachment_pkey" PRIMARY KEY ("invoiceId")
);

-- AddForeignKey
ALTER TABLE "DeveloperInvoiceAttachment" ADD CONSTRAINT "DeveloperInvoiceAttachment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "DeveloperInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

