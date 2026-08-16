// ---------------------------------------------------------------------------
// Password Reset Tokens
// Issues and consumes single-use password reset tokens. Tokens are stored as
// SHA-256 hashes (never in plaintext) and expire after a short TTL.
// ---------------------------------------------------------------------------
import { createHash, randomBytes } from 'crypto';
import prisma from './db.js';

export const PASSWORD_RESET_TTL_MS = 15 * 60 * 1000; // 15 minutes

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Create a new password reset token for a user. Any previous outstanding
 * tokens for that user are invalidated (one active link at a time).
 * Returns the plaintext token to embed in the reset link.
 */
export async function createPasswordResetToken(userId: string): Promise<string> {
  await prisma.passwordResetToken.deleteMany({ where: { userId } });
  const token = randomBytes(32).toString('hex');
  await prisma.passwordResetToken.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
    },
  });
  return token;
}

export interface ConsumeResult {
  ok: boolean;
  userId: string | null;
  code: string | null;
  error: string | null;
}

/**
 * Validate and atomically mark a reset token as used. On success the token is
 * consumed exactly once, so a concurrent request cannot reuse it.
 */
export async function consumePasswordResetToken(token: string): Promise<ConsumeResult> {
  const tokenHash = hashToken(token);
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });
  if (!record) {
    return { ok: false, userId: null, code: 'INVALID_TOKEN', error: 'Invalid or expired token' };
  }
  if (record.usedAt) {
    return { ok: false, userId: null, code: 'TOKEN_USED', error: 'Token has already been used' };
  }
  if (record.expiresAt < new Date()) {
    return { ok: false, userId: null, code: 'TOKEN_EXPIRED', error: 'Token has expired' };
  }

  const claimed = await prisma.passwordResetToken.updateMany({
    where: { id: record.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (claimed.count === 0) {
    return { ok: false, userId: null, code: 'TOKEN_USED', error: 'Token has already been used' };
  }

  return { ok: true, userId: record.userId, code: null, error: null };
}
