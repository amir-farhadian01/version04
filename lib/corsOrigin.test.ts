// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createCorsOriginHandler,
  isProductionEnvironment,
  isLocalhostOrigin,
  resolveCorsOriginConfig,
} from './corsOrigin.js';

const originalAllowedOrigin = process.env.ALLOWED_ORIGIN;

afterEach(() => {
  if (originalAllowedOrigin === undefined) delete process.env.ALLOWED_ORIGIN;
  else process.env.ALLOWED_ORIGIN = originalAllowedOrigin;
});

describe('resolveCorsOriginConfig', () => {
  it('falls back to localhost-only origins when unset outside production', () => {
    const config = resolveCorsOriginConfig(undefined, false);
    expect(config.mode).toBe('localhost');
  });

  it('fails closed when unset in production', () => {
    const config = resolveCorsOriginConfig(undefined, true);
    expect(config.mode).toBe('deny-all');
  });

  it('parses one or more explicitly configured origins', () => {
    const config = resolveCorsOriginConfig(
      'https://app.example.com, https://admin.example.com,http://localhost:9090',
      true,
    );
    expect(config.mode).toBe('explicit');
    expect(config.allowedOrigins).toEqual([
      'https://app.example.com',
      'https://admin.example.com',
      'http://localhost:9090',
    ]);
  });

  it('treats "true" and "*" as invalid entries', () => {
    const dev = resolveCorsOriginConfig('true', false);
    expect(dev.mode).toBe('localhost');
    expect(dev.invalidEntries).toEqual(['true']);

    const wildcard = resolveCorsOriginConfig('https://ok.example.com, *', true);
    expect(wildcard.mode).toBe('deny-all');
    expect(wildcard.allowedOrigins).toEqual([]);
  });

  it('rejects non-absolute origin entries', () => {
    const config = resolveCorsOriginConfig('app.example.com', true);
    expect(config.mode).toBe('deny-all');
    expect(config.invalidEntries).toEqual(['app.example.com']);
  });
});

describe('isProductionEnvironment', () => {
  it('recognizes production from NODE_ENV or APP_ENV', () => {
    expect(isProductionEnvironment('production', 'development')).toBe(true);
    expect(isProductionEnvironment('development', 'production')).toBe(true);
    expect(isProductionEnvironment('development', 'development')).toBe(false);
    expect(isProductionEnvironment(undefined, undefined)).toBe(false);
  });
});

describe('createCorsOriginHandler', () => {
  it('allows non-browser requests without an Origin header', () => {
    const handler = createCorsOriginHandler(resolveCorsOriginConfig(undefined, true));
    handler(undefined, (err, allow) => {
      expect(err).toBeNull();
      expect(allow).toBe(true);
    });
  });

  it('allows documented localhost origins and rejects arbitrary origins in dev', () => {
    const handler = createCorsOriginHandler(resolveCorsOriginConfig(undefined, false));
    handler('http://localhost:5173', (_err, allow) => expect(allow).toBe(true));
    handler('http://127.0.0.1:9090', (_err, allow) => expect(allow).toBe(true));
    handler('https://evil.example', (_err, allow) => expect(allow).toBe(false));
    handler('http://localhost:5173/evil-path', (_err, allow) => expect(allow).toBe(false));
  });

  it('allows only explicitly configured origins when provided', () => {
    const config = resolveCorsOriginConfig('https://app.example.com,https://admin.example.com', true);
    const handler = createCorsOriginHandler(config);
    handler('https://app.example.com', (_err, allow) => expect(allow).toBe(true));
    handler('https://admin.example.com', (_err, allow) => expect(allow).toBe(true));
    handler('https://evil.example', (_err, allow) => expect(allow).toBe(false));
    handler('http://localhost:5173', (_err, allow) => expect(allow).toBe(false));
  });

  it('denies every origin when production configuration is missing', () => {
    const handler = createCorsOriginHandler(resolveCorsOriginConfig(undefined, true));
    handler('http://localhost:5173', (_err, allow) => expect(allow).toBe(false));
    handler('https://app.example.com', (_err, allow) => expect(allow).toBe(false));
  });
});

describe('isLocalhostOrigin', () => {
  it('accepts only bare localhost origins over http(s)', () => {
    expect(isLocalhostOrigin('http://localhost:5173')).toBe(true);
    expect(isLocalhostOrigin('https://localhost')).toBe(true);
    expect(isLocalhostOrigin('http://127.0.0.1:8080')).toBe(true);
    expect(isLocalhostOrigin('http://localhost:5173/path')).toBe(false);
    expect(isLocalhostOrigin('ftp://localhost')).toBe(false);
    expect(isLocalhostOrigin('https://evil.example')).toBe(false);
    expect(isLocalhostOrigin('not-a-url')).toBe(false);
  });
});

