import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock prisma (inline factory — no top-level variables) ────────────────────

vi.mock('../lib/db.js', () => ({
  default: {
    order: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    payment: {
      update: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

// ── Mock auth middleware ──────────────────────────────────────────────────────

vi.mock('../lib/auth.middleware.js', () => ({
  authenticate: vi.fn((req: any, _res: any, next: any) => {
    req.user = { userId: 'admin-1', role: 'platform_admin' };
    next();
  }),
  isAdmin: vi.fn((_req: any, _res: any, next: any) => {
    next();
  }),
  AuthRequest: class {},
}));

// ── Import router after mocks ─────────────────────────────────────────────────

import adminDisputesRouter from './adminDisputes.js';
import express from 'express';
import http from 'http';
import prisma from '../lib/db.js';

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/admin/disputes', adminDisputesRouter);
  return http.createServer(app);
}

function request(
  method: 'GET' | 'POST',
  path: string,
  body?: Record<string, unknown>,
): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const app = createTestApp();
    const server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      const options: http.RequestOptions = {
        method,
        hostname: '127.0.0.1',
        port,
        path,
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token',
        },
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          server.close();
          try {
            resolve({ status: res.statusCode ?? 500, body: JSON.parse(data) });
          } catch {
            resolve({ status: res.statusCode ?? 500, body: data });
          }
        });
      });

      req.on('error', (err) => {
        server.close();
        reject(err);
      });

      if (body) {
        req.write(JSON.stringify(body));
      }
      req.end();
    });
  });
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('GET /admin/disputes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should list disputed orders', async () => {
    const mockDisputes = [
      {
        id: 'order-1',
        status: 'disputed',
        customer: { id: 'user-1', firstName: 'John', lastName: 'Doe', email: 'john@test.com' },
        providerWorkspace: { id: 'ws-1', name: 'Test Workspace' },
        payment: { amount: 100, commission: 10, status: 'pending' },
        dispute: { id: 'dispute-1', reason: 'Service was not completed properly' },
      },
    ];

    (prisma.order.findMany as any).mockResolvedValue(mockDisputes);

    const res = await request('GET', '/admin/disputes');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(mockDisputes);
    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'disputed' },
        orderBy: { updatedAt: 'desc' },
      }),
    );
  });

  it('should return empty array when no disputes exist', async () => {
    (prisma.order.findMany as any).mockResolvedValue([]);

    const res = await request('GET', '/admin/disputes');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });
});

describe('GET /admin/disputes/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should get dispute details for a specific order', async () => {
    const mockOrder = {
      id: 'order-1',
      status: 'disputed',
      dispute: { id: 'dispute-1', reason: 'Poor service quality' },
      customer: { id: 'user-1', firstName: 'John', lastName: 'Doe', email: 'john@test.com', phone: '+1234567890' },
      providerWorkspace: { id: 'ws-1', name: 'Test Workspace' },
      payment: { amount: 100, commission: 10, status: 'pending' },
      servicePackage: { name: 'Basic Cleaning' },
    };

    (prisma.order.findUnique as any).mockResolvedValue(mockOrder);

    const res = await request('GET', '/admin/disputes/order-1');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(mockOrder);
    expect(prisma.order.findUnique).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      include: expect.objectContaining({
        dispute: true,
        customer: expect.any(Object),
        providerWorkspace: expect.any(Object),
        payment: true,
        servicePackage: expect.any(Object),
      }),
    });
  });

  it('should return 404 for non-disputed order', async () => {
    (prisma.order.findUnique as any).mockResolvedValue({
      id: 'order-2',
      status: 'completed',
    });

    const res = await request('GET', '/admin/disputes/order-2');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Dispute not found');
  });

  it('should return 404 for non-existent order', async () => {
    (prisma.order.findUnique as any).mockResolvedValue(null);

    const res = await request('GET', '/admin/disputes/non-existent');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Dispute not found');
  });
});

