-- CreateEnum
CREATE TYPE "PostMediaType" AS ENUM ('image', 'video');

-- CreateEnum
CREATE TYPE "StoryVisibility" AS ENUM ('PUBLIC', 'FOLLOWERS_ONLY');

-- CreateTable: Story (mapped to "stories")
CREATE TABLE "stories" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "mediaUrl" TEXT NOT NULL,
    "mediaType" "PostMediaType" NOT NULL DEFAULT 'image',
    "thumbnailUrl" TEXT,
    "caption" TEXT,
    "linkUrl" TEXT,
    "linkLabel" TEXT,
    "duration" INTEGER,
    "visibility" "StoryVisibility" NOT NULL DEFAULT 'PUBLIC',
    "views" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "stories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stories_authorId_idx" ON "stories"("authorId");
CREATE INDEX "stories_expiresAt_idx" ON "stories"("expiresAt");
CREATE INDEX "stories_createdAt_idx" ON "stories"("createdAt");

-- AddForeignKey
ALTER TABLE "stories" ADD CONSTRAINT "stories_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
