import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({ $queryRaw: vi.fn(), $executeRaw: vi.fn() }));
vi.mock('./db.js', () => ({ default: db }));

import {
  confirmEmailVerification,
  confirmPhoneVerification,
  startEmailVerification,
  startPhoneVerification,
} from './kycVerification.js';

function setProviderEnvironment(): void {
  process.env.POSTMARK_SERVER_TOKEN = 'postmark-test';
  process.env.POSTMARK_FROM_EMAIL = 'verify@example.test';
  process.env.APP_URL = 'https://staging.example.test';
  process.env.TWILIO_ACCOUNT_SID = 'AC_test';
  process.env.TWILIO_AUTH_TOKEN = 'twilio-test';
  process.env.TWILIO_VERIFY_SERVICE_SID = 'VA_test';
}

describe('KYC verification challenges', () => {
  beforeEach(() => {
    vi.restoreAllMocks(); db.$queryRaw.mockReset(); db.$executeRaw.mockReset(); setProviderEnvironment();
    db.$queryRaw.mockResolvedValue([{ count: 0n }]); db.$executeRaw.mockResolvedValue(1);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('sends an opaque email token and never returns or stores it in plaintext', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ MessageID: 'm-1' }) });
    vi.stubGlobal('fetch', fetchMock);
    await startEmailVerification('u-1', 'person@example.test', new Date('2026-01-01T00:00:00Z'));
    const request = JSON.parse(String(fetchMock.mock.calls[0][1].body)) as { TextBody: string };
    const token = new URL(request.TextBody.replace('Verify your email: ', '')).searchParams.get('token');
    expect(token).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(JSON.stringify(db.$executeRaw.mock.calls)).not.toContain(token);
  });

  it('rejects expired/missing and over-attempted email challenges', async () => {
    db.$queryRaw.mockResolvedValueOnce([]);
    await expect(confirmEmailVerification('u-1', 'token')).resolves.toBe(false);
    db.$queryRaw.mockResolvedValueOnce([{ id: 'c-1', tokenHash: 'x', attempts: 5 }]);
    await expect(confirmEmailVerification('u-1', 'token')).resolves.toBe(false);
  });

  it('rate limits repeated starts before contacting a provider', async () => {
    db.$queryRaw.mockResolvedValueOnce([{ count: 5n }]);
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    await expect(startEmailVerification('u-1', 'person@example.test')).rejects.toMatchObject({ status: 429 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uses Twilio Verify and consumes only an approved OTP', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ sid: 'VE_test' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'approved' }) });
    vi.stubGlobal('fetch', fetchMock);
    await startPhoneVerification('u-1', '+14165550123');
    db.$queryRaw.mockResolvedValueOnce([{ id: 'c-1', tokenHash: null, attempts: 0 }]);
    await expect(confirmPhoneVerification('u-1', '+14165550123', '654321')).resolves.toBe(true);
    expect(String(fetchMock.mock.calls[1][0])).toContain('/VerificationCheck');
    expect(String(fetchMock.mock.calls[1][1].body)).toContain('Code=654321');
  });

  it('fails closed when provider credentials are missing', async () => {
    delete process.env.POSTMARK_SERVER_TOKEN;
    await expect(startEmailVerification('u-1', 'person@example.test')).rejects.toMatchObject({ status: 503 });
  });
});
