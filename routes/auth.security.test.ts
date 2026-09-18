import express, { type NextFunction, type Request, type Response } from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  userFindFirst: vi.fn(),
  userCreate: vi.fn(),
  userUpdate: vi.fn(),
  usernameFindUnique: vi.fn(),
  usernameCreate: vi.fn(),
  credentialFindMany: vi.fn(),
  credentialFindUnique: vi.fn(),
  credentialCreate: vi.fn(),
  credentialUpdate: vi.fn(),
  generateRegistrationOptions: vi.fn(),
  verifyRegistrationResponse: vi.fn(),
  generateAuthenticationOptions: vi.fn(),
  verifyAuthenticationResponse: vi.fn(),
  createPasswordResetToken: vi.fn(),
}));

vi.mock('bcrypt', () => ({ default: { hash: vi.fn().mockResolvedValue('password-hash'), compare: vi.fn() } }));
vi.mock('google-auth-library', () => ({ OAuth2Client: class { verifyIdToken = vi.fn(); } }));
vi.mock('@simplewebauthn/server', () => ({
  generateRegistrationOptions: mocks.generateRegistrationOptions,
  verifyRegistrationResponse: mocks.verifyRegistrationResponse,
  generateAuthenticationOptions: mocks.generateAuthenticationOptions,
  verifyAuthenticationResponse: mocks.verifyAuthenticationResponse,
}));
vi.mock('../lib/db.js', () => ({ default: {
  user: {
    findUnique: mocks.userFindUnique,
    findFirst: mocks.userFindFirst,
    create: mocks.userCreate,
    update: mocks.userUpdate,
  },
  usernameHistory: { findUnique: mocks.usernameFindUnique, create: mocks.usernameCreate },
  webAuthnCredential: {
    findMany: mocks.credentialFindMany,
    findUnique: mocks.credentialFindUnique,
    create: mocks.credentialCreate,
    update: mocks.credentialUpdate,
  },
} }));
vi.mock('../lib/jwt.js', () => ({
  generateTokenPair: () => ({ accessToken: 'test-access-token', refreshToken: 'test-refresh-token' }),
  verifyRefreshToken: vi.fn(),
  signAccessToken: vi.fn(),
  verifyAccessToken: () => ({ userId: 'session-user', email: 'session@example.test', role: 'customer' }),
}));
vi.mock('../lib/bus.js', () => ({ publish: vi.fn() }));
vi.mock('../lib/rateLimiter.js', () => ({ authLimiter: (_req: Request, _res: Response, next: NextFunction) => next() }));
vi.mock('../lib/tokenBlacklist.js', () => ({ blacklistToken: vi.fn(), isTokenBlacklisted: vi.fn().mockResolvedValue(false) }));
vi.mock('../lib/passwordReset.js', () => ({
  createPasswordResetToken: mocks.createPasswordResetToken,
  consumePasswordResetToken: vi.fn(),
}));
vi.mock('../lib/username.js', () => ({
  normalizeUsername: (value: string) => value,
  isValidUsername: () => true,
  generateUsername: () => 'new-user',
  suggestUsername: (value: string) => `${value}-2`,
}));
vi.mock('../lib/appleIdentityToken.js', () => ({ verifyAppleIdentityToken: vi.fn() }));

import authRouter from './auth.js';

function app() {
  const instance = express();
  instance.use(express.json());
  instance.use(cookieParser());
  instance.use((req, _res, next) => {
    (req as Request & { rpID?: string }).rpID = 'example.test';
    (req as Request & { origin?: string }).origin = 'https://example.test';
    next();
  });
  instance.use('/api/auth', authRouter);
  return instance;
}

