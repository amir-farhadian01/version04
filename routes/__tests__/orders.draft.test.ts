import { describe, it, expect, vi, beforeAll } from 'vitest';
import request from 'supertest';

vi.mock('../../lib/auth.middleware.js', () => ({
  authenticate: vi.fn((req: any, res: any, next: any) => {
    if (!req.headers.authorization?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }
    req.user = { userId: 'customer-1', role: 'customer' };
    next();
  }),
  requireRole: vi.fn(() => (_req: any, _res: any, next: any) => next()),
  isAdmin: vi.fn((_req: any, _res: any, next: any) => next()),
}));

import { createApp } from '../../test-helpers/app.js';
import type { Express } from 'express';

let app: Express;
let customerToken: string;

beforeAll(async () => {
  const setup = await createApp();
  app = setup.app;
  customerToken = 'test-customer-token';
});

describe('POST /api/orders/draft', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).post('/api/orders/draft').send({});
    expect(res.status).toBe(401);
  });

  it('returns 400 for an invalid entryPoint before querying the database', async () => {
    const res = await request(app)
      .post('/api/orders/draft')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        serviceCatalogId: 'nonexistent-id',
        entryPoint: 'invalid',
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('entryPoint');
  });

  it('returns 400 when serviceCatalogId is missing', async () => {
    const res = await request(app)
      .post('/api/orders/draft')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ entryPoint: 'wizard' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('serviceCatalogId');
  });

  it('returns 400 when entryPoint is missing', async () => {
    const res = await request(app)
      .post('/api/orders/draft')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ serviceCatalogId: 'test-svc-123' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/orders (create published)', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).post('/api/orders').send({
      categoryId: 'test',
      description: 'I need a living room painted with white color walls only',
      status: 'published',
    });
    expect(res.status).toBe(401);
  });
});
