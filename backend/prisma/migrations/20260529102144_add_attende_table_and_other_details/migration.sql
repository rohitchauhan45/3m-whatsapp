/*
  Warnings:

  - You are about to drop the column `completedByTime` on the `Task` table. All the data in the column will be lost.
  - Added the required column `date` to the `Task` table without a default value. This is not possible if the table is not empty.
  - Added the required column `endAt` to the `Task` table without a default value. This is not possible if the table is not empty.
  - Added the required column `rawEndTime` to the `Task` table without a default value. This is not possible if the table is not empty.
  - Added the required column `rawStartTime` to the `Task` table without a default value. This is not possible if the table is not empty.
  - Added the required column `startAt` to the `Task` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "AttendenceType" AS ENUM ('morning', 'afternoon');

-- DropIndex
DROP INDEX "Cron_name_key";

-- AlterTable
ALTER TABLE "Task" DROP COLUMN "completedByTime",
ADD COLUMN     "date" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "endAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "rawEndTime" TEXT NOT NULL,
ADD COLUMN     "rawStartTime" TEXT NOT NULL,
ADD COLUMN     "reason" TEXT,
ADD COLUMN     "startAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "status" DROP NOT NULL,
ALTER COLUMN "status" DROP DEFAULT,
ALTER COLUMN "accept" DROP NOT NULL,
ALTER COLUMN "accept" DROP DEFAULT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "notAttentReason" TEXT;

-- CreateTable
CREATE TABLE "Attendence" (
    "id" TEXT NOT NULL,
    "type" "AttendenceType" NOT NULL,
    "time" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Attendence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Attendence_userId_idx" ON "Attendence"("userId");

-- CreateIndex
CREATE INDEX "Attendence_deletedAt_idx" ON "Attendence"("deletedAt");

-- CreateIndex
CREATE INDEX "Cron_name_idx" ON "Cron"("name");

-- AddForeignKey
ALTER TABLE "Attendence" ADD CONSTRAINT "Attendence_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
