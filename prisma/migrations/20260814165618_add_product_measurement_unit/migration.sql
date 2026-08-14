-- CreateEnum
CREATE TYPE "MeasurementUnit" AS ENUM ('WEIGHT', 'VOLUME');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "unit" "MeasurementUnit" NOT NULL DEFAULT 'WEIGHT';