describe('authentication security boundaries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.userFindUnique.mockResolvedValue(null);
    mocks.userFindFirst.mockResolvedValue(null);
    mocks.usernameFindUnique.mockResolvedValue(null);
    mocks.usernameCreate.mockResolvedValue({});
    mocks.userUpdate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'user-1', ...data }));
    mocks.userCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'user-1', companyId: null, avatarUrl: null, username: 'new-user', status: 'active', ...data,
    }));
    mocks.credentialFindMany.mockResolvedValue([]);
    mocks.createPasswordResetToken.mockResolvedValue('sensitive-reset-token');
  });

  it('never assigns a client-supplied privileged role during public registration', async () => {
    const response = await request(app()).post('/api/auth/register').send({
      email: 'new-user@example.test', password: 'password-123', displayName: 'New User', role: 'platform_admin',
    });
    expect(response.status).toBe(201);
    expect(mocks.userCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ role: 'customer', isVerified: false }),
    }));
    expect(response.body.user.role).toBe('customer');
  });

  it('requires authentication before issuing WebAuthn registration options', async () => {
    const response = await request(app()).post('/api/auth/register-options').send({
      userId: 'victim-user', email: 'victim@example.test',
    });
    expect(response.status).toBe(401);
    expect(mocks.generateRegistrationOptions).not.toHaveBeenCalled();
  });

  it('binds WebAuthn registration to the session user and consumes its challenge once', async () => {
    mocks.userFindUnique.mockResolvedValue({ id: 'session-user', email: 'session@example.test', role: 'customer' });
    mocks.generateRegistrationOptions.mockResolvedValue({ challenge: 'registration-challenge' });
    mocks.verifyRegistrationResponse.mockResolvedValue({
      verified: true,
      registrationInfo: { credential: { id: 'credential-id', publicKey: new Uint8Array([1, 2]), counter: 0 } },
    });
    mocks.credentialCreate.mockResolvedValue({});

    const options = await request(app()).post('/api/auth/register-options')
      .set('authorization', 'Bearer session-token').send({ userId: 'victim-user', email: 'victim@example.test' });
    expect(options.status).toBe(200);
    const cookie = options.headers['set-cookie'][0].split(';')[0];

    const first = await request(app()).post('/api/auth/verify-registration')
      .set('authorization', 'Bearer session-token').set('cookie', cookie)
      .send({ userId: 'victim-user', body: { response: { transports: [] } } });
    expect(first.status).toBe(200);
    expect(mocks.credentialCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ userId: 'session-user' }),
    }));

    const replay = await request(app()).post('/api/auth/verify-registration')
      .set('authorization', 'Bearer session-token').set('cookie', cookie)
      .send({ userId: 'victim-user', body: { response: { transports: [] } } });
    expect(replay.status).toBe(400);
    expect(replay.body.code).toBe('INVALID_CHALLENGE');
    expect(mocks.verifyRegistrationResponse).toHaveBeenCalledTimes(1);
  });

  it('rejects a WebAuthn credential owned by a different user than the challenge', async () => {
    mocks.userFindUnique.mockResolvedValue({ id: 'victim-user', email: 'victim@example.test', role: 'customer' });
    mocks.credentialFindMany.mockResolvedValue([{ credentialID: 'victim-credential', transports: null }]);
    mocks.generateAuthenticationOptions.mockResolvedValue({ challenge: 'authentication-challenge' });
    mocks.credentialFindUnique.mockResolvedValue({
      id: 'credential-row', userId: 'attacker-user', credentialID: 'attacker-credential',
      credentialPublicKey: Buffer.from([1]).toString('base64'), counter: BigInt(0),
    });

    const options = await request(app()).post('/api/auth/login-options').send({ email: 'victim@example.test' });
    const cookie = options.headers['set-cookie'][0].split(';')[0];
    const response = await request(app()).post('/api/auth/verify-login')
      .set('cookie', cookie).send({ body: { id: 'attacker-credential' } });
    expect(response.status).toBe(401);
    expect(response.body.code).toBe('CREDENTIAL_OWNER_MISMATCH');
    expect(mocks.verifyAuthenticationResponse).not.toHaveBeenCalled();
  });

  it('does not log reset tokens, reset URLs, or the account email', async () => {
    mocks.userFindUnique.mockResolvedValue({ id: 'user-1', email: 'private-user@example.test', password: 'hash' });
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    try {
      const response = await request(app()).post('/api/auth/forgot-password')
        .send({ email: 'private-user@example.test' });
      expect(response.status).toBe(200);
      const output = log.mock.calls.flat().join(' ');
      expect(output).not.toContain('sensitive-reset-token');
      expect(output).not.toContain('private-user@example.test');
      expect(output).not.toContain('reset-password');
    } finally {
      log.mockRestore();
    }
  });
});
