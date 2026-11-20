-- Expand-only: one new enum value, one new enum, nullable columns and two
-- new tables. Nothing is dropped or tightened, so an older revision keeps
-- serving while this is applied.

-- A hand-written message from an admin to one customer.
ALTER TYPE "EmailDeliveryKind" ADD VALUE IF NOT EXISTS 'MANUAL_MESSAGE';

-- Where an inbound customer message stands in the inbox.
DO $$
BEGIN
  CREATE TYPE "InboundMessageStatus" AS ENUM ('NIEUW', 'BEANTWOORD', 'AFGEHANDELD', 'SPAM');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- Reply tokens: minted on the first outgoing mail, carried in the Reply-To.
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "replyToken" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Order_replyToken_key" ON "Order"("replyToken");

ALTER TABLE "BusinessAccount" ADD COLUMN IF NOT EXISTS "replyToken" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "BusinessAccount_replyToken_key" ON "BusinessAccount"("replyToken");

-- Our own RFC Message-ID plus the thread it belongs to.
ALTER TABLE "EmailDeliveryLog" ADD COLUMN IF NOT EXISTS "messageId" TEXT;
ALTER TABLE "EmailDeliveryLog" ADD COLUMN IF NOT EXISTS "threadKey" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "EmailDeliveryLog_messageId_key" ON "EmailDeliveryLog"("messageId");

CREATE TABLE IF NOT EXISTS "InboundMessage" (
    "id" TEXT NOT NULL,
    "providerMessageId" TEXT NOT NULL,
    "threadKey" TEXT,
    "fromEmail" TEXT NOT NULL,
    "fromName" TEXT,
    "toEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "textBody" TEXT NOT NULL,
    "htmlBody" TEXT,
    "status" "InboundMessageStatus" NOT NULL DEFAULT 'NIEUW',
    "spamScore" DOUBLE PRECISION,
    "dkimOk" BOOLEAN,
    "spfOk" BOOLEAN,
    "recipientMatchesOrder" BOOLEAN NOT NULL DEFAULT false,
    "orderId" TEXT,
    "businessAccountId" TEXT,
    "rawPayload" JSONB NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "handledAt" TIMESTAMP(3),
    "handledByAdminUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InboundMessage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "InboundMessage_providerMessageId_key" ON "InboundMessage"("providerMessageId");
CREATE INDEX IF NOT EXISTS "InboundMessage_status_receivedAt_idx" ON "InboundMessage"("status", "receivedAt");
CREATE INDEX IF NOT EXISTS "InboundMessage_orderId_receivedAt_idx" ON "InboundMessage"("orderId", "receivedAt");
CREATE INDEX IF NOT EXISTS "InboundMessage_businessAccountId_receivedAt_idx" ON "InboundMessage"("businessAccountId", "receivedAt");
CREATE INDEX IF NOT EXISTS "InboundMessage_threadKey_idx" ON "InboundMessage"("threadKey");

CREATE TABLE IF NOT EXISTS "InboundAttachment" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT,
    "skippedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InboundAttachment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "InboundAttachment_messageId_idx" ON "InboundAttachment"("messageId");

-- An order or account that is removed must not take the customer's words with
-- it, so the links fall back to NULL instead of cascading.
ALTER TABLE "InboundMessage" ADD CONSTRAINT "InboundMessage_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InboundMessage" ADD CONSTRAINT "InboundMessage_businessAccountId_fkey" FOREIGN KEY ("businessAccountId") REFERENCES "BusinessAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InboundAttachment" ADD CONSTRAINT "InboundAttachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "InboundMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
