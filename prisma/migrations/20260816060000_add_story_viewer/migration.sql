-- CreateTable: StoryViewer (mapped to "story_viewers")
CREATE TABLE "story_viewers" (
    "id" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "story_viewers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "story_viewers_storyId_userId_key" ON "story_viewers"("storyId", "userId");

-- AddForeignKey
ALTER TABLE "story_viewers" ADD CONSTRAINT "story_viewers_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "stories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "story_viewers" ADD CONSTRAINT "story_viewers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
