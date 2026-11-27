import express, { type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../lib/auth.middleware.js', () => ({
  authenticate: (req: Request & { user?: unknown }, _res: Response, next: NextFunction) => {
    req.user = { userId: 'driver-user-1', role: 'customer' };
    next();
  },
}));

import { createDriverDeliveriesRouter } from './driverDeliveries.js';

describe('driver-self delivery router', () => {
  it('is independent of the global role and calls only the authenticated principal', async () => {
    const service = { listRelationships: vi.fn().mockResolvedValue([{ id: 'driver-1' }]) };
    const app = express();
    app.use('/api/driver', createDriverDeliveriesRouter(service as never));
    const response = await request(app).get('/api/driver/relationships');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ data: [{ id: 'driver-1' }] });
    expect(service.listRelationships).toHaveBeenCalledWith('driver-user-1');
  });

  it('requires optimistic versions when accepting an assignment', async () => {
    const service = { respondAssignment: vi.fn() };
    const app = express();
    app.use(express.json());
    app.use('/api/driver', createDriverDeliveriesRouter(service as never));
    const response = await request(app).post('/api/driver/assignments/a-1/respond').send({ action: 'accept' });
    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
    expect(service.respondAssignment).not.toHaveBeenCalled();
  });
});
