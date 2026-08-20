-- Additive cost-overview domain. Invoice binaries remain private in GCS;
-- PostgreSQL stores only validated metadata and immutable object identities.
CREATE TYPE "CostProvider" AS ENUM ('PHOTOROOM', 'PRISMA', 'OTHER');
CREATE TYPE "CostCategory" AS ENUM ('SOFTWARE', 'INFRASTRUCTURE', 'MARKETING', 'OTHER');
CREATE TYPE "CostRecurrence" AS ENUM ('ONE_TIME', 'MONTHLY', 'YEARLY');

CREATE TABLE "ManagedCost" (
    "id" UUID NOT NULL,
    "provider" "CostProvider" NOT NULL,
    "providerName" TEXT NOT NULL,
    "category" "CostCategory" NOT NULL,
    "description" TEXT,
    "amountCents" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "recurrence" "CostRecurrence" NOT NULL,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdByAdminUserId" TEXT,
    "updatedByAdminUserId" TEXT,
    "deletedByAdminUserId" TEXT,

    CONSTRAINT "ManagedCost_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ManagedCost_providerName_nonblank" CHECK (btrim("providerName") <> ''),
    CONSTRAINT "ManagedCost_amountCents_nonnegative" CHECK ("amountCents" IS NULL OR "amountCents" >= 0),
    CONSTRAINT "ManagedCost_currency_iso" CHECK ("currency" ~ '^[A-Z]{3}$'),
    CONSTRAINT "ManagedCost_version_positive" CHECK ("version" > 0),
    CONSTRAINT "ManagedCost_date_order" CHECK ("startsAt" IS NULL OR "endsAt" IS NULL OR "endsAt" >= "startsAt")
);

CREATE TABLE "CostInvoice" (
    "id" UUID NOT NULL,
    "managedCostId" UUID,
    "provider" "CostProvider",
    "category" "CostCategory",
    "amountCents" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "billingPeriodStart" TIMESTAMP(3),
    "billingPeriodEnd" TIMESTAMP(3),
    "originalFilename" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "notes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "uploadedByAdminUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedByAdminUserId" TEXT,

    CONSTRAINT "CostInvoice_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CostInvoice_amountCents_nonnegative" CHECK ("amountCents" IS NULL OR "amountCents" >= 0),
    CONSTRAINT "CostInvoice_currency_iso" CHECK ("currency" ~ '^[A-Z]{3}$'),
    CONSTRAINT "CostInvoice_originalFilename_nonblank" CHECK (btrim("originalFilename") <> ''),
    CONSTRAINT "CostInvoice_fileSize_positive" CHECK ("fileSize" > 0),
    CONSTRAINT "CostInvoice_sha256_hex" CHECK ("sha256" ~ '^[0-9a-f]{64}$'),
    CONSTRAINT "CostInvoice_version_positive" CHECK ("version" > 0),
    CONSTRAINT "CostInvoice_billing_period_order" CHECK ("billingPeriodStart" IS NULL OR "billingPeriodEnd" IS NULL OR "billingPeriodEnd" >= "billingPeriodStart")
);

CREATE TABLE "CostMutation" (
    "id" UUID NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "response" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CostMutation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CostInvoice_storageKey_key" ON "CostInvoice"("storageKey");
CREATE INDEX "ManagedCost_deletedAt_active_provider_idx" ON "ManagedCost"("deletedAt", "active", "provider");
CREATE INDEX "ManagedCost_category_deletedAt_idx" ON "ManagedCost"("category", "deletedAt");
CREATE INDEX "CostInvoice_deletedAt_issuedAt_idx" ON "CostInvoice"("deletedAt", "issuedAt");
CREATE INDEX "CostInvoice_managedCostId_deletedAt_idx" ON "CostInvoice"("managedCostId", "deletedAt");
CREATE INDEX "CostInvoice_provider_issuedAt_idx" ON "CostInvoice"("provider", "issuedAt");
CREATE UNIQUE INDEX "CostMutation_adminUserId_idempotencyKey_key" ON "CostMutation"("adminUserId", "idempotencyKey");
CREATE INDEX "CostMutation_createdAt_idx" ON "CostMutation"("createdAt");

ALTER TABLE "ManagedCost" ADD CONSTRAINT "ManagedCost_createdByAdminUserId_fkey" FOREIGN KEY ("createdByAdminUserId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ManagedCost" ADD CONSTRAINT "ManagedCost_updatedByAdminUserId_fkey" FOREIGN KEY ("updatedByAdminUserId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ManagedCost" ADD CONSTRAINT "ManagedCost_deletedByAdminUserId_fkey" FOREIGN KEY ("deletedByAdminUserId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CostInvoice" ADD CONSTRAINT "CostInvoice_managedCostId_fkey" FOREIGN KEY ("managedCostId") REFERENCES "ManagedCost"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CostInvoice" ADD CONSTRAINT "CostInvoice_uploadedByAdminUserId_fkey" FOREIGN KEY ("uploadedByAdminUserId") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CostInvoice" ADD CONSTRAINT "CostInvoice_deletedByAdminUserId_fkey" FOREIGN KEY ("deletedByAdminUserId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CostMutation" ADD CONSTRAINT "CostMutation_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- System-created editable defaults. IDs are UUID identities, not provider slugs.
INSERT INTO "ManagedCost" ("id", "provider", "providerName", "category", "description", "amountCents", "currency", "recurrence", "active", "version", "createdAt", "updatedAt") VALUES
('10000000-0000-4000-8000-000000000001', 'PHOTOROOM', 'PhotoRoom', 'SOFTWARE', 'PhotoRoom-abonnement', NULL, 'EUR', 'MONTHLY', true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('10000000-0000-4000-8000-000000000002', 'PRISMA', 'Prisma', 'INFRASTRUCTURE', 'Prisma-databasekosten', NULL, 'EUR', 'MONTHLY', true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
