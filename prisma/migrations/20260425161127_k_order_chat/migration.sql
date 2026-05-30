-- CreateEnum
CREATE TYPE "ChatMessageType" AS ENUM ('text', 'system');

-- CreateEnum
CREATE TYPE "ChatModerationStatus" AS ENUM ('clean', 'masked', 'blocked', 'flagged');

-- CreateTable
CREATE TABLE "OrderChatThread" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderChatThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderChatMessage" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "senderRole" TEXT NOT NULL,
    "type" "ChatMessageType" NOT NULL DEFAULT 'text',
    "originalText" TEXT NOT NULL,
    "displayText" TEXT NOT NULL,
    "moderationStatus" "ChatModerationStatus" NOT NULL DEFAULT 'clean',
    "moderationReasons" JSONB,
    "sourceLang" TEXT,
    "targetLang" TEXT,
    "translatedText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editedAt" TIMESTAMP(3),
    "metadata" JSONB,

    CONSTRAINT "OrderChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrderChatThread_orderId_key" ON "OrderChatThread"("orderId");

-- CreateIndex
CREATE INDEX "OrderChatThread_customerId_idx" ON "OrderChatThread"("customerId");

-- CreateIndex
CREATE INDEX "OrderChatThread_providerId_idx" ON "OrderChatThread"("providerId");

-- CreateIndex
CREATE INDEX "OrderChatMessage_threadId_createdAt_idx" ON "OrderChatMessage"("threadId", "createdAt");

-- CreateIndex
CREATE INDEX "OrderChatMessage_moderationStatus_createdAt_idx" ON "OrderChatMessage"("moderationStatus", "createdAt");

-- AddForeignKey
ALTER TABLE "OrderChatThread" ADD CONSTRAINT "OrderChatThread_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderChatMessage" ADD CONSTRAINT "OrderChatMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "OrderChatThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
