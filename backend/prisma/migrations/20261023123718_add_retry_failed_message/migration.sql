-- CreateTable
CREATE TABLE "RetryFailedMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "dailyTaskId" TEXT NOT NULL,
    "messageId" TEXT,
    "type" TEXT NOT NULL DEFAULT 'assignTask',
    "errorCode" TEXT,
    "errorTitle" TEXT,
    "errorDetails" TEXT,
    "failedAt" TIMESTAMP(3) NOT NULL,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "lastRetryAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RetryFailedMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RetryFailedMessage_dailyTaskId_key" ON "RetryFailedMessage"("dailyTaskId");

-- CreateIndex
CREATE INDEX "RetryFailedMessage_conversationId_idx" ON "RetryFailedMessage"("conversationId");

-- CreateIndex
CREATE INDEX "RetryFailedMessage_resolvedAt_idx" ON "RetryFailedMessage"("resolvedAt");

-- AddForeignKey
ALTER TABLE "RetryFailedMessage" ADD CONSTRAINT "RetryFailedMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "WhatsAppConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetryFailedMessage" ADD CONSTRAINT "RetryFailedMessage_dailyTaskId_fkey" FOREIGN KEY ("dailyTaskId") REFERENCES "DailyTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
