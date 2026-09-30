-- Additive only: readable by the release that is live when this migration runs.

-- AlterTable
ALTER TABLE "ProductCopyProposal" ADD COLUMN     "supersededAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ProductCopyFieldReview" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "locale" "Locale" NOT NULL DEFAULT 'nl',
    "field" TEXT NOT NULL,
    "valueHash" TEXT NOT NULL,
    "reviewedByAdminUserId" TEXT NOT NULL,
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductCopyFieldReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductCopyFieldReview_reviewedByAdminUserId_idx" ON "ProductCopyFieldReview"("reviewedByAdminUserId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductCopyFieldReview_productId_locale_field_key" ON "ProductCopyFieldReview"("productId", "locale", "field");

-- AddForeignKey
ALTER TABLE "ProductCopyFieldReview" ADD CONSTRAINT "ProductCopyFieldReview_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCopyFieldReview" ADD CONSTRAINT "ProductCopyFieldReview_reviewedByAdminUserId_fkey" FOREIGN KEY ("reviewedByAdminUserId") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
