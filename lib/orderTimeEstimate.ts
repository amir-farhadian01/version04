/**
 * lib/orderTimeEstimate.ts — Time Estimation Module (F1)
 *
 * Computes estimated remaining time for each order phase based on urgency.
 * Used by the Customer Dashboard for live order status polling.
 */

import type { OrderStatus, OrderUrgency } from '@prisma/client';

// ─── Types ──────────────────────────────────────────────────────────────────

/**
 * The phase values used for time estimation.
 * These correspond to OrderStatus values that represent active phases
 * where time estimation is meaningful.
 */
export type OrderPhase =
  | 'matching'
  | 'quoting'
  | 'negotiation'
  | 'contracted'
  | 'paid'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'disputed';

/**
 * Urgency level for time estimation.
 * Extends Prisma's OrderUrgency with a 'low' variant for finer granularity.
 */
export type Urgency = OrderUrgency | 'low';

/**
 * Input shape for estimateRemainingTime.
 */
export interface OrderTimeInput {
  phase: OrderPhase;
  urgency: Urgency;
  createdAt: Date;
  updatedAt: Date;
  /** Optional job record with service duration info (used for in_progress phase) */
  jobRecord?: {
    /** Estimated duration in minutes for the service being performed */
    estimatedDurationMinutes?: number | null;
  } | null;
}

/**
 * Output shape for estimateRemainingTime.
 */
export interface RemainingTimeResult {
  remainingMs: number;
  totalMs: number;
  elapsedMs: number;
  percentage: number;
}

// ─── Duration Tables (in minutes) ──────────────────────────────────────────

const PHASE_DURATIONS: Record<OrderPhase, Record<Urgency, number>> = {
  matching:     { low: 30, standard: 15, urgent: 5,  emergency: 2 },
  quoting:      { low: 60, standard: 30, urgent: 15, emergency: 5 },
  negotiation:  { low: 120, standard: 60, urgent: 30, emergency: 15 },
  contracted:   { low: 1440, standard: 720, urgent: 360, emergency: 120 },
  paid:         { low: 0, standard: 0, urgent: 0, emergency: 0 },
  in_progress:  { low: 120, standard: 120, urgent: 120, emergency: 120 }, // fallback; jobRecord overrides
  completed:    { low: 0, standard: 0, urgent: 0, emergency: 0 },
  cancelled:    { low: 0, standard: 0, urgent: 0, emergency: 0 },
  disputed:     { low: 0, standard: 0, urgent: 0, emergency: 0 },
};

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Convert minutes to milliseconds. */
function minToMs(minutes: number): number {
  return minutes * 60 * 1000;
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Returns estimated duration in milliseconds for a given phase based on urgency level.
 *
 * For `in_progress`, if a `jobRecord` with `estimatedDurationMinutes` is provided,
 * that value is used instead of the default fallback.
 */
export function estimatePhaseDuration(
  phase: OrderPhase,
  urgency: Urgency,
  jobRecord?: { estimatedDurationMinutes?: number | null } | null,
): number {
  if (phase === 'in_progress' && jobRecord?.estimatedDurationMinutes != null) {
    return minToMs(jobRecord.estimatedDurationMinutes);
  }
  return minToMs(PHASE_DURATIONS[phase][urgency]);
}

/**
 * Computes how much time is left for the current phase.
 *
 * - `totalMs` = `estimatePhaseDuration(order.phase, order.urgency)`
 * - `elapsedMs` = `Date.now() - order.updatedAt.getTime()` (uses `updatedAt` as phase start time)
 * - `remainingMs` = `Math.max(0, totalMs - elapsedMs)`
 * - `percentage` = `Math.min(100, Math.round((elapsedMs / totalMs) * 100))`
 *
 * If `totalMs === 0`, returns a zeroed result with `percentage: 100`.
 */
export function estimateRemainingTime(order: OrderTimeInput): RemainingTimeResult {
  const totalMs = estimatePhaseDuration(order.phase, order.urgency, order.jobRecord);

  if (totalMs === 0) {
    return { remainingMs: 0, totalMs: 0, elapsedMs: 0, percentage: 100 };
  }

  const elapsedMs = Date.now() - order.updatedAt.getTime();
  const remainingMs = Math.max(0, totalMs - elapsedMs);
  const percentage = Math.min(100, Math.round((elapsedMs / totalMs) * 100));

  return { remainingMs, totalMs, elapsedMs, percentage };
}

/**
 * Formats milliseconds into a human-readable string.
 *
 * - `< 1 min` → "Less than a minute"
 * - `< 60 min` → "X min"
 * - `< 1440 min` → "X hr Y min"
 * - `>= 1440 min` → "X day Y hr"
 */
export function formatRemainingTime(ms: number): string {
  if (ms < 60_000) {
    return 'Less than a minute';
  }

  const totalMinutes = Math.ceil(ms / 60_000);

  if (totalMinutes < 60) {
    return `${totalMinutes} min`;
  }

  if (totalMinutes < 1440) {
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return mins > 0 ? `${hours} hr ${mins} min` : `${hours} hr`;
  }

  const days = Math.floor(totalMinutes / 1440);
  const remainingHours = Math.floor((totalMinutes % 1440) / 60);
  return remainingHours > 0 ? `${days} day ${remainingHours} hr` : `${days} day`;
}

/**
 * Returns Persian/Farsi labels for each order phase.
 */
export function getPhaseLabel(phase: OrderPhase): string {
  const labels: Record<OrderPhase, string> = {
    matching:     'در حال پیدا کردن متخصص',
    quoting:      'در انتظار پیشنهاد قیمت',
    negotiation:  'در حال مذاکره',
    contracted:   'در انتظار تایید قرارداد',
    paid:         'پرداخت شده',
    in_progress:  'در حال انجام',
    completed:    'تکمیل شده',
    cancelled:    'لغو شده',
    disputed:     'مختومه',
  };
  return labels[phase];
}
