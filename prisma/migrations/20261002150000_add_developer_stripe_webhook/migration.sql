-- Additive only: two nullable columns on the developer billing profile.

-- AlterTable
ALTER TABLE "DeveloperBillingProfile" ADD COLUMN     "stripeWebhookEndpointId" TEXT,
ADD COLUMN     "stripeWebhookSecretEncrypted" TEXT;
