import { describe, expect, it } from 'vitest';
import { serializeAddresses } from './privacy.js';

const pickup = {
  line1: '1 Front Street', city: 'Toronto', province: 'ON', postalCode: 'M5J 1E6', country: 'CA',
};
const dropoff = {
  line1: '100 Queen Street', line2: 'Unit 2', city: 'Toronto', province: 'ON', postalCode: 'M5H 2N2', country: 'CA',
};

describe('delivery address privacy', () => {
  it.each(['offered', 'rejected'] as const)('redacts precise addresses while assignment is %s', (status) => {
    const result = serializeAddresses(pickup, dropoff, status, false);
    expect(result.addressPrecision).toBe('city_province');
    expect(result.pickupAddress).toEqual({ city: 'Toronto', province: 'ON' });
    expect(result.dropoffAddress).not.toHaveProperty('line1');
  });

  it('reveals precise addresses only after acceptance', () => {
    const result = serializeAddresses(pickup, dropoff, 'accepted', false);
    expect(result.addressPrecision).toBe('precise');
    expect(result.dropoffAddress).toHaveProperty('line1', '100 Queen Street');
    expect(result.dropoffAddress).not.toHaveProperty('phone');
    expect(result.dropoffAddress).not.toHaveProperty('email');
  });

  it('does not reveal an offered assignment that a manager cancelled', () => {
    expect(serializeAddresses(pickup, dropoff, 'cancelled', false, false).addressPrecision).toBe('city_province');
    expect(serializeAddresses(pickup, dropoff, 'cancelled', false, true).addressPrecision).toBe('precise');
  });
});
