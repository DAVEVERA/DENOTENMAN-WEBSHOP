-- CreateEnum
CREATE TYPE "NewsletterConsentStatus" AS ENUM ('SUBSCRIBED', 'UNSUBSCRIBED', 'PENDING', 'CLEANED');

-- CreateEnum
CREATE TYPE "NewsletterConsentSource" AS ENUM ('CHECKOUT', 'FORM', 'MANUAL', 'MAILCHIMP');

-- CreateTable
CREATE TABLE "NewsletterConsent" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "status" "NewsletterConsentStatus" NOT NULL DEFAULT 'PENDING',
    "optInAt" TIMESTAMP(3),
    "optInIp" TEXT,
    "optOutAt" TIMESTAMP(3),
    "source" "NewsletterConsentSource" NOT NULL,
    "locale" "Locale" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewsletterConsent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NewsletterConsent_email_key" ON "NewsletterConsent"("email");

-- CreateIndex
CREATE INDEX "NewsletterConsent_status_createdAt_idx" ON "NewsletterConsent"("status", "createdAt");
