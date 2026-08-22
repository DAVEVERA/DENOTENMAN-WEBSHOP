-- Privacy-minimal, aggregate-only product view metric. Existing Product
-- queries remain backward-compatible while this additive table rolls out.
CREATE TABLE "ProductViewMetric" (
    "productId" TEXT NOT NULL,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductViewMetric_pkey" PRIMARY KEY ("productId")
);

CREATE INDEX "ProductViewMetric_viewCount_idx" ON "ProductViewMetric"("viewCount");

ALTER TABLE "ProductViewMetric"
ADD CONSTRAINT "ProductViewMetric_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "Product"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
