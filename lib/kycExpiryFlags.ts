import type { BusinessKycFormV1 } from './kycTypes.js';

export type ExpiryFlagEntry = {
  expiresAt: string;
  monthsRemaining: number;
  passesThreshold: boolean;
};

function parseDateAnswer(raw: unknown): Date | null {
  if (raw == null) return null;
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) return raw;
  if (typeof raw === 'string') {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) return d;
  }
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

/** Whole months from `from` until `to` (approximate; day-of-month aware). */
export function wholeMonthsBetween(from: Date, to: Date): number {
  let months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  if (to.getDate() < from.getDate()) months -= 1;
  return months;
}

/**
 * For each date field with `expiryMinMonths`, compute expiry metadata from answers.
 */
export function computeExpiryFlags(
  form: BusinessKycFormV1,
  answers: Record<string, unknown>,
): Record<string, ExpiryFlagEntry> {
  const out: Record<string, ExpiryFlagEntry> = {};
  const now = new Date();
  for (const field of form.fields) {
    if (field.type !== 'date' || field.expiryMinMonths == null) continue;
    const exp = parseDateAnswer(answers[field.id]);
    if (!exp) continue;
    const monthsRemaining = wholeMonthsBetween(now, exp);
    const minM = field.expiryMinMonths;
    out[field.id] = {
      expiresAt: exp.toISOString(),
      monthsRemaining,
      passesThreshold: monthsRemaining >= minM,
    };
  }
  return out;
}
