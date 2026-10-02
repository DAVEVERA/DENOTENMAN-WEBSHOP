-- Additive only: nullable device columns on DeveloperInvoiceView.

-- AlterTable
ALTER TABLE "DeveloperInvoiceView" ADD COLUMN     "browser" TEXT,
ADD COLUMN     "device" TEXT,
ADD COLUMN     "deviceModel" TEXT,
ADD COLUMN     "network" TEXT,
ADD COLUMN     "os" TEXT,
ADD COLUMN     "screen" TEXT,
ADD COLUMN     "userAgent" TEXT;

