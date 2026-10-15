/*
  Warnings:

  - You are about to drop the column `lastIncomingAt` on the `WhatsAppConversation` table. All the data in the column will be lost.
  - You are about to drop the column `lastOutgoingAt` on the `WhatsAppConversation` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[number]` on the table `WhatsAppConversation` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('welcome', 'assignTask', 'assignTaskSummary', 'MorningOnTrack', 'taskFollowUp', 'taskfinalDecision', 'taskreportSummary', 'errorInBackend');

-- CreateEnum
CREATE TYPE "messageStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED');

-- CreateEnum
CREATE TYPE "MessageStyle" AS ENUM ('TEMPLATE', 'TEXT');

-- DropIndex
DROP INDEX "WhatsAppConversation_userId_idx";

-- AlterTable
ALTER TABLE "WhatsAppConversation" DROP COLUMN "lastIncomingAt",
DROP COLUMN "lastOutgoingAt",
ADD COLUMN     "lastIncominMessageAt" TIMESTAMP(3),
ADD COLUMN     "lastIncomingMessageId" TEXT,
ADD COLUMN     "lastIncomingMessageType" TEXT,
ADD COLUMN     "lastSentMesageAt" TIMESTAMP(3),
ADD COLUMN     "lastSentMesageStatus" "messageStatus",
ADD COLUMN     "lastSentMessageId" TEXT,
ADD COLUMN     "lastSentMessageStyle" "MessageStyle",
ADD COLUMN     "lastSentMessageType" "MessageType";

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "style" "MessageStyle" NOT NULL,
    "type" "MessageType" NOT NULL,
    "body" TEXT NOT NULL,
    "length" INTEGER NOT NULL,
    "whatsappMessageId" TEXT,
    "status" "messageStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sendAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "errorCode" TEXT,
    "errorTitle" TEXT,
    "errorDetails" TEXT,
    "errorPayload" JSONB,
    "attemptCount" INTEGER NOT NULL DEFAULT 1,
    "lastAttemptAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Message_whatsappMessageId_key" ON "Message"("whatsappMessageId");

-- CreateIndex
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "Message_status_createdAt_idx" ON "Message"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Message_type_status_idx" ON "Message"("type", "status");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppConversation_number_key" ON "WhatsAppConversation"("number");

-- CreateIndex
CREATE INDEX "WhatsAppConversation_windowExpiresAt_idx" ON "WhatsAppConversation"("windowExpiresAt");

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "WhatsAppConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
