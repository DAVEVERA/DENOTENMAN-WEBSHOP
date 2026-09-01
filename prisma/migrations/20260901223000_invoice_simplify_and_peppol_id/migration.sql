-- DropForeignKey
ALTER TABLE "Invoice" DROP CONSTRAINT "Invoice_businessAccountId_fkey";

-- DropIndex
DROP INDEX "Invoice_orderId_idx";

-- AlterTable
ALTER TABLE "BusinessAccount" ADD COLUMN     "peppolParticipantId" TEXT;

-- AlterTable
ALTER TABLE "Invoice" DROP COLUMN "pdfStorageKey",
DROP COLUMN "recipientType",
ADD COLUMN     "pdfBase64" TEXT,
ALTER COLUMN "businessAccountId" SET NOT NULL;

-- DropEnum
DROP TYPE "InvoiceRecipientType";

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_orderId_key" ON "Invoice"("orderId");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_businessAccountId_fkey" FOREIGN KEY ("businessAccountId") REFERENCES "BusinessAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

