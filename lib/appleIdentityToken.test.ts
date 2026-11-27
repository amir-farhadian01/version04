import { generateKeyPairSync } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  AppleIdentityTokenError,
  resetAppleJwksCacheForTests,
  verifyAppleIdentityToken,
} from './appleIdentityToken.js';

const audience = 'com.example.neighborly.test';
const issuer = 'https://appleid.apple.com';

function keyFixture(kid: string) {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = publicKey.export({ format: 'jwk' });
  return { privateKey, jwk: { ...jwk, kid, alg: 'RS256', use: 'sig' } };
}

function fetchKeys(keys: JsonWebKey[]) {
  return async () => ({ ok: true, json: async () => ({ keys }) });
}

function token(privateKey: ReturnType<typeof keyFixture>['privateKey'], kid: string, overrides: Record<string, unknown> = {}) {
  return jwt.sign(
    {
      sub: 'apple-user-1',
      email: 'apple-user@example.test',
      email_verified: true,
      ...overrides,
    },
    privateKey,
    { algorithm: 'RS256', keyid: kid, issuer, audience, expiresIn: '5m' },
  );
}

describe('verifyAppleIdentityToken', () => {
  beforeEach(() => resetAppleJwksCacheForTests());

  it('accepts a correctly signed Apple identity token', async () => {
    const apple = keyFixture('apple-key-1');
    const result = await verifyAppleIdentityToken(
      token(apple.privateKey, 'apple-key-1'),
      audience,
      fetchKeys([apple.jwk]),
    );
    expect(result.sub).toBe('apple-user-1');
  });

  it('rejects a forged signature', async () => {
    const apple = keyFixture('apple-key-1');
    const attacker = keyFixture('attacker-key');
    await expect(verifyAppleIdentityToken(
      token(attacker.privateKey, 'apple-key-1'),
      audience,
      fetchKeys([apple.jwk]),
    )).rejects.toMatchObject({ code: 'INVALID_TOKEN' });
  });

  it('rejects expired and wrong-audience tokens', async () => {
    const apple = keyFixture('apple-key-1');
    const fetcher = fetchKeys([apple.jwk]);
    const expired = jwt.sign(
      { sub: 'apple-user-1' },
      apple.privateKey,
      { algorithm: 'RS256', keyid: 'apple-key-1', issuer, audience, expiresIn: -1 },
    );
    await expect(verifyAppleIdentityToken(expired, audience, fetcher))
      .rejects.toBeInstanceOf(AppleIdentityTokenError);

    resetAppleJwksCacheForTests();
    await expect(verifyAppleIdentityToken(
      token(apple.privateKey, 'apple-key-1'),
      'com.example.wrong-audience',
      fetcher,
    )).rejects.toMatchObject({ code: 'INVALID_TOKEN' });
  });

  it('rejects an unknown signing-key id after refreshing JWKS', async () => {
    const apple = keyFixture('apple-key-1');
    await expect(verifyAppleIdentityToken(
      token(apple.privateKey, 'unknown-key'),
      audience,
      fetchKeys([apple.jwk]),
    )).rejects.toMatchObject({ code: 'UNKNOWN_KID' });
  });
});
