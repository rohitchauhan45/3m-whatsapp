/*
  Warnings:

  - Added the required column `number` to the `WhatsAppConversation` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "WhatsAppConversation" ADD COLUMN     "number" TEXT NOT NULL;
