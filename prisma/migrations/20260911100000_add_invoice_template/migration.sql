CREATE TYPE "InvoiceTemplateStatus" AS ENUM ('DRAFT', 'PUBLISHED');

CREATE TABLE "InvoiceTemplate" (
  "id" TEXT NOT NULL,
  "status" "InvoiceTemplateStatus" NOT NULL DEFAULT 'DRAFT',
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InvoiceTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InvoiceTemplate_status_key" ON "InvoiceTemplate"("status");

CREATE TABLE "InvoiceTemplateBlock" (
  "id" TEXT NOT NULL,
  "templateId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "x" DOUBLE PRECISION NOT NULL,
  "y" DOUBLE PRECISION NOT NULL,
  "width" DOUBLE PRECISION NOT NULL,
  "height" DOUBLE PRECISION NOT NULL,
  "textOverrides" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InvoiceTemplateBlock_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InvoiceTemplateBlock_templateId_key_key" ON "InvoiceTemplateBlock"("templateId", "key");

ALTER TABLE "InvoiceTemplateBlock" ADD CONSTRAINT "InvoiceTemplateBlock_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "InvoiceTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
