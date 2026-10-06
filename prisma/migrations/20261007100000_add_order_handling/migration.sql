-- Internal order hand-off: "verwerkt" and, for market pickups, "staat klaar".
ALTER TABLE "Order"
  ADD COLUMN "processedAt" TIMESTAMP(3),
  ADD COLUMN "processedByName" TEXT,
  ADD COLUMN "readyForPickupAt" TIMESTAMP(3),
  ADD COLUMN "readyForPickupByName" TEXT;

CREATE INDEX "Order_processedAt_idx" ON "Order"("processedAt");

-- Orders that were already shipped count as dealt with, so the "te verwerken" overview
-- starts with real work only. The name stays empty: nobody ticked these by hand.
UPDATE "Order" SET "processedAt" = "updatedAt" WHERE "status" = 'FULFILLED' AND "isTest" = false;
