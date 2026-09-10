CREATE TYPE "BusinessLifecycleEmailKind" AS ENUM ('INVITATION', 'INVOICE');

CREATE TABLE "BusinessLifecycleEmailContent" (
  "id" TEXT NOT NULL,
  "kind" "BusinessLifecycleEmailKind" NOT NULL,
  "subject" TEXT NOT NULL,
  "heading" TEXT NOT NULL,
  "bodyText" TEXT NOT NULL,
  "buttonLabel" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BusinessLifecycleEmailContent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BusinessLifecycleEmailContent_kind_key" ON "BusinessLifecycleEmailContent"("kind");
