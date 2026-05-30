/**
 * lib/orderTimeEstimate.test.ts — Tests for F1 Time Estimation Module
 *
 * Tests estimatePhaseDuration, estimateRemainingTime, formatRemainingTime,
 * and getPhaseLabel.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { OrderPhase, Urgency, OrderTimeInput } from './orderTimeEstimate.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Create a fixed Date for deterministic tests.
 * Base: 2026-05-26T12:00:00.000Z
 */
function makeDate(offsetMinutes = 0): Date {
  return new Date(2026, 4, 26, 12, offsetMinutes, 0, 0); // month 4 = May
}

/**
 * Build an OrderTimeInput with sensible defaults.
 */
function makeOrderInput(overrides: Partial<OrderTimeInput> & { phase: OrderPhase; urgency: Urgency }): OrderTimeInput {
  return {
    createdAt: makeDate(-60), // created 1 hour ago
    updatedAt: makeDate(0),   // phase started now
    jobRecord: null,
    ...overrides,
  };
}

// ─── Tests: estimatePhaseDuration ───────────────────────────────────────────

describe('estimatePhaseDuration', () => {
  it('returns correct duration for matching phase across all urgency levels', async () => {
    const { estimatePhaseDuration } = await import('./orderTimeEstimate.js');

    // low urgency → 30 min = 1_800_000 ms
    expect(estimatePhaseDuration('matching', 'low')).toBe(30 * 60 * 1000);
    // standard urgency → 15 min = 900_000 ms
    expect(estimatePhaseDuration('matching', 'standard')).toBe(15 * 60 * 1000);
    // urgent → 5 min = 300_000 ms
    expect(estimatePhaseDuration('matching', 'urgent')).toBe(5 * 60 * 1000);
    // emergency → 2 min = 120_000 ms
    expect(estimatePhaseDuration('matching', 'emergency')).toBe(2 * 60 * 1000);
  });

  it('returns correct duration for quoting phase across all urgency levels', async () => {
    const { estimatePhaseDuration } = await import('./orderTimeEstimate.js');

    expect(estimatePhaseDuration('quoting', 'low')).toBe(60 * 60 * 1000);
    expect(estimatePhaseDuration('quoting', 'standard')).toBe(30 * 60 * 1000);
    expect(estimatePhaseDuration('quoting', 'urgent')).toBe(15 * 60 * 1000);
    expect(estimatePhaseDuration('quoting', 'emergency')).toBe(5 * 60 * 1000);
  });

  it('returns correct duration for negotiation phase across all urgency levels', async () => {
    const { estimatePhaseDuration } = await import('./orderTimeEstimate.js');

    expect(estimatePhaseDuration('negotiation', 'low')).toBe(120 * 60 * 1000);
    expect(estimatePhaseDuration('negotiation', 'standard')).toBe(60 * 60 * 1000);
    expect(estimatePhaseDuration('negotiation', 'urgent')).toBe(30 * 60 * 1000);
    expect(estimatePhaseDuration('negotiation', 'emergency')).toBe(15 * 60 * 1000);
  });

  it('returns correct duration for contracted phase across all urgency levels', async () => {
    const { estimatePhaseDuration } = await import('./orderTimeEstimate.js');

    expect(estimatePhaseDuration('contracted', 'low')).toBe(1440 * 60 * 1000);
    expect(estimatePhaseDuration('contracted', 'standard')).toBe(720 * 60 * 1000);
    expect(estimatePhaseDuration('contracted', 'urgent')).toBe(360 * 60 * 1000);
    expect(estimatePhaseDuration('contracted', 'emergency')).toBe(120 * 60 * 1000);
  });

  it('returns 0 for terminal phases (paid, completed, cancelled, disputed)', async () => {
    const { estimatePhaseDuration } = await import('./orderTimeEstimate.js');

    expect(estimatePhaseDuration('paid', 'standard')).toBe(0);
    expect(estimatePhaseDuration('completed', 'urgent')).toBe(0);
    expect(estimatePhaseDuration('cancelled', 'emergency')).toBe(0);
    expect(estimatePhaseDuration('disputed', 'low')).toBe(0);
  });

  it('uses jobRecord.estimatedDurationMinutes for in_progress phase', async () => {
    const { estimatePhaseDuration } = await import('./orderTimeEstimate.js');

    const jobRecord = { estimatedDurationMinutes: 180 }; // 3 hours
    const result = estimatePhaseDuration('in_progress', 'standard', jobRecord);
    expect(result).toBe(180 * 60 * 1000);
  });

  it('falls back to default 120 min for in_progress when no jobRecord provided', async () => {
    const { estimatePhaseDuration } = await import('./orderTimeEstimate.js');

    expect(estimatePhaseDuration('in_progress', 'standard')).toBe(120 * 60 * 1000);
    expect(estimatePhaseDuration('in_progress', 'urgent')).toBe(120 * 60 * 1000);
    expect(estimatePhaseDuration('in_progress', 'emergency')).toBe(120 * 60 * 1000);
  });

  it('falls back to default 120 min for in_progress when jobRecord has null duration', async () => {
    const { estimatePhaseDuration } = await import('./orderTimeEstimate.js');

    const jobRecord = { estimatedDurationMinutes: null };
    expect(estimatePhaseDuration('in_progress', 'standard', jobRecord)).toBe(120 * 60 * 1000);
  });
});

