-- CreateEnum
CREATE TYPE "DeliveryMethod" AS ENUM ('SHIPPING', 'PICKUP');

-- AlterTable
ALTER TABLE "Order"
  ADD COLUMN "deliveryMethod" "DeliveryMethod" NOT NULL DEFAULT 'SHIPPING',
  ADD COLUMN "pickupLocationId" TEXT,
  ALTER COLUMN "shippingStreet" DROP NOT NULL,
  ALTER COLUMN "shippingHouseNumber" DROP NOT NULL,
  ALTER COLUMN "shippingPostalCode" DROP NOT NULL,
  ALTER COLUMN "shippingCity" DROP NOT NULL;
