import express, { type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/auth.middleware.js', () => ({
  authenticate: (req: Request & { user?: unknown }, _res: Response, next: NextFunction) => {
    req.user = { userId: 'manager-1', role: 'customer' };
    next();
  },
}));

vi.mock('../lib/db.js', () => ({
  default: {
    company: { findFirst: vi.fn(), findUnique: vi.fn() },
    companyUser: { findFirst: vi.fn(), findMany: vi.fn(), findUnique: vi.fn() },
    staffSlotBlock: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
  },
}));

import prisma from '../lib/db.js';
import staffScheduleRouter from './staffSchedule.js';

function app() {
  const server = express();
  server.use(express.json());
  server.use('/', staffScheduleRouter);
  return server;
}

describe('shared staff schedule privacy', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows a manager only generic cross-workspace busy intervals', async () => {
    vi.mocked(prisma.companyUser.findMany)
      .mockResolvedValueOnce([{ companyId: 'shared-workspace' }] as never)
      .mockResolvedValueOnce([{ role: 'staff', company: { id: 'shared-workspace', name: 'Secret Co', logoUrl: null } }] as never);
    vi.mocked(prisma.companyUser.findFirst).mockResolvedValue({ companyId: 'shared-workspace', userId: 'manager-1', role: 'admin' } as never);
    vi.mocked(prisma.company.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.staffSlotBlock.findMany).mockResolvedValue([{
      id: 'block-1', staffId: 'staff-1', workspaceId: 'foreign-workspace',
      startAt: new Date('2026-09-12T13:00:00.000Z'), endAt: new Date('2026-09-12T14:00:00.000Z'),
      reason: 'delivery_assignment:secret', orderId: 'secret-order', createdAt: new Date(),
    }] as never);

    const response = await request(app()).get('/staff-1/availability?from=2026-09-12T00:00:00.000Z&to=2026-09-13T00:00:00.000Z');
    expect(response.status).toBe(200);
    expect(response.body.data.blockedSlots[0]).toEqual({
      id: 'block-1', startAt: '2026-09-12T13:00:00.000Z', endAt: '2026-09-12T14:00:00.000Z',
    });
    expect(response.body.data.workspaces).toEqual([]);
    expect(response.text).not.toContain('foreign-workspace');
    expect(response.text).not.toContain('secret-order');
    expect(response.text).not.toContain('Secret Co');
  });

  it('does not let an ordinary member create staff blocks', async () => {
    vi.mocked(prisma.company.findUnique).mockResolvedValue({ ownerId: 'owner-1' } as never);
    vi.mocked(prisma.companyUser.findUnique).mockResolvedValue({ role: 'member' } as never);
    const response = await request(app()).post('/workspaces/ws-1/staff/staff-1/block-slot').send({
      startAt: '2026-09-12T13:00:00.000Z', endAt: '2026-09-12T14:00:00.000Z',
    });
    expect(response.status).toBe(403);
    expect(prisma.companyUser.findUnique).toHaveBeenCalledWith({
      where: { companyId_userId: { companyId: 'ws-1', userId: 'manager-1' } },
    });
    expect(prisma.staffSlotBlock.create).not.toHaveBeenCalled();
  });
});
