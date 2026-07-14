/*
  Warnings:

  - The values [onTrack] on the enum `TaskStaus` will be removed. If these variants are still used in the database, this will fail.

*/
-- CreateEnum
CREATE TYPE "DelayType" AS ENUM ('none', 'notStartedOnTime', 'exceededExpectedTime');

-- AlterEnum
BEGIN;
CREATE TYPE "TaskStaus_new" AS ENUM ('notSend', 'pending', 'inProgress', 'remark', 'completed', 'cancelled', 'deleted');
ALTER TABLE "Task" ALTER COLUMN "status" TYPE "TaskStaus_new" USING ("status"::text::"TaskStaus_new");
ALTER TYPE "TaskStaus" RENAME TO "TaskStaus_old";
ALTER TYPE "TaskStaus_new" RENAME TO "TaskStaus";
DROP TYPE "public"."TaskStaus_old";
COMMIT;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "delayType" "DelayType" NOT NULL DEFAULT 'none';
