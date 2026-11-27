import express, { type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../lib/auth.middleware.js', () => ({
  authenticate: (req: Request & { user?: unknown }, _res: Response, next: NextFunction) => {
    req.user = { userId: 'platform-owner', role: 'owner' };
    next();
  },
}));

import { createAdminDeliveryOperationsRouter } from './adminDeliveryOperations.js';

describe('admin delivery capability router', () => {
  it('passes the refreshed actor role to the capability service', async () => {
    const service = { setWorkspaceCapability: vi.fn().mockResolvedValue({ id: 'ws-1', deliveryOperationsEnabled: true }) };
    const app = express();
    app.use(express.json());
    app.use('/api/admin', createAdminDeliveryOperationsRouter(service as never));
    const response = await request(app).patch('/api/admin/workspaces/ws-1/delivery-operations').send({ enabled: true });
    expect(response.status).toBe(200);
    expect(service.setWorkspaceCapability).toHaveBeenCalledWith('platform-owner', 'owner', 'ws-1', true);
  });
});
