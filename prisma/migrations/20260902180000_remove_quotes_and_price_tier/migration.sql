-- DropForeignKey
ALTER TABLE "Quote" DROP CONSTRAINT "Quote_businessAccountId_fkey";

-- AlterTable
ALTER TABLE "BusinessAccount" DROP COLUMN "priceTier";

-- DropTable
DROP TABLE "Quote";

-- DropEnum
DROP TYPE "QuoteStatus";
