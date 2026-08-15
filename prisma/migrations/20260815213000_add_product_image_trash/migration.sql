CREATE TABLE "ProductImageTrash" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "originalImageId" TEXT NOT NULL,
    "originalStorageKey" TEXT NOT NULL,
    "archiveStorageKey" TEXT NOT NULL,
    "alt" TEXT,
    "sortOrder" INTEGER NOT NULL,
    "wasPrimary" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductImageTrash_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductImageTrash_archiveStorageKey_key" ON "ProductImageTrash"("archiveStorageKey");
CREATE INDEX "ProductImageTrash_productId_deletedAt_idx" ON "ProductImageTrash"("productId", "deletedAt");

ALTER TABLE "ProductImageTrash"
ADD CONSTRAINT "ProductImageTrash_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
