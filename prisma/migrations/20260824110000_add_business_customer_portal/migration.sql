-- Extend transactional delivery kinds used by the existing provider log.
ALTER TYPE "EmailDeliveryKind" ADD VALUE IF NOT EXISTS 'BUSINESS_ORDER_LIST';

CREATE TYPE "BusinessOrderListStatus" AS ENUM ('DRAFT', 'SENT', 'CHANGES_REQUESTED', 'APPROVED', 'CANCELLED');
CREATE TYPE "BusinessActorType" AS ENUM ('ADMIN', 'CUSTOMER', 'SYSTEM');
CREATE TYPE "BusinessEventType" AS ENUM ('ACCOUNT_CREATED', 'ACCOUNT_UPDATED', 'INVITATION_SENT', 'PORTAL_LOGIN', 'ORDER_LIST_CREATED', 'ORDER_LIST_SENT', 'ORDER_LIST_QUANTITIES_CHANGED', 'ORDER_LIST_NOTE_ADDED', 'ORDER_LIST_APPROVED', 'ORDER_LIST_CHANGES_REQUESTED', 'ORDER_LIST_CANCELLED');

ALTER TABLE "BusinessAccount" ADD COLUMN "loginLinkRequestedAt" TIMESTAMP(3);

CREATE TABLE "BusinessLoginLinkRateLimit" (
    "scopeKey" TEXT NOT NULL,
    "windowStartedAt" TIMESTAMP(3) NOT NULL,
    "requestCount" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BusinessLoginLinkRateLimit_pkey" PRIMARY KEY ("scopeKey")
);

CREATE TABLE "BusinessInvitation" (
    "id" TEXT NOT NULL,
    "businessAccountId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "deliveryStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "providerMessageId" TEXT,
    "deliveryError" TEXT,
    "createdByAdminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BusinessInvitation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BusinessSession" (
    "id" TEXT NOT NULL,
    "businessAccountId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BusinessSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BusinessOrderList" (
    "id" TEXT NOT NULL,
    "businessAccountId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "BusinessOrderListStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "totalCents" INTEGER NOT NULL,
    "validUntil" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "deliveryStatus" TEXT NOT NULL DEFAULT 'NONE',
    "providerMessageId" TEXT,
    "deliveryError" TEXT,
    "createdByAdminId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BusinessOrderList_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BusinessOrderListItem" (
    "id" TEXT NOT NULL,
    "orderListId" TEXT NOT NULL,
    "productVariantId" TEXT,
    "productName" TEXT NOT NULL,
    "variantLabel" TEXT,
    "sku" TEXT,
    "quantity" INTEGER NOT NULL,
    "unitPriceCents" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "BusinessOrderListItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BusinessOrderListNote" (
    "id" TEXT NOT NULL,
    "orderListId" TEXT NOT NULL,
    "actorType" "BusinessActorType" NOT NULL,
    "authorName" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BusinessOrderListNote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BusinessEvent" (
    "id" TEXT NOT NULL,
    "businessAccountId" TEXT NOT NULL,
    "orderListId" TEXT,
    "type" "BusinessEventType" NOT NULL,
    "actorType" "BusinessActorType" NOT NULL,
    "actorName" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BusinessEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BusinessEventRead" (
    "businessEventId" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BusinessEventRead_pkey" PRIMARY KEY ("businessEventId", "adminUserId")
);

CREATE UNIQUE INDEX "BusinessInvitation_tokenHash_key" ON "BusinessInvitation"("tokenHash");
CREATE INDEX "BusinessLoginLinkRateLimit_updatedAt_idx" ON "BusinessLoginLinkRateLimit"("updatedAt");
CREATE INDEX "BusinessInvitation_businessAccountId_createdAt_idx" ON "BusinessInvitation"("businessAccountId", "createdAt");
CREATE INDEX "BusinessInvitation_email_expiresAt_idx" ON "BusinessInvitation"("email", "expiresAt");
CREATE UNIQUE INDEX "BusinessSession_tokenHash_key" ON "BusinessSession"("tokenHash");
CREATE INDEX "BusinessSession_businessAccountId_expiresAt_idx" ON "BusinessSession"("businessAccountId", "expiresAt");
CREATE INDEX "BusinessSession_expiresAt_idx" ON "BusinessSession"("expiresAt");
CREATE INDEX "BusinessOrderList_businessAccountId_createdAt_idx" ON "BusinessOrderList"("businessAccountId", "createdAt");
CREATE INDEX "BusinessOrderList_status_updatedAt_idx" ON "BusinessOrderList"("status", "updatedAt");
CREATE INDEX "BusinessOrderListItem_orderListId_sortOrder_idx" ON "BusinessOrderListItem"("orderListId", "sortOrder");
CREATE INDEX "BusinessOrderListItem_productVariantId_idx" ON "BusinessOrderListItem"("productVariantId");
CREATE INDEX "BusinessOrderListNote_orderListId_createdAt_idx" ON "BusinessOrderListNote"("orderListId", "createdAt");
CREATE INDEX "BusinessEvent_businessAccountId_createdAt_idx" ON "BusinessEvent"("businessAccountId", "createdAt");
CREATE INDEX "BusinessEvent_orderListId_createdAt_idx" ON "BusinessEvent"("orderListId", "createdAt");
CREATE INDEX "BusinessEventRead_adminUserId_readAt_idx" ON "BusinessEventRead"("adminUserId", "readAt");

ALTER TABLE "BusinessInvitation" ADD CONSTRAINT "BusinessInvitation_businessAccountId_fkey" FOREIGN KEY ("businessAccountId") REFERENCES "BusinessAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BusinessInvitation" ADD CONSTRAINT "BusinessInvitation_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BusinessSession" ADD CONSTRAINT "BusinessSession_businessAccountId_fkey" FOREIGN KEY ("businessAccountId") REFERENCES "BusinessAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BusinessOrderList" ADD CONSTRAINT "BusinessOrderList_businessAccountId_fkey" FOREIGN KEY ("businessAccountId") REFERENCES "BusinessAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BusinessOrderList" ADD CONSTRAINT "BusinessOrderList_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BusinessOrderListItem" ADD CONSTRAINT "BusinessOrderListItem_orderListId_fkey" FOREIGN KEY ("orderListId") REFERENCES "BusinessOrderList"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BusinessOrderListItem" ADD CONSTRAINT "BusinessOrderListItem_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BusinessOrderListNote" ADD CONSTRAINT "BusinessOrderListNote_orderListId_fkey" FOREIGN KEY ("orderListId") REFERENCES "BusinessOrderList"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BusinessEvent" ADD CONSTRAINT "BusinessEvent_businessAccountId_fkey" FOREIGN KEY ("businessAccountId") REFERENCES "BusinessAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BusinessEvent" ADD CONSTRAINT "BusinessEvent_orderListId_fkey" FOREIGN KEY ("orderListId") REFERENCES "BusinessOrderList"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BusinessEventRead" ADD CONSTRAINT "BusinessEventRead_businessEventId_fkey" FOREIGN KEY ("businessEventId") REFERENCES "BusinessEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BusinessEventRead" ADD CONSTRAINT "BusinessEventRead_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
