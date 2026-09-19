import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import prisma from './db.js';

const CHALLENGE_TTL_MS = 15 * 60 * 1000;
const START_WINDOW_MS = 15 * 60 * 1000;
const MAX_STARTS_PER_WINDOW = 5;
const MAX_CONFIRM_ATTEMPTS = 5;

type Channel = 'email' | 'phone';
interface ChallengeRow { id: string; tokenHash: string | null; attempts: number }

export class KycVerificationError extends Error {
  constructor(message: string, public readonly status: 429 | 503) { super(message); }
}

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function secureHashEqual(left: string, right: string): boolean {
  const a = Buffer.from(hash(left), 'hex');
  const b = Buffer.from(right, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

function requireProviderConfig(names: string[]): void {
  const missing = names.filter((name) => !process.env[name]?.trim());
  if (missing.length) throw new KycVerificationError('Verification provider is temporarily unavailable', 503);
}

async function enforceStartLimit(userId: string, channel: Channel, now: Date): Promise<void> {
  const since = new Date(now.getTime() - START_WINDOW_MS);
  const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count FROM "KycVerificationChallenge"
    WHERE "userId" = ${userId} AND "channel" = ${channel} AND "createdAt" >= ${since}
  `;
  const count = Number(rows[0]?.count ?? 0);
  if (count >= MAX_STARTS_PER_WINDOW) throw new KycVerificationError('Too many verification requests; retry later', 429);
}

async function sendPostmarkVerification(email: string, token: string): Promise<string | null> {
  requireProviderConfig(['POSTMARK_SERVER_TOKEN', 'POSTMARK_FROM_EMAIL', 'APP_URL']);
  const response = await fetch('https://api.postmarkapp.com/email', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
      'x-postmark-server-token': process.env.POSTMARK_SERVER_TOKEN!,
    },
    body: JSON.stringify({
      From: process.env.POSTMARK_FROM_EMAIL,
      To: email,
      Subject: 'Verify your Neighborly email',
      TextBody: `Verify your email: ${process.env.APP_URL!.replace(/\/$/, '')}/verify-email?token=${encodeURIComponent(token)}`,
      MessageStream: process.env.POSTMARK_MESSAGE_STREAM || 'outbound',
    }),
  });
  if (!response.ok) throw new Error(`Postmark verification request failed (${response.status})`);
  const result = await response.json() as { MessageID?: string };
  return result.MessageID ?? null;
}

async function sendTwilioVerification(phone: string): Promise<string | null> {
  requireProviderConfig(['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_VERIFY_SERVICE_SID']);
  const service = encodeURIComponent(process.env.TWILIO_VERIFY_SERVICE_SID!);
  const auth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');
  const body = new URLSearchParams({ To: phone, Channel: 'sms' });
  const response = await fetch(`https://verify.twilio.com/v2/Services/${service}/Verifications`, {
    method: 'POST', headers: { authorization: `Basic ${auth}`, 'content-type': 'application/x-www-form-urlencoded' }, body,
  });
  if (!response.ok) throw new Error(`Twilio verification request failed (${response.status})`);
  const result = await response.json() as { sid?: string };
  return result.sid ?? null;
}

export async function startEmailVerification(userId: string, email: string, now = new Date()): Promise<void> {
  await enforceStartLimit(userId, 'email', now);
  const token = randomBytes(32).toString('base64url');
  const providerReference = await sendPostmarkVerification(email, token);
  await prisma.$executeRaw`
    INSERT INTO "KycVerificationChallenge"
      ("id", "userId", "channel", "tokenHash", "destinationHash", "providerReference", "expiresAt", "createdAt")
    VALUES (${randomUUID()}, ${userId}, 'email', ${hash(token)}, ${hash(email.toLowerCase())}, ${providerReference},
      ${new Date(now.getTime() + CHALLENGE_TTL_MS)}, ${now})
  `;
}

export async function confirmEmailVerification(userId: string, token: string, now = new Date()): Promise<boolean> {
  const rows = await prisma.$queryRaw<ChallengeRow[]>`
    SELECT "id", "tokenHash", "attempts" FROM "KycVerificationChallenge"
    WHERE "userId" = ${userId} AND "channel" = 'email' AND "consumedAt" IS NULL AND "expiresAt" > ${now}
    ORDER BY "createdAt" DESC LIMIT 1
  `;
  const challenge = rows[0];
  if (!challenge?.tokenHash || challenge.attempts >= MAX_CONFIRM_ATTEMPTS) return false;
  if (!secureHashEqual(token, challenge.tokenHash)) {
    await prisma.$executeRaw`UPDATE "KycVerificationChallenge" SET "attempts" = "attempts" + 1 WHERE "id" = ${challenge.id}`;
    return false;
  }
  const claimed = await prisma.$executeRaw`
    UPDATE "KycVerificationChallenge" SET "consumedAt" = ${now}, "attempts" = "attempts" + 1
    WHERE "id" = ${challenge.id} AND "consumedAt" IS NULL
  `;
  return claimed === 1;
}

export async function startPhoneVerification(userId: string, phone: string, now = new Date()): Promise<void> {
  await enforceStartLimit(userId, 'phone', now);
  const providerReference = await sendTwilioVerification(phone);
  await prisma.$executeRaw`
    INSERT INTO "KycVerificationChallenge"
      ("id", "userId", "channel", "destinationHash", "providerReference", "expiresAt", "createdAt")
    VALUES (${randomUUID()}, ${userId}, 'phone', ${hash(phone)}, ${providerReference},
      ${new Date(now.getTime() + CHALLENGE_TTL_MS)}, ${now})
  `;
}

export async function confirmPhoneVerification(userId: string, phone: string, code: string, now = new Date()): Promise<boolean> {
  const rows = await prisma.$queryRaw<ChallengeRow[]>`
    SELECT "id", "tokenHash", "attempts" FROM "KycVerificationChallenge"
    WHERE "userId" = ${userId} AND "channel" = 'phone' AND "destinationHash" = ${hash(phone)}
      AND "consumedAt" IS NULL AND "expiresAt" > ${now}
    ORDER BY "createdAt" DESC LIMIT 1
  `;
  const challenge = rows[0];
  if (!challenge || challenge.attempts >= MAX_CONFIRM_ATTEMPTS) return false;
  requireProviderConfig(['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_VERIFY_SERVICE_SID']);
  const service = encodeURIComponent(process.env.TWILIO_VERIFY_SERVICE_SID!);
  const auth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');
  const response = await fetch(`https://verify.twilio.com/v2/Services/${service}/VerificationCheck`, {
    method: 'POST', headers: { authorization: `Basic ${auth}`, 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ To: phone, Code: code }),
  });
  const result = response.ok ? await response.json() as { status?: string } : null;
  if (result?.status === 'approved') {
    await prisma.$executeRaw`UPDATE "KycVerificationChallenge" SET "attempts" = "attempts" + 1, "consumedAt" = ${now} WHERE "id" = ${challenge.id} AND "consumedAt" IS NULL`;
  } else {
    await prisma.$executeRaw`UPDATE "KycVerificationChallenge" SET "attempts" = "attempts" + 1 WHERE "id" = ${challenge.id}`;
  }
  return result?.status === 'approved';
}
