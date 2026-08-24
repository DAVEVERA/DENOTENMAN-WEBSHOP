-- Persist a short-lived ownership claim so PostNL network requests never have
-- to run while a database row lock is held. The tracking barcode is stored
-- before requesting the PDF, allowing safe retries with the same barcode.
ALTER TABLE "Order"
ADD COLUMN "postnlLabelClaimToken" TEXT,
ADD COLUMN "postnlLabelClaimedAt" TIMESTAMP(3),
ADD COLUMN "postnlLabelLastError" TEXT;
