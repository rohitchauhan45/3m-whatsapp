/*
  Warnings:

  - You are about to drop the column `lastIncominMessageAt` on the `WhatsAppConversation` table. All the data in the column will be lost.
  - You are about to drop the column `lastSentMesageAt` on the `WhatsAppConversation` table. All the data in the column will be lost.
  - You are about to drop the column `lastSentMesageStatus` on the `WhatsAppConversation` table. All the data in the column will be lost.
  - The `lastSentMessageType` column on the `WhatsAppConversation` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Changed the type of `type` on the `Message` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterEnum
ALTER TYPE "MessageStyle" ADD VALUE 'INTERACTIVE';

-- AlterTable
ALTER TABLE "Message" DROP COLUMN "type",
ADD COLUMN     "type" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "WhatsAppConversation" DROP COLUMN "lastIncominMessageAt",
DROP COLUMN "lastSentMesageAt",
DROP COLUMN "lastSentMesageStatus",
ADD COLUMN     "lastIncomingMessageAt" TIMESTAMP(3),
ADD COLUMN     "lastSentMessageAt" TIMESTAMP(3),
ADD COLUMN     "lastSentMessageStatus" "messageStatus",
DROP COLUMN "lastSentMessageType",
ADD COLUMN     "lastSentMessageType" TEXT;

-- DropEnum
DROP TYPE "MessageType";

-- CreateIndex
CREATE INDEX "Message_type_status_idx" ON "Message"("type", "status");
