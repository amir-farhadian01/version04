import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { BaseOrderStatus, OrderKind, OrderStatus } from '@prisma/client';

const db = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  company: { findUnique: vi.fn() },
  companyUser: { findUnique: vi.fn() },
  customIntakeForm: { findFirst: vi.fn(), updateMany: vi.fn(), create: vi.fn() },
  workspacePipelineStage: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    deleteMany: vi.fn(),
    createMany: vi.fn(),
  },
  providerServicePackage: { findMany: vi.fn() },
  order: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  auditLog: { create: vi.fn() },
  $transaction: vi.fn(),
}));

vi.hoisted(() => {
  process.env.JWT_SECRET = 'custom-orders-test-access-secret';
  process.env.JWT_REFRESH_SECRET = 'custom-orders-test-refresh-secret';
});

vi.mock('../../lib/db.js', () => ({ default: db, prisma: db }));
vi.mock('../../lib/tokenBlacklist.js', () => ({
  isTokenBlacklisted: vi.fn().mockResolvedValue(false),
}));

import {
  customBundleOrdersRoutes,
  workspaceCustomFormsRoutes,
} from '../customOrdersAndForms.js';
import { signAccessToken } from '../../lib/jwt.js';
import {
  invalidIntakeFormWithElevenFields,
  invalidSchedulingBundle,
  validCustomBundleWithTwoItems,
  validIntakeFormWithTenFields,
  validPipelineStagesFixture,
} from '../../tests/fixtures/offersOrdersJobsFixtures.js';

const app = express();
app.use(express.json());
app.use('/api/workspaces', workspaceCustomFormsRoutes);
app.use('/api/orders', customBundleOrdersRoutes);

const tokenFor = (userId: string, role = 'customer') =>
  signAccessToken({ userId, role, email: `${userId}@example.test` });

beforeEach(() => {
  vi.clearAllMocks();
  db.user.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => ({
    role: where.id.startsWith('owner') ? 'provider' : 'customer',
  }));
  db.company.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => {
    if (where.id === 'ws-test-1') {
      return { id: 'ws-test-1', ownerId: 'owner-ws-1' };
    }
    return null;
  });
  db.companyUser.findUnique.mockImplementation(
    async ({
      where,
    }: {
      where: { companyId_userId: { companyId: string; userId: string } };
    }) => {
      if (
        where.companyId_userId.companyId === 'ws-test-1' &&
        where.companyId_userId.userId === 'staff-ws-1'
      ) {
        return { companyId: 'ws-test-1', userId: 'staff-ws-1', role: 'staff' };
      }
      return null;
    },
  );
  db.$transaction.mockImplementation(async (callback: (tx: typeof db) => unknown) =>
    callback(db),
  );
});

