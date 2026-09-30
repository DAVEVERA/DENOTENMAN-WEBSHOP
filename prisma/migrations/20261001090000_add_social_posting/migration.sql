-- Additive only: new enums and tables for social posting; existing tables are untouched.

-- CreateEnum
CREATE TYPE "SocialPlatform" AS ENUM ('FACEBOOK', 'INSTAGRAM', 'TIKTOK', 'YOUTUBE');

-- CreateEnum
CREATE TYPE "SocialPostStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'PUBLISHING', 'PUBLISHED', 'PARTIAL', 'FAILED');

-- CreateEnum
CREATE TYPE "SocialTargetStatus" AS ENUM ('PENDING', 'PUBLISHING', 'PUBLISHED', 'FAILED');

-- CreateTable
CREATE TABLE "SocialAccount" (
    "id" TEXT NOT NULL,
    "platform" "SocialPlatform" NOT NULL,
    "externalId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "username" TEXT,
    "avatarUrl" TEXT,
    "accessTokenEncrypted" TEXT NOT NULL,
    "refreshTokenEncrypted" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "parentExternalId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'CONNECTED',
    "lastError" TEXT,
    "connectedByAdminId" TEXT,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialCampaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT NOT NULL DEFAULT '#B7791F',
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialMediaAsset" (
    "id" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "durationSeconds" DOUBLE PRECISION,
    "completedAt" TIMESTAMP(3),
    "uploadSessionUri" TEXT,
    "uploadedBytes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocialMediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialPost" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "caption" TEXT NOT NULL DEFAULT '',
    "platformCaptions" JSONB,
    "mediaIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "linkUrl" TEXT,
    "youtubeTitle" TEXT,
    "youtubePrivacy" TEXT NOT NULL DEFAULT 'public',
    "tiktokPrivacy" TEXT NOT NULL DEFAULT 'PUBLIC_TO_EVERYONE',
    "status" "SocialPostStatus" NOT NULL DEFAULT 'DRAFT',
    "scheduledAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "campaignId" TEXT,
    "createdByAdminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialPostTarget" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "status" "SocialTargetStatus" NOT NULL DEFAULT 'PENDING',
    "externalId" TEXT,
    "permalink" TEXT,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialPostTarget_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SocialAccount_platform_externalId_key" ON "SocialAccount"("platform", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "SocialMediaAsset_storageKey_key" ON "SocialMediaAsset"("storageKey");

-- CreateIndex
CREATE INDEX "SocialPost_status_scheduledAt_idx" ON "SocialPost"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "SocialPost_scheduledAt_idx" ON "SocialPost"("scheduledAt");

-- CreateIndex
CREATE UNIQUE INDEX "SocialPostTarget_postId_accountId_key" ON "SocialPostTarget"("postId", "accountId");

-- AddForeignKey
ALTER TABLE "SocialPost" ADD CONSTRAINT "SocialPost_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "SocialCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialPostTarget" ADD CONSTRAINT "SocialPostTarget_postId_fkey" FOREIGN KEY ("postId") REFERENCES "SocialPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialPostTarget" ADD CONSTRAINT "SocialPostTarget_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "SocialAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

