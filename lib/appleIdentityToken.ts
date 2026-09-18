import { createPublicKey, type KeyObject } from 'node:crypto';
import jwt, { type JwtPayload as JsonWebTokenPayload } from 'jsonwebtoken';

const APPLE_ISSUER = 'https://appleid.apple.com';
const APPLE_JWKS_URL = 'https://appleid.apple.com/auth/keys';
const JWKS_CACHE_TTL_MS = 60 * 60 * 1000;

interface AppleJwk extends JsonWebKey {
  kid?: string;
  alg?: string;
  kty?: string;
  use?: string;
}

interface AppleJwksResponse {
  keys: AppleJwk[];
}

export interface AppleIdentityClaims extends JsonWebTokenPayload {
  sub: string;
  email?: string;
  email_verified?: string | boolean;
  is_private_email?: string | boolean;
}

type JwksFetcher = (url: string) => Promise<{
  ok: boolean;
  json(): Promise<unknown>;
}>;

let cachedKeys: Map<string, KeyObject> | null = null;
let cachedUntil = 0;

export class AppleIdentityTokenError extends Error {
  constructor(
    public readonly code: 'INVALID_TOKEN' | 'UNKNOWN_KID' | 'JWKS_UNAVAILABLE',
    message: string,
  ) {
    super(message);
    this.name = 'AppleIdentityTokenError';
  }
}

function isJwksResponse(value: unknown): value is AppleJwksResponse {
  if (!value || typeof value !== 'object' || !Array.isArray((value as { keys?: unknown }).keys)) return false;
  return (value as { keys: unknown[] }).keys.every((key) => key != null && typeof key === 'object');
}

async function loadAppleKeys(fetcher: JwksFetcher, forceRefresh: boolean): Promise<Map<string, KeyObject>> {
  if (!forceRefresh && cachedKeys && Date.now() < cachedUntil) return cachedKeys;

  let response: Awaited<ReturnType<JwksFetcher>>;
  try {
    response = await fetcher(APPLE_JWKS_URL);
  } catch {
    throw new AppleIdentityTokenError('JWKS_UNAVAILABLE', 'Apple signing keys are unavailable');
  }
  if (!response.ok) {
    throw new AppleIdentityTokenError('JWKS_UNAVAILABLE', 'Apple signing keys are unavailable');
  }

  const body = await response.json();
  if (!isJwksResponse(body)) {
    throw new AppleIdentityTokenError('JWKS_UNAVAILABLE', 'Apple signing key response is invalid');
  }

  const keys = new Map<string, KeyObject>();
  for (const jwk of body.keys) {
    if (!jwk.kid || jwk.kty !== 'RSA' || (jwk.alg && jwk.alg !== 'RS256') || (jwk.use && jwk.use !== 'sig')) continue;
    try {
      keys.set(jwk.kid, createPublicKey({ key: jwk as unknown as import('crypto').JsonWebKey, format: 'jwk' }));
    } catch {
      // Ignore malformed keys; a usable matching key is required below.
    }
  }

  cachedKeys = keys;
  cachedUntil = Date.now() + JWKS_CACHE_TTL_MS;
  return keys;
}

export async function verifyAppleIdentityToken(
  identityToken: string,
  audience: string,
  fetcher: JwksFetcher = globalThis.fetch as JwksFetcher,
): Promise<AppleIdentityClaims> {
  const decoded = jwt.decode(identityToken, { complete: true });
  if (!decoded || typeof decoded === 'string' || decoded.header.alg !== 'RS256' || !decoded.header.kid) {
    throw new AppleIdentityTokenError('INVALID_TOKEN', 'Apple identity token header is invalid');
  }

  let keys = await loadAppleKeys(fetcher, false);
  let key = keys.get(decoded.header.kid);
  if (!key) {
    keys = await loadAppleKeys(fetcher, true);
    key = keys.get(decoded.header.kid);
  }
  if (!key) {
    throw new AppleIdentityTokenError('UNKNOWN_KID', 'Apple signing key is unknown');
  }

  try {
    const payload = jwt.verify(identityToken, key, {
      algorithms: ['RS256'],
      issuer: APPLE_ISSUER,
      audience,
    });
    if (typeof payload === 'string' || typeof payload.sub !== 'string' || payload.sub.length === 0) {
      throw new AppleIdentityTokenError('INVALID_TOKEN', 'Apple identity token subject is invalid');
    }
    return payload as AppleIdentityClaims;
  } catch (error) {
    if (error instanceof AppleIdentityTokenError) throw error;
    throw new AppleIdentityTokenError('INVALID_TOKEN', 'Apple identity token verification failed');
  }
}

export function resetAppleJwksCacheForTests(): void {
  cachedKeys = null;
  cachedUntil = 0;
}
