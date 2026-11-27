import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock prisma (inline factory — no top-level variables) ────────────────────

vi.mock('../lib/db.js', () => ({
  default: {
    order: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    companyUser: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    quote: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

// ── Mock auth middleware ──────────────────────────────────────────────────────

vi.mock('../lib/auth.middleware.js', () => ({
  authenticate: vi.fn((req: any, _res: any, next: any) => {
    req.user = { userId: 'provider-1', role: 'provider' };
    next();
  }),
  AuthRequest: class {},
}));

// ── Mock workspace access ─────────────────────────────────────────────────────

vi.mock('../lib/workspaceAccess.js', () => ({
  assertWorkspaceMember: vi.fn().mockResolvedValue(undefined),
  isWorkspaceAccessError: vi.fn(() => false),
  WorkspaceAccessError: class extends Error {},
}));

// ── Import router after mocks ─────────────────────────────────────────────────

import workspacesRouter from './workspaces.js';
import express from 'express';
import http from 'http';
import prisma from '../lib/db.js';

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/workspaces', workspacesRouter);
  return http.createServer(app);
}

function get(path: string): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const server = createTestApp().listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (!addr || typeof addr === 'string') return reject(new Error('no address'));
      const req = http.get(`http://127.0.0.1:${addr.port}${path}`, (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => {
          server.close();
          resolve({ status: res.statusCode ?? 0, body: raw ? JSON.parse(raw) : null });
        });
      });
      req.on('error', (e) => {
        server.close();
        reject(e);
      });
    });
  });
}

const WS = 'ws-1';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.order.count).mockResolvedValue(0);
  vi.mocked(prisma.companyUser.count).mockResolvedValue(0);
  vi.mocked(prisma.quote.count).mockResolvedValue(0);
  vi.mocked(prisma.order.findMany).mockResolvedValue([]);
  vi.mocked(prisma.companyUser.findMany).mockResolvedValue([]);
  vi.mocked(prisma.quote.findMany).mockResolvedValue([]);
});

describe('GET /:id/dashboard/overview', () => {
  it('returns the rich dashboard contract alongside the legacy summary fields', async () => {
    vi.mocked(prisma.order.count).mockImplementation((async (args: any) => {
      const statuses: string[] | undefined = args?.where?.status?.in;
      if (statuses && statuses.includes('completed')) return 1; // completedOrders
      if (statuses && statuses.includes('in_progress')) return 1; // pendingOrders
      return 2; // totalOrders (NOT draft)
    }) as never);
    vi.mocked(prisma.order.findMany).mockImplementation((async (args: any) => {
      if (args?.orderBy?.scheduledAt === 'asc') return []; // upcoming appointments query
      if (args?.select?.matchedPackage && Object.keys(args.select).length === 1) {
        // completedRows (totalEarnings) query
        return [
          { matchedPackage: { finalPrice: 5500, currency: 'CAD' } },
          { matchedPackage: { finalPrice: 10000, currency: 'CAD' } },
        ];
      }
      return [
        {
          id: 'o-1',
          status: 'completed',
          description: 'Deep clean',
          createdAt: new Date('2026-08-14T10:00:00Z'),
          updatedAt: new Date('2026-08-14T12:00:00Z'),
          serviceCatalog: { name: 'Cleaning' },
          customer: { id: 'u-1', displayName: 'Alice', firstName: null, lastName: null },
          matchedPackage: { name: 'Deep Clean', finalPrice: 5500, currency: 'CAD' },
          orderContract: null,
        },
        {
          id: 'o-2',
          status: 'in_progress',
          description: 'Install',
          createdAt: new Date('2026-08-13T10:00:00Z'),
          updatedAt: new Date('2026-08-13T11:00:00Z'),
          serviceCatalog: { name: 'Solar' },
          customer: { id: 'u-1', displayName: 'Alice', firstName: null, lastName: null },
          matchedPackage: { name: 'Panel Install', finalPrice: 10000, currency: 'CAD' },
          orderContract: { currentVersion: { amount: 12000, currency: 'CAD' } },
        },
      ];
    }) as never);
    vi.mocked(prisma.companyUser.findMany).mockResolvedValue([
      {
        userId: 'staff-1',
        role: 'OWNER',
        staffRole: 'technician',
        user: { id: 'staff-1', displayName: 'Bob', firstName: 'Bob', lastName: null, avatarUrl: null },
      },
    ] as never);
    vi.mocked(prisma.quote.findMany).mockResolvedValue([
      { id: 'q-1', title: 'Kitchen quote', status: 'SENT', createdAt: new Date('2026-08-14T09:00:00Z') },
    ] as never);
    vi.mocked(prisma.companyUser.count).mockResolvedValue(1);
    vi.mocked(prisma.quote.count).mockResolvedValue(1);

    const { status, body } = await get(`/workspaces/${WS}/dashboard/overview`);

    expect(status).toBe(200);
    // legacy summary contract (services/business.ts getWorkspaceStats)
    expect(body).toMatchObject({ totalOrders: 2, pendingOrders: 1, completedOrders: 1, totalEarnings: 15500, activeStaff: 1 });
    // rich contract (BusinessDashboard page)
    expect(body.activeOrders).toBe(1);
    expect(body.pendingQuotes).toBe(1);
    expect(typeof body.todayAppointments).toBe('number');
    expect(typeof body.revenueThisMonth).toBe('number');
    expect(Array.isArray(body.upcomingAppointments)).toBe(true);
    expect(Array.isArray(body.pipeline)).toBe(true);
    expect(body.pipeline).toEqual(
      expect.arrayContaining([expect.objectContaining({ status: 'completed', count: 1, total: 5500 })])
    );
    expect(body.recentOrders[0]).toMatchObject({ id: 'o-1', title: 'Cleaning', total: 5500, status: 'completed' });
    expect(body.staff[0]).toMatchObject({ id: 'staff-1', role: 'technician', active: true });
    expect(body.topCustomers[0]).toMatchObject({ userId: 'u-1', totalSpent: 17500, orderCount: 2 });
    expect(body.recentActivity.length).toBeGreaterThan(0);
    expect(body.recentActivity[0]).toHaveProperty('message');
  });

  it('never leaves required array fields undefined when the workspace has no data', async () => {
    const { status, body } = await get(`/workspaces/${WS}/dashboard/overview`);

    expect(status).toBe(200);
    for (const key of ['upcomingAppointments', 'recentOrders', 'staff', 'pipeline', 'topCustomers', 'recentActivity']) {
      expect(Array.isArray(body[key]), `${key} must be an array`).toBe(true);
    }
    expect(body.totalOrders).toBe(0);
  });
});
