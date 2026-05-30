import type { Prisma } from '@prisma/client';
import prisma from './db.js';

/** Keeps legacy `KYC` row in sync for Flutter `/api/kyc/me` when personal KYC is submitted via v2. */
export async function mirrorLegacyKycPersonalPending(
  userId: string,
  documentType: string,
): Promise<void> {
  const existing = await prisma.kYC.findUnique({ where: { userId } });
  const base: Record<string, unknown> =
    existing?.details && typeof existing.details === 'object' && !Array.isArray(existing.details)
      ? (existing.details as Record<string, unknown>)
      : {};
  const details: Prisma.InputJsonValue = {
    ...base,
    submittedAt: new Date().toISOString(),
    documentType,
  };
  await prisma.kYC.upsert({
    where: { userId },
    create: {
      userId,
      type: 'personal',
      status: 'pending',
      details,
    },
    update: {
      type: 'personal',
      status: 'pending',
      details,
    },
  });
}
