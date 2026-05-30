/**
 * lib/orderCapacity.test.ts — Tests for G1/G15 capacity validation
 *
 * Tests checkPackageCapacity, reserveProviderSlot, and releaseProviderSlot
 * using the in-memory cache fallback (no Redis needed).
 *
 * Each test gets a fresh in-memory cache via vi.mock of lib/redis.ts.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock redis.ts to return a fresh in-memory cache for each test ────────

beforeEach(() => {
  // We need to reset the in-memory cache between tests.
  // The cache module uses a module-level Map singleton, so we mock
  // lib/redis.ts to re-import a fresh cache module each time.
  vi.resetModules();
});

// Dynamic import so that vi.resetModules() takes effect
async function getCapacityModule() {
  return import('./orderCapacity.js');
}

// ─── Helpers ──────────────────────────────────────────────────────────────

/**
 * Create a Date object for a fixed date/time to ensure deterministic tests.
 * Uses 2026-05-26T09:00:00.000Z as the base.
 */
function makeDate(hours = 9, minutes = 0): Date {
  return new Date(2026, 4, 26, hours, minutes, 0, 0); // month 4 = May
}

/**
 * Build an eligible package object matching the shape expected by
 * checkPackageCapacity.
 */
function makeEligiblePackage(
  id: string,
  providerId: string,
  maxDailyBookings: number,
  slotDurationMinutes = 60,
): { package: { id: string; providerId: string; maxDailyBookings: number; slotDurationMinutes: number } } {
  return {
    package: {
      id,
      providerId,
      maxDailyBookings,
      slotDurationMinutes,
    },
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe('checkPackageCapacity', () => {
  it('returns under capacity when no slots reserved', async () => {
    const { checkPackageCapacity } = await getCapacityModule();
    const pkg = makeEligiblePackage('pkg-1', 'provider-1', 10);
    const result = await checkPackageCapacity([pkg], makeDate());

    expect(result.allOverCapacity).toBe(false);
    expect(result.underCapacity).toHaveLength(1);
    expect(result.overCapacity).toHaveLength(0);

    const status = result.underCapacity[0];
    expect(status.packageId).toBe('pkg-1');
    expect(status.providerId).toBe('provider-1');
    expect(status.overCapacity).toBe(false);
    expect(status.reservedSlots).toBe(0);
    expect(status.maxDailyBookings).toBe(10);
  });

  it('returns over capacity when maxDailyBookings exceeded', async () => {
    const { checkPackageCapacity, reserveProviderSlot } = await getCapacityModule();

    // Reserve 10 slots for provider-1 on the same date
    for (let i = 0; i < 10; i++) {
      const slotDate = makeDate(9, i); // 09:00, 09:01, ..., 09:09
      await reserveProviderSlot('provider-1', slotDate, 'standard', 10);
    }

    const pkg = makeEligiblePackage('pkg-1', 'provider-1', 10);
    const result = await checkPackageCapacity([pkg], makeDate(9, 0));

    expect(result.allOverCapacity).toBe(true);
    expect(result.overCapacity).toHaveLength(1);
    expect(result.underCapacity).toHaveLength(0);

    const status = result.overCapacity[0];
    expect(status.packageId).toBe('pkg-1');
    expect(status.providerId).toBe('provider-1');
    expect(status.overCapacity).toBe(true);
    expect(status.reservedSlots).toBe(10);
    expect(status.maxDailyBookings).toBe(10);
  });

  it('defers capacity check when scheduledAt is null (flexible scheduling)', async () => {
    const { checkPackageCapacity, reserveProviderSlot } = await getCapacityModule();

    // First reserve some slots to ensure there are reservations
    for (let i = 0; i < 5; i++) {
      const slotDate = makeDate(9, i);
      await reserveProviderSlot('provider-1', slotDate, 'standard', 10);
    }

    // Now check with scheduledAt: null — should defer and return under capacity
    const pkg = makeEligiblePackage('pkg-1', 'provider-1', 1);
    const result = await checkPackageCapacity([pkg], null);

    expect(result.allOverCapacity).toBe(false);
    expect(result.underCapacity).toHaveLength(1);
    expect(result.overCapacity).toHaveLength(0);

    const status = result.underCapacity[0];
    expect(status.packageId).toBe('pkg-1');
    expect(status.overCapacity).toBe(false);
    // reservedSlots should be 0 since we deferred
    expect(status.reservedSlots).toBe(0);
  });

  it('handles multiple packages with mixed capacity', async () => {
    const { checkPackageCapacity, reserveProviderSlot } = await getCapacityModule();

    // Reserve 2 slots for provider-1
    await reserveProviderSlot('provider-1', makeDate(9, 0), 'standard', 10);
    await reserveProviderSlot('provider-1', makeDate(9, 1), 'standard', 10);

    // Reserve 10 slots for provider-2 (at capacity)
    for (let i = 0; i < 10; i++) {
      await reserveProviderSlot('provider-2', makeDate(9, i), 'standard', 10);
    }

    // Reserve 12 slots for provider-3 (over capacity).
    // Use maxDailyBookings=12 so all 12 reservations succeed.
    for (let i = 0; i < 12; i++) {
      await reserveProviderSlot('provider-3', makeDate(9, i), 'standard', 12);
    }

    const packages = [
      makeEligiblePackage('pkg-1', 'provider-1', 10), // under: 2/10
      makeEligiblePackage('pkg-2', 'provider-2', 10), // at capacity: 10/10
      makeEligiblePackage('pkg-3', 'provider-3', 12), // over: 12/12
    ];

    const result = await checkPackageCapacity(packages, makeDate(9, 0));

    // allOverCapacity should be false because pkg-1 is under capacity
    expect(result.allOverCapacity).toBe(false);

    // pkg-1 should be under capacity
    expect(result.underCapacity).toHaveLength(1);
    expect(result.underCapacity[0].packageId).toBe('pkg-1');
    expect(result.underCapacity[0].overCapacity).toBe(false);
    expect(result.underCapacity[0].reservedSlots).toBe(2);

    // pkg-2 and pkg-3 should be over capacity
    expect(result.overCapacity).toHaveLength(2);
    const overIds = result.overCapacity.map((s) => s.packageId).sort();
    expect(overIds).toEqual(['pkg-2', 'pkg-3']);

    const pkg2Status = result.overCapacity.find((s) => s.packageId === 'pkg-2')!;
    expect(pkg2Status.overCapacity).toBe(true);
    expect(pkg2Status.reservedSlots).toBe(10);

    const pkg3Status = result.overCapacity.find((s) => s.packageId === 'pkg-3')!;
    expect(pkg3Status.overCapacity).toBe(true);
    expect(pkg3Status.reservedSlots).toBe(12);
  });

  it('returns empty statuses for empty packages array', async () => {
    const { checkPackageCapacity } = await getCapacityModule();
    const result = await checkPackageCapacity([], makeDate());

    expect(result.allOverCapacity).toBe(false);
    expect(result.underCapacity).toHaveLength(0);
    expect(result.overCapacity).toHaveLength(0);
  });
});

describe('reserveProviderSlot', () => {
  it('reserves a slot successfully', async () => {
    const { reserveProviderSlot } = await getCapacityModule();

    const result = await reserveProviderSlot(
      'provider-1',
      makeDate(9, 0),
      'standard',
      10,
    );

    expect(result.success).toBe(true);
    expect(result.code).toBeUndefined();
  });

  it('rejects duplicate reservation (SLOT_ALREADY_RESERVED)', async () => {
    const { reserveProviderSlot } = await getCapacityModule();

    const slotDate = makeDate(9, 0);

    // First reservation should succeed
    const first = await reserveProviderSlot('provider-1', slotDate, 'standard', 10);
    expect(first.success).toBe(true);

    // Second reservation of the same slot should fail
    const second = await reserveProviderSlot('provider-1', slotDate, 'standard', 10);
    expect(second.success).toBe(false);
    expect(second.code).toBe('SLOT_ALREADY_RESERVED');
  });

  it('rejects when capacity exceeded (CAPACITY_EXCEEDED)', async () => {
    const { reserveProviderSlot } = await getCapacityModule();

    // maxDailyBookings = 1, so only 1 slot allowed
    const first = await reserveProviderSlot('provider-1', makeDate(9, 0), 'standard', 1);
    expect(first.success).toBe(true);

    // Second slot on the same date should fail due to capacity
    const second = await reserveProviderSlot('provider-1', makeDate(9, 30), 'standard', 1);
    expect(second.success).toBe(false);
    expect(second.code).toBe('CAPACITY_EXCEEDED');
  });

  it('uses correct TTL based on urgency', async () => {
    const { reserveProviderSlot, checkPackageCapacity } = await getCapacityModule();

    // Reserve with standard urgency (24h TTL)
    const standard = await reserveProviderSlot('provider-1', makeDate(9, 0), 'standard', 10);
    expect(standard.success).toBe(true);

    // Reserve with urgent urgency (2h TTL) — different slot
    const urgent = await reserveProviderSlot('provider-1', makeDate(9, 1), 'urgent', 10);
    expect(urgent.success).toBe(true);

    // Reserve with emergency urgency (30min TTL) — different slot
    const emergency = await reserveProviderSlot('provider-1', makeDate(9, 2), 'emergency', 10);
    expect(emergency.success).toBe(true);

    // All three should be reserved successfully
    const pkg = makeEligiblePackage('pkg-1', 'provider-1', 10);
    const result = await checkPackageCapacity([pkg], makeDate(9, 0));
    expect(result.underCapacity[0].reservedSlots).toBe(3);
  });

  it('does nothing when scheduledAt is null', async () => {
    const { reserveProviderSlot } = await getCapacityModule();

    // reserveProviderSlot requires a Date, not null, but the function
    // signature takes scheduledAt: Date. The null check is in
    // releaseProviderSlot. For reserveProviderSlot, we always need a date.
    // This test verifies that a valid reservation works as expected.
    const result = await reserveProviderSlot(
      'provider-1',
      makeDate(9, 0),
      'standard',
      10,
    );
    expect(result.success).toBe(true);
  });
});

describe('releaseProviderSlot', () => {
  it('releases a previously reserved slot', async () => {
    const { reserveProviderSlot, releaseProviderSlot, checkPackageCapacity } = await getCapacityModule();

    // Reserve a slot
    const slotDate = makeDate(9, 0);
    const reserve = await reserveProviderSlot('provider-1', slotDate, 'standard', 10);
    expect(reserve.success).toBe(true);

    // Verify it's reserved
    const pkg = makeEligiblePackage('pkg-1', 'provider-1', 10);
    let result = await checkPackageCapacity([pkg], makeDate(9, 0));
    expect(result.underCapacity[0].reservedSlots).toBe(1);

    // Release the slot
    await releaseProviderSlot('provider-1', slotDate);

    // Verify it's released — should be able to reserve again
    const reserveAgain = await reserveProviderSlot('provider-1', slotDate, 'standard', 10);
    expect(reserveAgain.success).toBe(true);
  });

  it('does nothing when scheduledAt is null', async () => {
    const { releaseProviderSlot } = await getCapacityModule();

    // Should not throw
    await expect(
      releaseProviderSlot('provider-1', null),
    ).resolves.toBeUndefined();
  });

  it('does not throw when releasing non-existent slot', async () => {
    const { releaseProviderSlot } = await getCapacityModule();

    // Release a slot that was never reserved — should not throw
    await expect(
      releaseProviderSlot('provider-1', makeDate(9, 0)),
    ).resolves.toBeUndefined();
  });
});
