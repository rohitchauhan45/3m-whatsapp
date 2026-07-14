-- CreateEnum
CREATE TYPE "Setting" AS ENUM ('onTrackmsg');

-- CreateTable
CREATE TABLE "AdminSettings" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "name" "Setting" NOT NULL,
    "isEnable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdminSettings_adminId_idx" ON "AdminSettings"("adminId");

-- CreateIndex
CREATE INDEX "WhatsAppConversation_userId_idx" ON "WhatsAppConversation"("userId");

-- AddForeignKey
ALTER TABLE "AdminSettings" ADD CONSTRAINT "AdminSettings_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
