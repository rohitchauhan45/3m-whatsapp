/*
  Warnings:

  - The values [complete,delete] on the enum `TaskStaus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `accept` on the `Task` table. All the data in the column will be lost.
  - You are about to drop the column `date` on the `Task` table. All the data in the column will be lost.
  - Added the required column `dailyTaskId` to the `Task` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "TaskStaus_new" AS ENUM ('pending', 'inProgress', 'remark', 'completed', 'cancelled', 'deleted');
ALTER TABLE "Task" ALTER COLUMN "status" TYPE "TaskStaus_new" USING ("status"::text::"TaskStaus_new");
ALTER TYPE "TaskStaus" RENAME TO "TaskStaus_old";
ALTER TYPE "TaskStaus_new" RENAME TO "TaskStaus";
DROP TYPE "public"."TaskStaus_old";
COMMIT;

-- AlterTable
ALTER TABLE "Task" DROP COLUMN "accept",
DROP COLUMN "date",
ADD COLUMN     "dailyTaskId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "DailyTask" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "AcceptStatus",
    "notAttentReason" TEXT,
    "sent" BOOLEAN NOT NULL DEFAULT false,
    "sendAt" TIMESTAMP(3) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "DailyTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DailyTask_userId_idx" ON "DailyTask"("userId");

-- CreateIndex
CREATE INDEX "DailyTask_deletedAt_idx" ON "DailyTask"("deletedAt");

-- CreateIndex
CREATE INDEX "Task_dailyTaskId_idx" ON "Task"("dailyTaskId");

-- AddForeignKey
ALTER TABLE "DailyTask" ADD CONSTRAINT "DailyTask_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_dailyTaskId_fkey" FOREIGN KEY ("dailyTaskId") REFERENCES "DailyTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
