-- AlterTable
ALTER TABLE "User" ADD COLUMN     "googleId" TEXT;
ALTER TABLE "User" ADD COLUMN     "accountPreferences" JSONB;

-- CreateIndex
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");
