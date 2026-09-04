-- AlterEnum
ALTER TYPE "BusinessEventType" ADD VALUE 'ORDER_LIST_PICKUP_DAY_SET';

-- AlterTable
ALTER TABLE "BusinessOrderList" ADD COLUMN     "pickupDay" TIMESTAMP(3);
