import express, { type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/auth.middleware.js', () => ({
  authenticate: (req: Request & { user?: unknown }, _res: Response, next: NextFunction) => {
    req.user = { userId: 'owner-1', role: 'customer' };
    next();
  },
}));
vi.mock('../lib/locationCache.js', () => ({ setWorkspaceLocation: vi.fn() }));
vi.mock('../lib/profileVisibility.js', () => ({
  hasContractedOrderWithWorkspace: vi.fn().mockResolvedValue(false),
  isAdminRole: vi.fn().mockReturnValue(false),
  CONTACT_FIELDS: [],
}));
vi.mock('../lib/db.js', () => ({
  default: {
    company: { findUnique: vi.fn() },
    companyUser: { findUnique: vi.fn(), delete: vi.fn() },
    deliveryAssignment: { count: vi.fn() },
  },
}));

import prisma from '../lib/db.js';
import companiesRouter from './companies.js';

describe('workspace membership delivery safeguards', () => {
  beforeEach(() => vi.clearAllMocks());

  it('blocks removal of a member who has live delivery work', async () => {
    vi.mocked(prisma.company.findUnique).mockResolvedValue({ ownerId: 'owner-1' } as never);
    vi.mocked(prisma.deliveryAssignment.count).mockResolvedValue(1);
    const app = express();
    app.use(express.json());
    app.use('/api/companies', companiesRouter);

    const response = await request(app).delete('/api/companies/ws-1/members/driver-user-1');
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('LIVE_DRIVER_WORK');
    expect(prisma.deliveryAssignment.count).toHaveBeenCalledWith({ where: {
      businessDriver: { companyId: 'ws-1', userId: 'driver-user-1' },
      status: { in: ['offered', 'accepted'] },
      fulfillment: { status: { in: ['assigned', 'accepted', 'picked_up', 'in_transit'] } },
    } });
    expect(prisma.companyUser.delete).not.toHaveBeenCalled();
  });
});
