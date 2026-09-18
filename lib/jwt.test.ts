import { afterEach, describe, expect, it } from 'vitest';
import {
  generateTokenPair,
  validateJwtSecrets,
  verifyAccessToken,
  verifyRefreshToken,
} from './jwt.js';

const originalAccess = process.env.JWT_SECRET;
const originalRefresh = process.env.JWT_REFRESH_SECRET;

afterEach(() => {
  if (originalAccess === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = originalAccess;
  if (originalRefresh === undefined) delete process.env.JWT_REFRESH_SECRET;
  else process.env.JWT_REFRESH_SECRET = originalRefresh;
});

describe('JWT secret validation', () => {
  it('fails safely when the refresh secret is missing or a placeholder', () => {
    process.env.JWT_SECRET = 'test-access-secret-that-is-not-used-outside-tests';
    delete process.env.JWT_REFRESH_SECRET;
    expect(() => validateJwtSecrets()).toThrow('JWT_REFRESH_SECRET');

    process.env.JWT_REFRESH_SECRET = 'dev-refresh-secret-change-in-prod';
    expect(() => validateJwtSecrets()).toThrow('JWT_REFRESH_SECRET');
  });

  it('rejects equal access and refresh secrets', () => {
    process.env.JWT_SECRET = 'same-test-secret';
    process.env.JWT_REFRESH_SECRET = 'same-test-secret';
    expect(() => validateJwtSecrets()).toThrow('must be different');
  });

  it('signs and verifies with separate explicit secrets', () => {
    process.env.JWT_SECRET = 'test-access-secret-that-is-not-used-outside-tests';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-that-is-not-used-outside-tests';
    const payload = { userId: 'user-1', email: 'user@example.test', role: 'customer' };
    const tokens = generateTokenPair(payload);
    expect(verifyAccessToken(tokens.accessToken).userId).toBe('user-1');
    expect(verifyRefreshToken(tokens.refreshToken).userId).toBe('user-1');
  });
});
