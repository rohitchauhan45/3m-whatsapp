/*
  Warnings:

  - You are about to drop the column `reason` on the `Task` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Task" DROP COLUMN "reason",
ADD COLUMN     "inProgressReason" TEXT,
ADD COLUMN     "remarkReason" TEXT;