describe('Workspace Custom Intake Form & Pipeline Stage APIs', () => {
  it('returns 401 when unauthenticated', async () => {
    const res = await request(app).get('/api/workspaces/ws-test-1/intake-form');
    expect(res.status).toBe(401);
  });

  it('returns empty state when no active intake form exists', async () => {
    db.customIntakeForm.findFirst.mockResolvedValue(null);
    const res = await request(app)
      .get('/api/workspaces/ws-test-1/intake-form')
      .set('Authorization', `Bearer ${tokenFor('customer-1')}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('empty');
    expect(res.body.data).toBeNull();
  });

  it('enforces workspaceId ownership on PUT /intake-form (forbids outsider and staff)', async () => {
    const outsider = await request(app)
      .put('/api/workspaces/ws-test-1/intake-form')
      .set('Authorization', `Bearer ${tokenFor('outsider-1')}`)
      .send(validIntakeFormWithTenFields);
    expect(outsider.status).toBe(403);

    const staff = await request(app)
      .put('/api/workspaces/ws-test-1/intake-form')
      .set('Authorization', `Bearer ${tokenFor('staff-ws-1')}`)
      .send(validIntakeFormWithTenFields);
    expect(staff.status).toBe(403);
  });

  it('rejects >10 fields with 400 and saves valid 10-field intake form', async () => {
    const invalid = await request(app)
      .put('/api/workspaces/ws-test-1/intake-form')
      .set('Authorization', `Bearer ${tokenFor('owner-ws-1', 'provider')}`)
      .send(invalidIntakeFormWithElevenFields);
    expect(invalid.status).toBe(400);
    expect(db.customIntakeForm.create).not.toHaveBeenCalled();

    db.customIntakeForm.create.mockResolvedValue({
      id: 'form-1',
      workspaceId: 'ws-test-1',
      ...validIntakeFormWithTenFields,
    });

    const valid = await request(app)
      .put('/api/workspaces/ws-test-1/intake-form')
      .set('Authorization', `Bearer ${tokenFor('owner-ws-1', 'provider')}`)
      .send(validIntakeFormWithTenFields);
    expect(valid.status).toBe(200);
    expect(valid.body.status).toBe('success');
    expect(valid.body.data.id).toBe('form-1');
  });

  it('saves and retrieves custom pipeline stages mapped to the 7 base states', async () => {
    db.workspacePipelineStage.findMany.mockResolvedValueOnce([]);
    const emptyRes = await request(app)
      .get('/api/workspaces/ws-test-1/pipeline-stages')
      .set('Authorization', `Bearer ${tokenFor('owner-ws-1', 'provider')}`);
    expect(emptyRes.status).toBe(200);
    expect(emptyRes.body.status).toBe('empty');

    db.workspacePipelineStage.findMany.mockResolvedValueOnce(validPipelineStagesFixture);
    const saveRes = await request(app)
      .post('/api/workspaces/ws-test-1/pipeline-stages')
      .set('Authorization', `Bearer ${tokenFor('owner-ws-1', 'provider')}`)
      .send({ stages: validPipelineStagesFixture });
    expect(saveRes.status).toBe(201);
    expect(saveRes.body.status).toBe('success');
    expect(saveRes.body.data).toHaveLength(5);
  });
});

describe('Custom Bundle Order & CRM Stage Update APIs', () => {
  it('validates line-item scheduling and creates custom bundle order with aggregate start/end', async () => {
    const invalidRes = await request(app)
      .post('/api/orders/custom-bundle')
      .set('Authorization', `Bearer ${tokenFor('customer-1')}`)
      .send(invalidSchedulingBundle);
    expect(invalidRes.status).toBe(400);

    db.customIntakeForm.findFirst.mockResolvedValue({
      id: 'form-1',
      serviceCatalogId: 'cat-test-1',
      fields: validIntakeFormWithTenFields.fields,
    });
    db.providerServicePackage.findMany.mockResolvedValue([
      {
        id: 'pkg-1',
        name: 'نظافت کامل واحد',
        finalPrice: 120,
        currency: 'CAD',
        serviceCatalogId: 'cat-test-1',
      },
    ]);
    db.workspacePipelineStage.findFirst.mockResolvedValue(validPipelineStagesFixture[0]);
    db.order.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'order-bundle-1',
      ...data,
      lineItems: validCustomBundleWithTwoItems.items,
      currentStage: validPipelineStagesFixture[0],
    }));

    const res = await request(app)
      .post('/api/orders/custom-bundle')
      .set('Authorization', `Bearer ${tokenFor('customer-1')}`)
      .send(validCustomBundleWithTwoItems);

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('success');
    expect(res.body.paymentNotice).toContain('توافقی/حضوری');
    expect(db.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          orderKind: OrderKind.custom_bundle,
          overallStartAt: new Date('2026-12-01T10:00:00.000Z'),
          overallEndAt: new Date('2026-12-02T16:00:00.000Z'),
        }),
      }),
    );
  });

  it('blocks direct cancellation via pipeline stage when order is InProgress', async () => {
    db.order.findUnique.mockResolvedValue({
      id: 'order-1',
      matchedWorkspaceId: 'ws-test-1',
      status: OrderStatus.in_progress,
      currentStageId: 'st-4',
    });
    db.workspacePipelineStage.findUnique.mockResolvedValue({
      id: 'st-cancel',
      workspaceId: 'ws-test-1',
      name: 'لغو',
      baseStatus: BaseOrderStatus.Cancelled,
    });

    const res = await request(app)
      .patch('/api/orders/order-1/pipeline-stage')
      .set('Authorization', `Bearer ${tokenFor('owner-ws-1', 'provider')}`)
      .send({ stageId: 'st-cancel' });

    expect(res.status).toBe(400);
    expect(db.order.update).not.toHaveBeenCalled();
  });

  it('updates pipeline stage and writes audit log for authorized workspace member', async () => {
    db.order.findUnique.mockResolvedValue({
      id: 'order-1',
      matchedWorkspaceId: 'ws-test-1',
      status: OrderStatus.submitted,
      currentStageId: 'st-1',
    });
    db.workspacePipelineStage.findUnique.mockResolvedValue({
      id: 'st-2',
      workspaceId: 'ws-test-1',
      name: 'ارزیابی فنی',
      baseStatus: BaseOrderStatus.InReview,
    });
    db.order.update.mockResolvedValue({
      id: 'order-1',
      status: OrderStatus.matching,
      currentStageId: 'st-2',
    });

    const res = await request(app)
      .patch('/api/orders/order-1/pipeline-stage')
      .set('Authorization', `Bearer ${tokenFor('staff-ws-1')}`)
      .send({ stageId: 'st-2', internalNote: 'بررسی اولیه انجام شد' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(db.auditLog.create).toHaveBeenCalledTimes(1);
  });

  it('returns bundle details to owning customer and denies unrelated user', async () => {
    db.order.findUnique.mockResolvedValue({
      id: 'order-1',
      customerId: 'customer-1',
      matchedWorkspaceId: 'ws-test-1',
      orderKind: OrderKind.custom_bundle,
      status: OrderStatus.submitted,
      currentStage: validPipelineStagesFixture[0],
      overallStartAt: new Date('2026-12-01T10:00:00.000Z'),
      overallEndAt: new Date('2026-12-02T16:00:00.000Z'),
      intakeAnswers: validCustomBundleWithTwoItems.intakeAnswers,
      lineItems: validCustomBundleWithTwoItems.items,
    });

    const ownerRes = await request(app)
      .get('/api/orders/order-1/bundle-details')
      .set('Authorization', `Bearer ${tokenFor('customer-1')}`);
    expect(ownerRes.status).toBe(200);
    expect(ownerRes.body.status).toBe('success');

    const unrelatedRes = await request(app)
      .get('/api/orders/order-1/bundle-details')
      .set('Authorization', `Bearer ${tokenFor('outsider-2')}`);
    expect(unrelatedRes.status).toBe(403);
  });
});