function buildApp(rawOrigin: string | undefined, nodeEnv: string, appEnv?: string) {
  const config = resolveCorsOriginConfig(
    rawOrigin,
    isProductionEnvironment(nodeEnv, appEnv),
  );
  const app = express();
  app.use(cors({ origin: createCorsOriginHandler(config), credentials: true }));
  app.get('/api/ping', (_req, res) => res.json({ ok: true }));
  return app;
}

describe('CORS middleware integration', () => {
  it('emits ACAO for an allowed origin and withholds it for a rejected origin', async () => {
    const app = buildApp(undefined, 'development');

    const allowed = await request(app)
      .options('/api/ping')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'GET');
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(allowed.headers['access-control-allow-credentials']).toBe('true');

    const rejected = await request(app)
      .options('/api/ping')
      .set('Origin', 'https://evil.example')
      .set('Access-Control-Request-Method', 'GET');
    expect(rejected.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('never reflects an arbitrary origin when credentials are enabled', async () => {
    const app = buildApp('https://app.example.com', 'production', 'production');
    const res = await request(app)
      .get('/api/ping')
      .set('Origin', 'https://evil.example');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('fails closed in production when ALLOWED_ORIGIN is missing', async () => {
    const app = buildApp(undefined, 'production');
    const res = await request(app)
      .options('/api/ping')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'GET');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});

const scriptPath = fileURLToPath(new URL('../scripts/validate-release-env.mjs', import.meta.url));

function runReleaseEnvValidation(extraEnv: Record<string, string>) {
  const env = { ...process.env };
  delete env.ALLOWED_ORIGIN;
  delete env.NODE_ENV;
  delete env.APP_ENV;
  for (const [key, value] of Object.entries(extraEnv)) env[key] = value;
  try {
    const stdout = execFileSync('node', [scriptPath], { env, encoding: 'utf8' });
    return { code: 0, stdout };
  } catch (err: any) {
    return { code: err.status as number, stdout: err.stdout as string, stderr: err.stderr as string };
  }
}

const completeProductionEnv: Record<string, string> = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://fake-user:fake-pass@db.internal:5432/neighborly',
  MEDIA_DATABASE_URL: 'postgresql://fake-user:fake-pass@media.internal:5432/media',
  JWT_SECRET: 'release-fake-access-secret-value-for-validation-test',
  JWT_REFRESH_SECRET: 'release-fake-refresh-secret-value-for-validation-test',
  DB_PASSWORD: 'fake-db-password-value',
  MEDIA_DB_PASSWORD: 'fake-media-db-password-value',
  MINIO_ROOT_USER: 'fake-minio-user',
  MINIO_ROOT_PASSWORD: 'fake-minio-password-value',
  GRAFANA_ADMIN_PASSWORD: 'fake-grafana-password-value',
  METRICS_TOKEN: 'fake-metrics-token-value',
  KYC_DOCUMENT_SIGNING_SECRET: 'fake-kyc-signing-secret-value',
};

describe('scripts/validate-release-env.mjs — ALLOWED_ORIGIN', () => {
  it('passes with an explicit origin list in production', () => {
    const result = runReleaseEnvValidation({
      ...completeProductionEnv,
      ALLOWED_ORIGIN: 'https://app.example.com,https://admin.example.com',
    });
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('passed');
  });

  it('fails when ALLOWED_ORIGIN is missing in production', () => {
    const result = runReleaseEnvValidation(completeProductionEnv);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('ALLOWED_ORIGIN is required');
  });

  it('fails when ALLOWED_ORIGIN is "true" or a wildcard in production', () => {
    const truthy = runReleaseEnvValidation({ ...completeProductionEnv, ALLOWED_ORIGIN: 'true' });
    expect(truthy.code).toBe(1);
    expect(truthy.stderr).toContain('explicit absolute origin');

    const wildcard = runReleaseEnvValidation({ ...completeProductionEnv, ALLOWED_ORIGIN: '*' });
    expect(wildcard.code).toBe(1);
    expect(wildcard.stderr).toContain('explicit absolute origin');
  });

  it('does not require ALLOWED_ORIGIN outside production', () => {
    const result = runReleaseEnvValidation({ ...completeProductionEnv, NODE_ENV: 'development' });
    expect(result.code).toBe(0);
  });
});
