import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { incrementOperationalMetric, installObservability } from './observability.js';

function createApp(overrides: Record<string, unknown> = {}) {
  const app = express();
  installObservability(app, {
    prisma: {
      $queryRaw: vi.fn().mockResolvedValue([{
        migrations: '_prisma_migrations',
        applicationSchema: 'User',
      }]),
    } as never,
    pingRedis: vi.fn().mockResolvedValue(true),
    isNatsAvailable: () => true,
    storagePath: process.cwd(),
    service: 'test-api',
    version: 'test',
    ...overrides,
  });
  app.get('/example', (_req, res) => res.status(204).send());
  return app;
}

describe('observability', () => {
  it('returns liveness without dependency checks and propagates a request id', async () => {
    const response = await request(createApp()).get('/api/health').set('x-request-id', 'trace-123');
    expect(response.status).toBe(200);
    expect(response.headers['x-request-id']).toBe('trace-123');
    expect(response.body).toMatchObject({ status: 'ok', service: 'test-api', version: 'test' });
  });

  it('reports release identity without exposing configuration', async () => {
    const response = await request(createApp({
      environment: 'staging',
      gitSha: 'abc123',
    })).get('/api/version');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ version: 'test', environment: 'staging', gitSha: 'abc123' });
  });

  it('reports optional dependencies as degraded without failing readiness', async () => {
    const response = await request(createApp({
      pingRedis: vi.fn().mockResolvedValue(false),
      isNatsAvailable: () => false,
    })).get('/api/ready');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('degraded');
    expect(response.body.unavailableOptional).toEqual(['redis', 'nats']);
  });

  it('fails readiness when a required dependency is unavailable', async () => {
    const response = await request(createApp({
      prisma: { $queryRaw: vi.fn().mockRejectedValue(new Error('offline')) },
    })).get('/api/ready');
    expect(response.status).toBe(503);
    expect(response.body.unavailableRequired).toContain('database');
  });

  it('fails readiness when the database is reachable but the application schema is absent', async () => {
    const response = await request(createApp({
      prisma: {
        $queryRaw: vi.fn().mockResolvedValue([{
          migrations: null,
          applicationSchema: null,
        }]),
      },
    })).get('/api/ready');
    expect(response.status).toBe(503);
    expect(response.body.unavailableRequired).toContain('database');
  });

  it('protects metrics with a constant-time bearer-token comparison', async () => {
    const app = createApp({ metricsToken: 'metrics-secret', environment: 'production' });
    expect((await request(app).get('/api/metrics')).status).toBe(401);
    const response = await request(app).get('/api/metrics').set('Authorization', 'Bearer metrics-secret');
    expect(response.status).toBe(200);
    expect(response.text).toContain('neighborly_http_requests_total');
  });

  it('does not expose an unconfigured production metrics endpoint', async () => {
    const response = await request(createApp({ environment: 'production' })).get('/api/metrics');
    expect(response.status).toBe(503);
  });

  it('exports bounded operational counters and rejects arbitrary labels', async () => {
    incrementOperationalMetric('job_failures_total');
    expect(() => incrementOperationalMetric('user_supplied_label')).toThrow('Unsupported operational metric');
    const response = await request(createApp()).get('/api/metrics');
    expect(response.text).toContain('event="job_failures_total"');
  });
});
