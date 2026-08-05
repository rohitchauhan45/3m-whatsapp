-- CreateTable
CREATE TABLE "DraftTask" (
    "id" TEXT NOT NULL,
    "uname" TEXT NOT NULL,
    "number" TEXT,
    "date" TIMESTAMP(3),
    "tname" TEXT NOT NULL,
    "start" TEXT,
    "end" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "addedbyId" TEXT NOT NULL,

    CONSTRAINT "DraftTask_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "DraftTask" ADD CONSTRAINT "DraftTask_addedbyId_fkey" FOREIGN KEY ("addedbyId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
