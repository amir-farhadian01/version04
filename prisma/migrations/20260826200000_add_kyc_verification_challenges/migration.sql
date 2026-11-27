CREATE TABLE "KycVerificationChallenge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "tokenHash" TEXT,
    "destinationHash" TEXT NOT NULL,
    "providerReference" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KycVerificationChallenge_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "KycVerificationChallenge_userId_channel_createdAt_idx"
ON "KycVerificationChallenge"("userId", "channel", "createdAt");
CREATE INDEX "KycVerificationChallenge_expiresAt_idx"
ON "KycVerificationChallenge"("expiresAt");
ALTER TABLE "KycVerificationChallenge" ADD CONSTRAINT "KycVerificationChallenge_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
