// ---------------------------------------------------------------------------
// JWT Token Blacklist
// Invalidates access tokens after logout by storing them in Redis (with
// in-memory fallback) until their natural expiry.
// ---------------------------------------------------------------------------
import { createHash } from 'crypto';
import { getRedis } from './redis.js';

const PREFIX = 'token_blacklist:';

/**
 * Derive a deterministic key from a JWT string.
 * Uses the last 40 characters of a SHA-256 hash to keep keys short.
 */
function tokenKey(token: string): string {
  return PREFIX + createHash('sha256').update(token).digest('hex').slice(-40);
}

/**
 * Add a token to the blacklist.
 * @param token  The raw JWT access token.
 * @param ttlSeconds  How long the token should remain blacklisted (seconds).
 */
export async function blacklistToken(token: string, ttlSeconds: number): Promise<void> {
  const key = tokenKey(token);
  const r = getRedis();

  try {
    if ('set' in r && typeof r.set === 'function') {
      await r.set(key, '1', 'EX', ttlSeconds);
      return;
    }
  } catch {
    console.warn('[tokenBlacklist] Failed to blacklist token');
  }
}

/**
 * Check whether a token has been blacklisted.
 */
export async function isTokenBlacklisted(token: string): Promise<boolean> {
  const key = tokenKey(token);
  const r = getRedis();

  try {
    if ('get' in r && typeof r.get === 'function') {
      const val = await r.get(key);
      return val === '1';
    }
  } catch {
    // ignore
  }

  return false;
}

/**
 * Remove a token from the blacklist (e.g. if a session is restored).
 */
export async function removeFromBlacklist(token: string): Promise<void> {
  const key = tokenKey(token);
  const r = getRedis();

  try {
    if ('del' in r && typeof r.del === 'function') {
      await r.del(key);
    }
  } catch {
    // ignore
  }
}