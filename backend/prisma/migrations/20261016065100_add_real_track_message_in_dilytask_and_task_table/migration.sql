/*
  Warnings:

  - You are about to drop the column `sent` on the `DailyTask` table. All the data in the column will be lost.
  - You are about to drop the column `sent` on the `Task` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "DailyTask" DROP COLUMN "sent",
ADD COLUMN     "deliveryStatus" "messageStatus";

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "dailyTaskId" TEXT,
ADD COLUMN     "taskId" TEXT;

-- AlterTable
ALTER TABLE "Task" DROP COLUMN "sent",
ADD COLUMN     "deliveryStatus" "messageStatus";
