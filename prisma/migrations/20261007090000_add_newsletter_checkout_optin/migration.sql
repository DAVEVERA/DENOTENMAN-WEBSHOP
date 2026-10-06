-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "newsletterOptIn" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "NewsletterConsent" ADD COLUMN     "city" TEXT,
ADD COLUMN     "country" TEXT;

