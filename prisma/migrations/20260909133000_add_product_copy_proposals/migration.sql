CREATE TYPE "ProductCopyProposalStatus" AS ENUM ('GENERATING', 'DRAFT', 'APPLIED', 'FAILED');

CREATE TABLE "ProductCopyProposal" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "locale" "Locale" NOT NULL DEFAULT 'nl',
  "requestedByAdminUserId" TEXT NOT NULL,
  "appliedByAdminUserId" TEXT,
  "status" "ProductCopyProposalStatus" NOT NULL DEFAULT 'GENERATING',
  "schemaVersion" INTEGER NOT NULL DEFAULT 1,
  "generationIdempotencyKey" TEXT NOT NULL,
  "generationRequestHash" TEXT NOT NULL,
  "sourceProductVersion" TIMESTAMP(3) NOT NULL,
  "sourceHash" TEXT NOT NULL,
  "sourceSnapshot" JSONB NOT NULL,
  "proposedFields" JSONB,
  "provider" TEXT NOT NULL DEFAULT 'GOOGLE_GEMINI',
  "model" TEXT,
  "generatedAt" TIMESTAMP(3),
  "errorCode" TEXT,
  "applyIdempotencyKey" TEXT,
  "applyRequestHash" TEXT,
  "appliedFields" JSONB,
  "appliedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProductCopyProposal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductCopyProposal_generationIdempotencyKey_key" ON "ProductCopyProposal"("generationIdempotencyKey");
CREATE UNIQUE INDEX "ProductCopyProposal_applyIdempotencyKey_key" ON "ProductCopyProposal"("applyIdempotencyKey");
CREATE INDEX "ProductCopyProposal_productId_status_createdAt_idx" ON "ProductCopyProposal"("productId", "status", "createdAt");
CREATE INDEX "ProductCopyProposal_requestedByAdminUserId_createdAt_idx" ON "ProductCopyProposal"("requestedByAdminUserId", "createdAt");

ALTER TABLE "ProductCopyProposal" ADD CONSTRAINT "ProductCopyProposal_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductCopyProposal" ADD CONSTRAINT "ProductCopyProposal_requestedByAdminUserId_fkey" FOREIGN KEY ("requestedByAdminUserId") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductCopyProposal" ADD CONSTRAINT "ProductCopyProposal_appliedByAdminUserId_fkey" FOREIGN KEY ("appliedByAdminUserId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
