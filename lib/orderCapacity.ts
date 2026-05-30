/**
 * lib/orderCapacity.ts — Capacity validation for order submission (G1/G15)
 *
 * Provides functions to check provider slot capacity before matching,
 * and to release reserved slots on cancellation.
 *
 * Uses Redis slot locking via lib/redis.ts (with in-memory fallback).
 */

import { getReservedSlots, reserveSlotAtomic, releaseSlot } from './redis.js';

/**
 * Urgency-to-TTL mapping for slot reservation expiry.
 * Matches the matching window durations in routes/orders.ts.
 */
const URGENCY_TTL_SECS: Record<string, number> = {
  standard: 24 * 60 * 60,   // 24 hours
  urgent: 2 * 60 * 60,      // 2 hours
  emergency: 30 * 60,       // 30 minutes
};

/**
 * Result of a capacity check for a single eligible package.
 */
export interface PackageCapacityResult {
  packageId: string;
  providerId: string;
  overCapacity: boolean;
  reservedSlots: number;
  maxDailyBookings: number;
}

/**
 * Result of the full capacity check across all eligible packages.
 */
export interface CapacityCheckResult {
  /** Packages that are under capacity (available for matching). */
  underCapacity: PackageCapacityResult[];
  /** Packages that are over capacity. */
  overCapacity: PackageCapacityResult[];
  /** Whether ALL eligible packages are over capacity. */
  allOverCapacity: boolean;
}

/**
 * Format a Date to YYYY-MM-DD string for slot key construction.
 */
function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Build a slot key from provider ID and scheduled time.
 * Format: {providerId}:{HH}:{MM}
 *
 * When no specific time is available, uses "00:00" as a fallback.
 */
function buildSlotKey(providerId: string, scheduledAt: Date): string {
  const hh = String(scheduledAt.getHours()).padStart(2, '0');
  const mm = String(scheduledAt.getMinutes()).padStart(2, '0');
  return `${providerId}:${hh}:${mm}`;
}

/**
 * Check capacity for a list of eligible packages against a scheduled date.
 *
 * For each package, queries Redis for existing reserved slots and compares
 * against the package's maxDailyBookings.
 *
 * @param eligiblePackages - Array of eligible packages (must include providerId, maxDailyBookings)
 * @param scheduledAt - The scheduled date for the order (may be null for flexible scheduling)
 * @returns Capacity check result with per-package status
 */
export async function checkPackageCapacity(
  eligiblePackages: Array<{
    package: {
      id: string;
      providerId: string;
      maxDailyBookings: number;
      slotDurationMinutes: number;
    };
  }>,
  scheduledAt: Date | null,
): Promise<CapacityCheckResult> {
  const underCapacity: PackageCapacityResult[] = [];
  const overCapacity: PackageCapacityResult[] = [];

  if (!scheduledAt) {
    // Flexible scheduling — capacity validation deferred
    // Return all packages as under capacity (deferred check)
    for (const ep of eligiblePackages) {
      underCapacity.push({
        packageId: ep.package.id,
        providerId: ep.package.providerId,
        overCapacity: false,
        reservedSlots: 0,
        maxDailyBookings: ep.package.maxDailyBookings,
      });
    }
    return { underCapacity, overCapacity, allOverCapacity: false };
  }

  const dateStr = formatDate(scheduledAt);

  for (const ep of eligiblePackages) {
    const pkg = ep.package;
    const reservedSlots = await getReservedSlots(pkg.providerId, dateStr);
    const count = reservedSlots.length;
    const isOver = count >= pkg.maxDailyBookings;

    const result: PackageCapacityResult = {
      packageId: pkg.id,
      providerId: pkg.providerId,
      overCapacity: isOver,
      reservedSlots: count,
      maxDailyBookings: pkg.maxDailyBookings,
    };

    if (isOver) {
      overCapacity.push(result);
    } else {
      underCapacity.push(result);
    }
  }

  return {
    underCapacity,
    overCapacity,
    allOverCapacity: eligiblePackages.length > 0 && overCapacity.length === eligiblePackages.length,
  };
}

/**
 * Atomically reserve a slot for a matched provider.
 *
 * @param providerId - The provider's user ID
 * @param scheduledAt - The scheduled date/time
 * @param urgency - The order urgency string (standard, urgent, emergency)
 * @param maxDailyBookings - The package's max daily bookings limit
 * @returns The reservation result
 */
export async function reserveProviderSlot(
  providerId: string,
  scheduledAt: Date,
  urgency: string,
  maxDailyBookings: number,
): Promise<{ success: boolean; code?: string }> {
  const dateStr = formatDate(scheduledAt);
  const slotKey = buildSlotKey(providerId, scheduledAt);
  const ttlSecs = URGENCY_TTL_SECS[urgency] ?? URGENCY_TTL_SECS.standard;

  return reserveSlotAtomic(providerId, dateStr, slotKey, ttlSecs, maxDailyBookings);
}

/**
 * Release a reserved slot for a provider on a given date.
 *
 * @param providerId - The provider's user ID
 * @param scheduledAt - The scheduled date/time (may be null)
 * @param slotKey - Optional explicit slot key; if not provided, it's derived from scheduledAt
 */
export async function releaseProviderSlot(
  providerId: string,
  scheduledAt: Date | null,
  slotKey?: string,
): Promise<void> {
  if (!scheduledAt) {
    // Flexible scheduling — no specific slot to release
    return;
  }

  const dateStr = formatDate(scheduledAt);
  const sk = slotKey ?? buildSlotKey(providerId, scheduledAt);

  await releaseSlot(providerId, dateStr, sk);
}
