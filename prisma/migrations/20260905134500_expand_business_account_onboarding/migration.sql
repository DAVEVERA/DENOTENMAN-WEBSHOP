CREATE TYPE "BusinessPickupFrequency" AS ENUM ('WEEKLY', 'BIWEEKLY', 'MONTHLY', 'ON_REQUEST');

ALTER TABLE "BusinessAccount"
  ADD COLUMN "fixedPickupLocationId" TEXT,
  ADD COLUMN "pickupFrequency" "BusinessPickupFrequency",
  ADD COLUMN "businessNewsletterOptIn" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "businessNewsletterConsentAt" TIMESTAMP(3);
