/*
  Warnings:

  - You are about to drop the column `inProgressReason` on the `Task` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Task" DROP COLUMN "inProgressReason",
ADD COLUMN     "actualTime" TEXT,
ADD COLUMN     "extratTme" TEXT,
ADD COLUMN     "howmuchComplete" TEXT,
ADD COLUMN     "totalTime" TEXT;