describe('POST /admin/disputes/:id/resolve', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should resolve dispute with refund_customer', async () => {
    (prisma.order.findUnique as any).mockResolvedValue({
      id: 'order-1',
      status: 'disputed',
      payment: { amount: 100, commission: 10, status: 'pending' },
      dispute: { id: 'dispute-1', reason: 'Incomplete work' },
    });

    (prisma.$transaction as any).mockImplementation(async (cb: (tx: any) => Promise<void>) => {
      const tx = {
        order: { update: vi.fn().mockResolvedValue({}) },
        payment: { update: vi.fn().mockResolvedValue({}) },
        auditLog: { create: vi.fn().mockResolvedValue({}) },
      };
      await cb(tx);
      expect(tx.order.update).toHaveBeenCalledWith({
        where: { id: 'order-1' },
        data: { status: 'resolved' },
      });
      expect(tx.payment.update).toHaveBeenCalledWith({
        where: { orderId: 'order-1' },
        data: { status: 'refunded' },
      });
      expect(tx.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actorId: 'admin-1',
          action: 'dispute_resolved',
          resourceType: 'order',
          resourceId: 'order-1',
          metadata: expect.objectContaining({
            resolution: 'refund_customer',
            adminNote: 'Customer reported incomplete work, refund issued.',
          }),
        }),
      });
    });

    const res = await request('POST', '/admin/disputes/order-1/resolve', {
      resolution: 'refund_customer',
      adminNote: 'Customer reported incomplete work, refund issued.',
    });

    expect(res.status).toBe(200);
    expect(res.body.data.resolution).toBe('refund_customer');
    expect(res.body.data.orderId).toBe('order-1');
  });

  it('should resolve dispute with release_provider', async () => {
    (prisma.order.findUnique as any).mockResolvedValue({
      id: 'order-2',
      status: 'disputed',
      payment: { amount: 200, commission: 20, status: 'pending' },
      dispute: { id: 'dispute-2', reason: 'Customer refused to pay' },
    });

    (prisma.$transaction as any).mockImplementation(async (cb: (tx: any) => Promise<void>) => {
      const tx = {
        order: { update: vi.fn().mockResolvedValue({}) },
        payment: { update: vi.fn().mockResolvedValue({}) },
        auditLog: { create: vi.fn().mockResolvedValue({}) },
      };
      await cb(tx);
      expect(tx.payment.update).toHaveBeenCalledWith({
        where: { orderId: 'order-2' },
        data: { status: 'captured' },
      });
    });

    const res = await request('POST', '/admin/disputes/order-2/resolve', {
      resolution: 'release_provider',
      adminNote: 'Provider completed work as agreed, releasing funds.',
    });

    expect(res.status).toBe(200);
    expect(res.body.data.resolution).toBe('release_provider');
  });

  it('should resolve dispute with split', async () => {
    (prisma.order.findUnique as any).mockResolvedValue({
      id: 'order-3',
      status: 'disputed',
      payment: { amount: 300, commission: 30, status: 'pending' },
      dispute: { id: 'dispute-3', reason: 'Partial work completed' },
    });

    (prisma.$transaction as any).mockImplementation(async (cb: (tx: any) => Promise<void>) => {
      const tx = {
        order: { update: vi.fn().mockResolvedValue({}) },
        payment: { update: vi.fn().mockResolvedValue({}) },
        auditLog: { create: vi.fn().mockResolvedValue({}) },
      };
      await cb(tx);
      expect(tx.payment.update).toHaveBeenCalledWith({
        where: { orderId: 'order-3' },
        data: { status: 'refunded' },
      });
    });

    const res = await request('POST', '/admin/disputes/order-3/resolve', {
      resolution: 'split',
      adminNote: 'Splitting 70/30 due to partial completion.',
      customerRefundPercent: 70,
      providerReleasePercent: 30,
    });

    expect(res.status).toBe(200);
    expect(res.body.data.resolution).toBe('split');
  });

  it('should reject invalid resolution data', async () => {
    const res = await request('POST', '/admin/disputes/order-1/resolve', {
      resolution: 'invalid_resolution',
      adminNote: 'Short',
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
  });

  it('should reject non-disputed orders', async () => {
    (prisma.order.findUnique as any).mockResolvedValue({
      id: 'order-4',
      status: 'completed',
      payment: null,
    });

    const res = await request('POST', '/admin/disputes/order-4/resolve', {
      resolution: 'refund_customer',
      adminNote: 'This is a valid admin note for testing purposes.',
    });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Dispute not found or already resolved');
  });

  it('should reject already-resolved orders', async () => {
    (prisma.order.findUnique as any).mockResolvedValue({
      id: 'order-5',
      status: 'resolved',
      payment: null,
    });

    const res = await request('POST', '/admin/disputes/order-5/resolve', {
      resolution: 'refund_customer',
      adminNote: 'This is a valid admin note for testing purposes.',
    });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Dispute not found or already resolved');
  });

  it('should reject adminNote shorter than 10 characters', async () => {
    const res = await request('POST', '/admin/disputes/order-1/resolve', {
      resolution: 'refund_customer',
      adminNote: 'Short',
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
  });
});
