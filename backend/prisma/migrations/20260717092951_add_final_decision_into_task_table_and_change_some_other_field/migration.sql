/*
  Warnings:

  - The values [completed,cancelled] on the enum `TaskStaus` will be removed. If these variants are still used in the database, this will fail.
  - Added the required column `position` to the `Task` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "TaskFinalStatus" AS ENUM ('blocked', 'completed', 'cancelled');

-- AlterEnum
BEGIN;
CREATE TYPE "TaskStaus_new" AS ENUM ('notSend', 'pending', 'inProgress', 'remark', 'deleted');
ALTER TABLE "public"."Task" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Task" ALTER COLUMN "status" TYPE "TaskStaus_new" USING ("status"::text::"TaskStaus_new");
ALTER TYPE "TaskStaus" RENAME TO "TaskStaus_old";
ALTER TYPE "TaskStaus_new" RENAME TO "TaskStaus";
DROP TYPE "public"."TaskStaus_old";
ALTER TABLE "Task" ALTER COLUMN "status" SET DEFAULT 'notSend';
COMMIT;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "finaldecision" "TaskFinalStatus",
ADD COLUMN     "position" INTEGER NOT NULL;
