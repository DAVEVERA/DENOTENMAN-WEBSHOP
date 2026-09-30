-- Additive only: a new table for the newsletter block editor; existing tables are untouched.

-- CreateTable
CREATE TABLE "NewsletterDocument" (
    "campaignId" TEXT NOT NULL,
    "document" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewsletterDocument_pkey" PRIMARY KEY ("campaignId")
);

