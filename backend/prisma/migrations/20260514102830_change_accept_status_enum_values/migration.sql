/*
  Warnings:

  - The `accept` column on the `Task` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "AcceptStatus" AS ENUM ('accept', 'remaining', 'decline');

-- AlterTable
ALTER TABLE "Task" DROP COLUMN "accept",
ADD COLUMN     "accept" "AcceptStatus" NOT NULL DEFAULT 'remaining';