// ─── Tests: estimateRemainingTime ───────────────────────────────────────────

describe('estimateRemainingTime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Pin "now" to 2026-05-26T12:00:00.000Z
    vi.setSystemTime(new Date(2026, 4, 26, 12, 0, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns 100% when phase is completed (totalMs === 0)', async () => {
    const { estimateRemainingTime } = await import('./orderTimeEstimate.js');

    const result = estimateRemainingTime(
      makeOrderInput({ phase: 'completed', urgency: 'standard' }),
    );

    expect(result).toEqual({
      remainingMs: 0,
      totalMs: 0,
      elapsedMs: 0,
      percentage: 100,
    });
  });

  it('returns 100% when phase is paid (totalMs === 0)', async () => {
    const { estimateRemainingTime } = await import('./orderTimeEstimate.js');

    const result = estimateRemainingTime(
      makeOrderInput({ phase: 'paid', urgency: 'urgent' }),
    );

    expect(result).toEqual({
      remainingMs: 0,
      totalMs: 0,
      elapsedMs: 0,
      percentage: 100,
    });
  });

  it('returns correct percentage for partial elapsed time', async () => {
    const { estimateRemainingTime } = await import('./orderTimeEstimate.js');

    // matching + standard = 15 min total = 900_000 ms
    // updatedAt = 12:00, now = 12:00 → elapsed = 0 → percentage = 0
    const result = estimateRemainingTime(
      makeOrderInput({ phase: 'matching', urgency: 'standard' }),
    );

    expect(result.totalMs).toBe(15 * 60 * 1000);
    expect(result.elapsedMs).toBe(0);
    expect(result.remainingMs).toBe(15 * 60 * 1000);
    expect(result.percentage).toBe(0);
  });

  it('returns correct percentage when half the time has elapsed', async () => {
    const { estimateRemainingTime } = await import('./orderTimeEstimate.js');

    // matching + standard = 15 min total = 900_000 ms
    // Set updatedAt to 7.5 min ago → 50% elapsed
    const sevenAndHalfMinAgo = new Date(2026, 4, 26, 11, 52, 30, 0); // 12:00 - 7.5 min
    const result = estimateRemainingTime(
      makeOrderInput({ phase: 'matching', urgency: 'standard', updatedAt: sevenAndHalfMinAgo }),
    );

    expect(result.totalMs).toBe(15 * 60 * 1000);
    expect(result.elapsedMs).toBe(7.5 * 60 * 1000);
    expect(result.remainingMs).toBe(7.5 * 60 * 1000);
    expect(result.percentage).toBe(50);
  });

  it('returns 0 remaining and 100% when phase duration has fully elapsed', async () => {
    const { estimateRemainingTime } = await import('./orderTimeEstimate.js');

    // matching + urgent = 5 min total = 300_000 ms
    // Set updatedAt to 10 min ago → over the limit
    const tenMinAgo = new Date(2026, 4, 26, 11, 50, 0, 0);
    const result = estimateRemainingTime(
      makeOrderInput({ phase: 'matching', urgency: 'urgent', updatedAt: tenMinAgo }),
    );

    expect(result.totalMs).toBe(5 * 60 * 1000);
    expect(result.elapsedMs).toBe(10 * 60 * 1000);
    expect(result.remainingMs).toBe(0);
    expect(result.percentage).toBe(100);
  });

  it('caps percentage at 100 even when elapsed exceeds total', async () => {
    const { estimateRemainingTime } = await import('./orderTimeEstimate.js');

    // quoting + emergency = 5 min total = 300_000 ms
    // Set updatedAt to 60 min ago → way over
    const sixtyMinAgo = new Date(2026, 4, 26, 11, 0, 0, 0);
    const result = estimateRemainingTime(
      makeOrderInput({ phase: 'quoting', urgency: 'emergency', updatedAt: sixtyMinAgo }),
    );

    expect(result.remainingMs).toBe(0);
    expect(result.percentage).toBe(100);
  });
});

