-- AlterEnum
ALTER TYPE "BusinessEventType" ADD VALUE 'ACCOUNT_DELETED';

-- AlterTable
ALTER TABLE "BusinessAccount" ADD COLUMN     "customerNumber" TEXT,
ADD COLUMN     "shippingEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "billingStreet" TEXT,
ADD COLUMN     "billingHouseNumber" TEXT,
ADD COLUMN     "billingPostalCode" TEXT,
ADD COLUMN     "billingCity" TEXT,
ADD COLUMN     "billingCountry" TEXT,
ADD COLUMN     "shippingStreet" TEXT,
ADD COLUMN     "shippingHouseNumber" TEXT,
ADD COLUMN     "shippingPostalCode" TEXT,
ADD COLUMN     "shippingCity" TEXT,
ADD COLUMN     "shippingCountry" TEXT,
ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "BusinessAccount_customerNumber_key" ON "BusinessAccount"("customerNumber");

-- Invoice numbers move from a per-year global counter (F2026-000001) to a
-- per-country counter (NL0001, BE0001) so admin exports can filter by
-- country from the number alone. InvoiceCounter has no foreign-key
-- relations in either direction (Invoice.invoiceNumber is a plain string),
-- so recreating it fresh is safe - already-issued invoices keep their old
-- numbers unchanged, only newly issued ones use the new scheme.
-- DropTable
DROP TABLE "InvoiceCounter";

-- CreateTable
CREATE TABLE "InvoiceCounter" (
    "countryCode" TEXT NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "InvoiceCounter_pkey" PRIMARY KEY ("countryCode")
);
