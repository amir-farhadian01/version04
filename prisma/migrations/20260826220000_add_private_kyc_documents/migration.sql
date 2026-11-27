CREATE TABLE "KycDocument" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "storagePath" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "KycDocument_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "KycDocument_ownerId_createdAt_idx" ON "KycDocument"("ownerId", "createdAt");
ALTER TABLE "KycDocument" ADD CONSTRAINT "KycDocument_ownerId_fkey"
FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
