import { describe, it, expect } from 'vitest';
import { BookingMode } from '@prisma/client';
import { resolveEffectiveBookingMode } from '../lib/matching/eligibility.js';
import { assertBookingModeAllowedForCatalog } from '../lib/workspaceAccess.js';

describe('BookingMode enum', () => {
  it('includes all 6 required values', () => {
    const values = Object.values(BookingMode);
    expect(values).toContain('booking');
    expect(values).toContain('direct_booking');
    expect(values).toContain('hybrid');
    expect(values).toContain('quote_first');
    expect(values).toContain('walk_in');
    expect(values).toContain('inherit_from_catalog');
    expect(values.length).toBe(6);
  });

  it('includes the legacy-compatible inherit_from_catalog value', () => {
    expect(BookingMode.inherit_from_catalog).toBe('inherit_from_catalog');
  });
});

describe('resolveEffectiveBookingMode', () => {
  it('returns booking when package has booking mode and no catalog lock', () => {
    const result = resolveEffectiveBookingMode(
      { lockedBookingMode: null },
      { bookingMode: BookingMode.booking },
    );
    expect(result).toBe('booking');
  });

  it('returns direct_booking when package has direct_booking mode and no catalog lock', () => {
    const result = resolveEffectiveBookingMode(
      { lockedBookingMode: null },
      { bookingMode: BookingMode.direct_booking },
    );
    expect(result).toBe('direct_booking');
  });

  it('returns hybrid when package has hybrid mode and no catalog lock', () => {
    const result = resolveEffectiveBookingMode(
      { lockedBookingMode: null },
      { bookingMode: BookingMode.hybrid },
    );
    expect(result).toBe('hybrid');
  });

  it('returns quote_first when package has quote_first mode and no catalog lock', () => {
    const result = resolveEffectiveBookingMode(
      { lockedBookingMode: null },
      { bookingMode: BookingMode.quote_first },
    );
    expect(result).toBe('quote_first');
  });

  it('returns walk_in when package has walk_in mode and no catalog lock', () => {
    const result = resolveEffectiveBookingMode(
      { lockedBookingMode: null },
      { bookingMode: BookingMode.walk_in },
    );
    expect(result).toBe('walk_in');
  });

  it('returns catalog lock when lockedBookingMode is set', () => {
    const result = resolveEffectiveBookingMode(
      { lockedBookingMode: 'direct_booking' },
      { bookingMode: BookingMode.hybrid },
    );
    expect(result).toBe('direct_booking');
  });

  it('returns inherit_from_catalog when package has inherit_from_catalog', () => {
    const result = resolveEffectiveBookingMode(
      { lockedBookingMode: 'hybrid' },
      { bookingMode: BookingMode.inherit_from_catalog },
    );
    expect(result).toBe('hybrid');
  });

  it('defaults to booking when no lock and package mode is inherit_from_catalog', () => {
    const result = resolveEffectiveBookingMode(
      { lockedBookingMode: null },
      { bookingMode: BookingMode.inherit_from_catalog },
    );
    expect(result).toBe('booking');
  });
});

describe('assertBookingModeAllowedForCatalog', () => {
  it('allows inherit_from_catalog regardless of lock', () => {
    expect(() =>
      assertBookingModeAllowedForCatalog('booking', BookingMode.inherit_from_catalog),
    ).not.toThrow();
  });

  it('allows matching booking mode', () => {
    expect(() =>
      assertBookingModeAllowedForCatalog('booking', BookingMode.booking),
    ).not.toThrow();
  });

  it('allows matching direct_booking mode', () => {
    expect(() =>
      assertBookingModeAllowedForCatalog('direct_booking', BookingMode.direct_booking),
    ).not.toThrow();
  });

  it('allows matching hybrid mode', () => {
    expect(() =>
      assertBookingModeAllowedForCatalog('hybrid', BookingMode.hybrid),
    ).not.toThrow();
  });

  it('allows matching quote_first mode', () => {
    expect(() =>
      assertBookingModeAllowedForCatalog('quote_first', BookingMode.quote_first),
    ).not.toThrow();
  });

  it('allows matching walk_in mode', () => {
    expect(() =>
      assertBookingModeAllowedForCatalog('walk_in', BookingMode.walk_in),
    ).not.toThrow();
  });

  it('throws when booking mode conflicts with catalog lock', () => {
    expect(() =>
      assertBookingModeAllowedForCatalog('booking', BookingMode.direct_booking),
    ).toThrow('bookingMode conflicts with service catalog lockedBookingMode');
  });

  it('passes when lockedBookingMode is null or empty', () => {
    expect(() =>
      assertBookingModeAllowedForCatalog(null, BookingMode.direct_booking),
    ).not.toThrow();
    expect(() =>
      assertBookingModeAllowedForCatalog('', BookingMode.direct_booking),
    ).not.toThrow();
  });

  it('passes when lockedBookingMode is not a recognized mode', () => {
    expect(() =>
      assertBookingModeAllowedForCatalog('unknown_mode', BookingMode.direct_booking),
    ).not.toThrow();
  });
});
