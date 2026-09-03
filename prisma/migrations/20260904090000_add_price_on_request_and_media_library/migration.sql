-- AlterEnum
ALTER TYPE "EmailDeliveryKind" ADD VALUE 'BUSINESS_PRICE_REQUESTED';

-- AlterEnum
ALTER TYPE "BusinessEventType" ADD VALUE 'ORDER_LIST_PRICE_REQUESTED';

-- AlterTable
ALTER TABLE "AftersalesFlow" ADD COLUMN     "logoUrl" TEXT;

-- AlterTable
ALTER TABLE "BusinessOrderListItem" ADD COLUMN     "priceOnRequest" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "priceRequestedAt" TIMESTAMP(3),
ALTER COLUMN "unitPriceCents" DROP NOT NULL;

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "altText" TEXT,
    "uploadedByAdminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MediaAsset_storageKey_key" ON "MediaAsset"("storageKey");

-- CreateIndex
CREATE INDEX "MediaAsset_createdAt_idx" ON "MediaAsset"("createdAt");

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_uploadedByAdminId_fkey" FOREIGN KEY ("uploadedByAdminId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