// ─── Tests: formatRemainingTime ─────────────────────────────────────────────

describe('formatRemainingTime', () => {
  it('returns "Less than a minute" for < 1 min', async () => {
    const { formatRemainingTime } = await import('./orderTimeEstimate.js');

    expect(formatRemainingTime(30_000)).toBe('Less than a minute');   // 30 sec
    expect(formatRemainingTime(59_999)).toBe('Less than a minute');   // < 1 min
    expect(formatRemainingTime(0)).toBe('Less than a minute');
  });

  it('returns "X min" for < 60 min', async () => {
    const { formatRemainingTime } = await import('./orderTimeEstimate.js');

    expect(formatRemainingTime(60_000)).toBe('1 min');          // 1 min
    expect(formatRemainingTime(5 * 60_000)).toBe('5 min');     // 5 min
    expect(formatRemainingTime(59 * 60_000)).toBe('59 min');   // 59 min
  });

  it('returns "X hr Y min" for < 1440 min', async () => {
    const { formatRemainingTime } = await import('./orderTimeEstimate.js');

    expect(formatRemainingTime(60 * 60_000)).toBe('1 hr');           // 1 hr exactly
    expect(formatRemainingTime(90 * 60_000)).toBe('1 hr 30 min');    // 1.5 hr
    expect(formatRemainingTime(150 * 60_000)).toBe('2 hr 30 min');   // 2.5 hr
    expect(formatRemainingTime(1439 * 60_000)).toBe('23 hr 59 min'); // just under 1 day
  });

  it('returns "X day Y hr" for >= 1440 min', async () => {
    const { formatRemainingTime } = await import('./orderTimeEstimate.js');

    expect(formatRemainingTime(1440 * 60_000)).toBe('1 day');            // exactly 1 day
    expect(formatRemainingTime(1500 * 60_000)).toBe('1 day 1 hr');       // 1 day 1 hr
    expect(formatRemainingTime(2880 * 60_000)).toBe('2 day');            // 2 days exactly
    expect(formatRemainingTime(3000 * 60_000)).toBe('2 day 2 hr');       // 2 days 2 hr
  });
});

// ─── Tests: getPhaseLabel ───────────────────────────────────────────────────

describe('getPhaseLabel', () => {
  it('returns correct Persian labels for all phases', async () => {
    const { getPhaseLabel } = await import('./orderTimeEstimate.js');

    expect(getPhaseLabel('matching')).toBe('در حال پیدا کردن متخصص');
    expect(getPhaseLabel('quoting')).toBe('در انتظار پیشنهاد قیمت');
    expect(getPhaseLabel('negotiation')).toBe('در حال مذاکره');
    expect(getPhaseLabel('contracted')).toBe('در انتظار تایید قرارداد');
    expect(getPhaseLabel('paid')).toBe('پرداخت شده');
    expect(getPhaseLabel('in_progress')).toBe('در حال انجام');
    expect(getPhaseLabel('completed')).toBe('تکمیل شده');
    expect(getPhaseLabel('cancelled')).toBe('لغو شده');
    expect(getPhaseLabel('disputed')).toBe('مختومه');
  });
});
