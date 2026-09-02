-- AlterEnum
ALTER TYPE "BusinessEventType" ADD VALUE 'PASSWORD_SET';

-- AlterTable
ALTER TABLE "BusinessAccount" ADD COLUMN     "passwordHash" TEXT;
