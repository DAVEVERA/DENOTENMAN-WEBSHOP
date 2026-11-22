-- GEO audit history and durable scheduler lease.
CREATE TABLE "GeoAuditScheduler" (
  "id" TEXT NOT NULL,
  "activeRunId" TEXT,
  "leaseOwner" TEXT,
  "leaseUntil" TIMESTAMP(3),
  "nextDueAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GeoAuditScheduler_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GeoAuditRun" (
  "id" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'RUNNING',
  "trigger" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "cursor" TEXT,
  "totalProducts" INTEGER NOT NULL,
  "scannedProducts" INTEGER NOT NULL DEFAULT 0,
  "pagesChecked" INTEGER NOT NULL DEFAULT 0,
  "issueCount" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  CONSTRAINT "GeoAuditRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GeoAuditPage" (
  "id" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "sku" TEXT NOT NULL,
  "locale" "Locale" NOT NULL,
  "url" TEXT NOT NULL,
  "httpStatus" INTEGER NOT NULL,
  "score" INTEGER NOT NULL,
  "checks" JSONB NOT NULL,
  "findings" JSONB NOT NULL,
  "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GeoAuditPage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GeoAuditRun_startedAt_idx" ON "GeoAuditRun"("startedAt");
CREATE INDEX "GeoAuditRun_status_startedAt_idx" ON "GeoAuditRun"("status", "startedAt");
CREATE UNIQUE INDEX "GeoAuditPage_runId_productId_locale_key" ON "GeoAuditPage"("runId", "productId", "locale");
CREATE INDEX "GeoAuditPage_productId_locale_checkedAt_idx" ON "GeoAuditPage"("productId", "locale", "checkedAt");
CREATE INDEX "GeoAuditPage_runId_checkedAt_idx" ON "GeoAuditPage"("runId", "checkedAt");
ALTER TABLE "GeoAuditPage" ADD CONSTRAINT "GeoAuditPage_runId_fkey"
  FOREIGN KEY ("runId") REFERENCES "GeoAuditRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
