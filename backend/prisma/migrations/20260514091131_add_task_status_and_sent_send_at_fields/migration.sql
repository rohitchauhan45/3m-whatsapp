-- CreateEnum
CREATE TYPE "TaskStaus" AS ENUM ('inProgress', 'remark', 'complete', 'delete');

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "sendAt" TIMESTAMP(3),
ADD COLUMN     "sent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "status" "TaskStaus" NOT NULL DEFAULT 'remark';
