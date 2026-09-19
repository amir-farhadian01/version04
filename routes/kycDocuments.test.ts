import { describe, expect, it } from 'vitest';
import { signKycDocumentAccess, verifyKycDocumentAccess } from './kycDocuments.js';

describe('private KYC document access', () => {
  const secret = 'a-secure-test-secret-that-is-at-least-32-characters';
  it('accepts only the matching unexpired document signature', () => {
    const expires = 2_000;
    const token = signKycDocumentAccess('doc-1', expires, secret);
    expect(verifyKycDocumentAccess('doc-1', expires, token, 1_999, secret)).toBe(true);
    expect(verifyKycDocumentAccess('doc-2', expires, token, 1_999, secret)).toBe(false);
    expect(verifyKycDocumentAccess('doc-1', expires, `${token}x`, 1_999, secret)).toBe(false);
  });

  it('rejects an expired URL', () => {
    const token = signKycDocumentAccess('doc-1', 2_000, secret);
    expect(verifyKycDocumentAccess('doc-1', 2_000, token, 2_001, secret)).toBe(false);
  });
});
