import { describe, expect, it } from 'vitest';
import {
  addressSnapshotSchema,
  compensationTermsSchema,
  createDriverSchema,
  offerAssignmentSchema,
} from './validation.js';

describe('delivery validation', () => {
  it('accepts each bounded compensation component once', () => {
    const result = compensationTermsSchema.parse({
      currency: 'CAD',
      schemaVersion: 1,
      components: [
        { type: 'hourly', amountCents: 2500 },
        { type: 'per_delivery', amountCents: 900 },
        { type: 'commission', rateBasisPoints: 1250, basisDescription: 'Order subtotal before tax' },
        { type: 'fixed_salary', amountCents: 50_000, frequency: 'weekly' },
      ],
    });
    expect(result.components).toHaveLength(4);
  });

  it.each([
    [{ currency: 'cad', components: [{ type: 'hourly', amountCents: 100 }] }],
    [{ currency: 'CAD', components: [{ type: 'hourly', amountCents: 0 }] }],
    [{ currency: 'CAD', components: [{ type: 'commission', rateBasisPoints: 10_001, basisDescription: 'subtotal' }] }],
    [{ currency: 'CAD', components: [{ type: 'commission', rateBasisPoints: 100 }] }],
    [{ currency: 'CAD', components: [{ type: 'hourly', amountCents: 100 }, { type: 'hourly', amountCents: 200 }] }],
  ])('rejects invalid compensation terms %#', (value) => {
    expect(compensationTermsSchema.safeParse(value).success).toBe(false);
  });

  it.each(['hourly', 'long_term'] as const)('keeps %s engagement independent', (engagementType) => {
    expect(createDriverSchema.parse({ userId: 'user-1', engagementType }).engagementType).toBe(engagementType);
  });

  it('requires a complete valid planned interval', () => {
    expect(offerAssignmentSchema.safeParse({
      businessDriverId: 'driver-1', expectedVersion: 1, plannedStartAt: '2026-09-11T12:00:00.000Z',
    }).success).toBe(false);
    expect(offerAssignmentSchema.safeParse({
      businessDriverId: 'driver-1', expectedVersion: 1,
      plannedStartAt: '2026-09-11T13:00:00.000Z', plannedEndAt: '2026-09-11T12:00:00.000Z',
    }).success).toBe(false);
  });

  it('permits static addresses but rejects contact fields or embedded contact data', () => {
    const address = {
      line1: '12 King Street West', city: 'Toronto', province: 'ON', postalCode: 'M5H 1A1', country: 'ca',
    };
    expect(addressSnapshotSchema.parse(address).country).toBe('CA');
    expect(addressSnapshotSchema.safeParse({ ...address, phone: '4165551234' }).success).toBe(false);
    expect(addressSnapshotSchema.safeParse({ ...address, line2: 'person@example.com' }).success).toBe(false);
  });
});
