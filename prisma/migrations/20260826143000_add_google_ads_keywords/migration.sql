ALTER TABLE "GoogleAdsConfiguration"
ADD COLUMN "keywords" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
