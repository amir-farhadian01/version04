import { describe, expect, it } from 'vitest';
import { normalizeCanadianPostalCode, validateCanadaBusinessAnswers, validateCanadianAddress } from './kycCanada.js';

describe('Canada KYC validation', () => {
  it('normalizes a valid Canadian postal code', () => {
    expect(normalizeCanadianPostalCode('m5v2t6')).toBe('M5V 2T6');
    expect(normalizeCanadianPostalCode('D1A 1A1')).toBeNull();
  });

  it('requires a structured Canadian address', () => {
    expect(validateCanadianAddress({ line1: '1 King St', city: 'Toronto', province: 'ON', postalCode: 'M5V 2T6', country: 'CA' })).toBeNull();
    expect(validateCanadianAddress('1 King St')).toBe('address must be structured');
  });

  it('enforces BN and insured evidence', () => {
    const errors = validateCanadaBusinessAnswers({
      businessNumber: '123', jurisdiction: 'ON', entityType: 'corporation', registrationNumber: 'ON 12345',
      insuranceStatus: 'insured', insurancePolicyNumber: 'P-1', insurerName: 'Insurer', insuranceExpiry: '2099-01-01',
    }, []);
    expect(errors.businessNumber).toBeTruthy();
    expect(errors.insuranceCertificate).toBeTruthy();
  });

  it('accepts an explicit uninsured branch without fake policy data', () => {
    expect(validateCanadaBusinessAnswers({
      businessNumber: '123456789', jurisdiction: 'FEDERAL', entityType: 'corporation', registrationNumber: 'ABC 123',
      insuranceStatus: 'uninsured',
    }, [])).toEqual({});
  });
});
