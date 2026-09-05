-- CreateEnum
CREATE TYPE "AftersalesFlowType" AS ENUM ('PARTICULIER', 'ZAKELIJK');

-- AlterEnum
ALTER TYPE "AftersalesTrigger" ADD VALUE 'BUSINESS_ORDER_PAID';
ALTER TYPE "AftersalesTrigger" ADD VALUE 'BUSINESS_ORDER_FULFILLED';

-- AlterTable
ALTER TABLE "AftersalesFlow" ADD COLUMN "flowType" "AftersalesFlowType" NOT NULL DEFAULT 'PARTICULIER';

-- CreateIndex
CREATE UNIQUE INDEX "AftersalesFlow_flowType_key" ON "AftersalesFlow"("flowType");
