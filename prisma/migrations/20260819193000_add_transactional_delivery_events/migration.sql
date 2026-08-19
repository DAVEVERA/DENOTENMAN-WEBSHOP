-- Extend delivery state so provider acceptance is not presented as delivery.
ALTER TYPE "EmailDeliveryStatus" ADD VALUE IF NOT EXISTS 'DELIVERED';
ALTER TYPE "EmailDeliveryStatus" ADD VALUE IF NOT EXISTS 'BOUNCED';
ALTER TYPE "EmailDeliveryStatus" ADD VALUE IF NOT EXISTS 'COMPLAINED';
ALTER TYPE "EmailDeliveryStatus" ADD VALUE IF NOT EXISTS 'REJECTED';
ALTER TYPE "EmailDeliveryStatus" ADD VALUE IF NOT EXISTS 'SUPPRESSED';

CREATE TYPE "EmailDeliveryEventType" AS ENUM (
  'DELIVERED',
  'BOUNCED',
  'COMPLAINED',
  'REJECTED',
  'SUPPRESSED'
);

ALTER TABLE "EmailDeliveryLog"
  ADD COLUMN "deliveredAt" TIMESTAMP(3),
  ADD COLUMN "bouncedAt" TIMESTAMP(3),
  ADD COLUMN "complainedAt" TIMESTAMP(3),
  ADD COLUMN "lastProviderEventAt" TIMESTAMP(3);

CREATE TABLE "EmailDeliveryEvent" (
  "id" TEXT NOT NULL,
  "providerEventId" TEXT NOT NULL,
  "deliveryId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "providerMessageId" TEXT NOT NULL,
  "type" "EmailDeliveryEventType" NOT NULL,
  "providerEvent" TEXT NOT NULL,
  "reasonCode" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "EmailDeliveryEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmailDeliveryEvent_providerEventId_key"
  ON "EmailDeliveryEvent"("providerEventId");
CREATE INDEX "EmailDeliveryEvent_deliveryId_occurredAt_idx"
  ON "EmailDeliveryEvent"("deliveryId", "occurredAt");
CREATE INDEX "EmailDeliveryEvent_type_occurredAt_idx"
  ON "EmailDeliveryEvent"("type", "occurredAt");
CREATE INDEX "EmailDeliveryEvent_providerMessageId_idx"
  ON "EmailDeliveryEvent"("providerMessageId");
CREATE INDEX "EmailDeliveryLog_providerMessageId_idx"
  ON "EmailDeliveryLog"("providerMessageId");

ALTER TABLE "EmailDeliveryEvent"
  ADD CONSTRAINT "EmailDeliveryEvent_deliveryId_fkey"
  FOREIGN KEY ("deliveryId") REFERENCES "EmailDeliveryLog"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
