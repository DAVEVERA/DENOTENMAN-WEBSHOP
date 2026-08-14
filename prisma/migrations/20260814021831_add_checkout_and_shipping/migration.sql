-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "contactEmail" TEXT NOT NULL,
ADD COLUMN     "contactName" TEXT NOT NULL,
ADD COLUMN     "contactPhone" TEXT,
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'EUR',
ADD COLUMN     "locale" TEXT NOT NULL DEFAULT 'nl',
ADD COLUMN     "molliePaymentId" TEXT,
ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "postnlLabelBase64" TEXT,
ADD COLUMN     "postnlTrackingCode" TEXT,
ADD COLUMN     "shippingCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "shippingCity" TEXT NOT NULL,
ADD COLUMN     "shippingCountry" TEXT NOT NULL DEFAULT 'NL',
ADD COLUMN     "shippingHouseNumber" TEXT NOT NULL,
ADD COLUMN     "shippingPostalCode" TEXT NOT NULL,
ADD COLUMN     "shippingStreet" TEXT NOT NULL,
ADD COLUMN     "subtotalCents" INTEGER NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "productName" TEXT NOT NULL,
ADD COLUMN     "variantLabel" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Order_molliePaymentId_key" ON "Order"("molliePaymentId");

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");

