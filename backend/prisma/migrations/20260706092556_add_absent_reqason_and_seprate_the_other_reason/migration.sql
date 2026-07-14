/*
  Warnings:

  - You are about to drop the column `notAttentReason` on the `DailyTask` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "DailyTask" DROP COLUMN "notAttentReason",
ADD COLUMN     "absentReason" TEXT,
ADD COLUMN     "remarkReason" TEXT;
