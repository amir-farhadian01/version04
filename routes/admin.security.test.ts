import express, { type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  auditCreate: vi.fn(),
  createPasswordResetToken: vi.fn(),
}));

vi.mock('../lib/db.js', () => ({ default: {
  user: { findUnique: mocks.userFindUnique },
  auditLog: { create: mocks.auditCreate },
} }));
vi.mock('../lib/passwordReset.js', () => ({ createPasswordResetToken: mocks.createPasswordResetToken }));
vi.mock('../lib/auth.middleware.js', () => ({
  authenticate: (req: Request & { user?: unknown }, _res: Response, next: NextFunction) => {
    req.user = { userId: 'admin-user', role: 'platform_admin' };
    next();
  },
  isAdmin: (_req: Request, _res: Response, next: NextFunction) => next(),
  requireRole: () => (_req: Request, _res: Response, next: NextFunction) => next(),
}));
vi.mock('../lib/dependencyCatalog.js', () => ({
  buildDefaultDependencyCatalog: vi.fn(), catalogToText: vi.fn(), isDependencyCatalogV1: vi.fn(),
}));
vi.mock('../lib/adminUsersList.js', () => ({ getAdminUsersList: vi.fn(), getAdminUserIds: vi.fn() }));
vi.mock('../lib/adminUserDetail.js', () => ({ fetchAdminUserFull: vi.fn() }));
vi.mock('../lib/adminOverviewStats.js', () => ({ computeAdminOverviewStats: vi.fn(), computeOrdersSubmittedTrend: vi.fn() }));

import adminRouter from './admin.js';

describe('admin password-reset logging', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.userFindUnique.mockResolvedValue({ id: 'target-user', email: 'private-user@example.test', displayName: 'Private User' });
    mocks.createPasswordResetToken.mockResolvedValue('sensitive-reset-token');
    mocks.auditCreate.mockResolvedValue({ id: 'audit-1' });
  });

  it('does not expose the reset token, URL, or email in logs or audit metadata', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const app = express();
    app.use(express.json());
    app.use('/api/admin', adminRouter);
    try {
      const response = await request(app).post('/api/admin/users/target-user/reset-password-email');
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Password reset requested');
      expect(JSON.stringify(response.body).includes('private-user@example.test')).toBe(false);
      expect(log.mock.calls.flat().join(' ')).toBe('');
      expect(mocks.auditCreate).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ metadata: { message: 'Admin triggered password reset request' } }),
      }));
      expect(JSON.stringify(mocks.auditCreate.mock.calls).includes('private-user@example.test')).toBe(false);
      expect(JSON.stringify(mocks.auditCreate.mock.calls).includes('sensitive-reset-token')).toBe(false);
    } finally {
      log.mockRestore();
    }
  });
});
