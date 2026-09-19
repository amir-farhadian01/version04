import express, { type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../lib/auth.middleware.js', () => ({
  authenticate: (req: Request & { user?: unknown }, _res: Response, next: NextFunction) => {
    req.user = { userId: 'manager-1', role: 'customer' };
    next();
  },
}));

import { DeliveryError } from '../lib/delivery/errors.js';
import { createDeliveryOperationsRouter } from './deliveryOperations.js';

function appWith(service: Record<string, unknown>) {
  const app = express();
  app.use(express.json());
  app.use('/api/workspaces/:workspaceId/delivery-operations', createDeliveryOperationsRouter(service as never));
  app.use((_err: unknown, _req: Request, res: Response, _next: NextFunction) => res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal error' }));
  return app;
}

describe('workspace delivery operations router', () => {
  it('returns the capability in the standard success envelope', async () => {
    const service = { getCapability: vi.fn().mockResolvedValue({ enabled: false, canManage: true }) };
    const response = await request(appWith(service)).get('/api/workspaces/ws-1/delivery-operations/capability');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ data: { enabled: false, canManage: true } });
    expect(service.getCapability).toHaveBeenCalledWith('manager-1', 'ws-1');
  });

  it('rejects malformed assignment commands before calling the service', async () => {
    const service = { offerAssignment: vi.fn() };
    const response = await request(appWith(service))
      .post('/api/workspaces/ws-1/delivery-operations/fulfillments/fulfillment-1/assignments')
      .send({ businessDriverId: 'driver-1', expectedVersion: 0 });
    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
    expect(service.offerAssignment).not.toHaveBeenCalled();
  });

  it('serializes foreign nested resources as a generic 404', async () => {
    const service = { getFulfillmentForManager: vi.fn().mockRejectedValue(new DeliveryError('NOT_FOUND', 404, 'Resource not found')) };
    const response = await request(appWith(service)).get('/api/workspaces/ws-1/delivery-operations/fulfillments/foreign-id');
    expect(response.status).toBe(404);
    expect(response.body).toEqual({ code: 'NOT_FOUND', message: 'Resource not found' });
  });
});
