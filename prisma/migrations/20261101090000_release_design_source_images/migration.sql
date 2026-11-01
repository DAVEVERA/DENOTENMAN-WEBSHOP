-- A product photo that was used as the source of a design job (PhotoRoom, Gemini,
-- VModel) could not be deleted: both references were ON DELETE RESTRICT. The ids
-- stay as a plain record of which photo a job started from.

-- DropForeignKey
ALTER TABLE "DesignJob" DROP CONSTRAINT "DesignJob_sourceImageId_fkey";

-- DropForeignKey
ALTER TABLE "DesignAsset" DROP CONSTRAINT "DesignAsset_sourceImageId_fkey";
