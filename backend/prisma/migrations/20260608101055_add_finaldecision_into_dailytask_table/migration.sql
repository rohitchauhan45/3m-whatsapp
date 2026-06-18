-- CreateEnum
CREATE TYPE "onTrackStatus" AS ENUM ('onTrack', 'remark');

-- AlterTable
ALTER TABLE "DailyTask" ADD COLUMN     "finaldecision" "onTrackStatus";
