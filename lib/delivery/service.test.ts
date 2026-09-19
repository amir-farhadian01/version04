import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';

vi.mock('../bus.js', () => ({ publish: vi.fn().mockResolvedValue(undefined) }));

import { DeliveryError } from './errors.js';
import { DeliveryService } from './service.js';

const now = new Date('2026-09-11T12:00:00.000Z');

function createFakeDb() {
  const state: any = {
    workspace: { id: 'ws-1', ownerId: 'manager-1', name: 'Bakery', deliveryOperationsEnabled: true },
    driver: {
      id: 'driver-1', companyId: 'ws-1', userId: 'driver-user-1', engagementType: 'hourly', status: 'active',
      availabilityMode: 'on_demand', presence: 'available', version: 3, currentAcceptedTermId: 'term-1', archivedAt: null,
    },
    term: {
      id: 'term-1', businessDriverId: 'driver-1', versionNumber: 1, schemaVersion: 1, currency: 'CAD',
      components: [{ type: 'hourly', amountCents: 2500 }], status: 'accepted', proposedById: 'manager-1',
      acceptedById: 'driver-user-1', proposedAt: now, acceptedAt: now, rejectedAt: null, supersededAt: null, createdAt: now,
    },
    fulfillment: {
      id: 'fulfillment-1', orderId: 'order-1', workspaceId: 'ws-1', providerKind: 'internal_driver', providerKey: 'internal',
      status: 'unassigned', version: 1, currentAssignmentId: null, addressSchemaVersion: 1,
      pickupAddressSnapshot: { line1: '1 Front Street', city: 'Toronto', province: 'ON', postalCode: 'M5J 1E6', country: 'CA' },
      dropoffAddressSnapshot: { line1: '100 Queen Street', city: 'Toronto', province: 'ON', postalCode: 'M5H 2N2', country: 'CA' },
      createdById: 'manager-1', assignedAt: null, acceptedAt: null, pickedUpAt: null, inTransitAt: null,
      deliveredAt: null, terminalAt: null, archivedAt: null, archivedById: null, createdAt: now, updatedAt: now,
    },
    assignment: null as any,
    activeOtherAssignment: false,
    block: null as any,
    sequence: 0,
  };

  const orderUpdate = vi.fn();
  const jobUpdate = vi.fn();
  const paymentUpdate = vi.fn();
  let queue = Promise.resolve();

  const db: any = {
    $transaction(operation: (tx: any) => Promise<any>) {
      const result = queue.then(() => operation(db));
      queue = result.then(() => undefined, () => undefined);
      return result;
    },
    company: {
      findUnique: vi.fn(async ({ where }: any) => where.id === state.workspace.id ? state.workspace : null),
      findFirst: vi.fn(async () => null),
      update: vi.fn(),
    },
    companyUser: {
      findUnique: vi.fn(async ({ where }: any) => {
        const key = where.companyId_userId;
        if (key.companyId === 'ws-1' && key.userId === 'driver-user-1') return { userId: key.userId, role: 'staff' };
        return null;
      }),
    },
    user: {
      findUnique: vi.fn(async ({ where }: any) => where.id === 'driver-user-1' ? { status: 'active', avatarUrl: '/driver.jpg' } : null),
    },
    kycPersonalSubmission: {
      findFirst: vi.fn(async ({ where }: any) => where.userId === 'driver-user-1' ? { id: 'kyc-1' } : null),
    },
    businessDriver: {
      findFirst: vi.fn(async ({ where }: any) => {
        if (where.id !== state.driver.id || where.companyId !== state.driver.companyId) return null;
        return state.driver;
      }),
    },
    driverCompensationTermVersion: {
      findFirst: vi.fn(async ({ where }: any) => where.id === state.term.id ? state.term : null),
    },
    schedule: { findFirst: vi.fn(async () => ({ id: 'window-1' })) },
    staffSlotBlock: {
      findFirst: vi.fn(async () => null),
      create: vi.fn(async ({ data }: any) => {
        state.block = { id: 'block-1', ...data };
        return state.block;
      }),
      deleteMany: vi.fn(async () => { state.block = null; return { count: 1 }; }),
    },
    fulfillment: {
      findFirst: vi.fn(async ({ where, include }: any) => {
        if (where.id !== state.fulfillment.id || where.workspaceId !== state.fulfillment.workspaceId) return null;
        return { ...state.fulfillment, ...(include?.currentAssignment ? { currentAssignment: state.assignment } : {}) };
      }),
      updateMany: vi.fn(async ({ where, data }: any) => {
        if (where.id !== state.fulfillment.id || where.version !== state.fulfillment.version) return { count: 0 };
        if (where.currentAssignmentId !== undefined && where.currentAssignmentId !== state.fulfillment.currentAssignmentId) return { count: 0 };
        Object.assign(state.fulfillment, data, { version: state.fulfillment.version + 1, updatedAt: now });
        delete state.fulfillment.version.increment;
        return { count: 1 };
      }),
    },
    deliveryAssignment: {
      create: vi.fn(async ({ data }: any) => {
        state.sequence += 1;
        state.assignment = {
          id: `assignment-${state.sequence}`, ...data, status: 'offered', version: 1,
          respondedAt: null, respondedById: null, outcomeById: null, staffSlotBlockId: null,
          completedAt: null, failedAt: null, cancelledAt: null, revokedAt: null, reservationReleasedAt: null,
          reasonCode: null, createdAt: now, updatedAt: now,
        };
        return state.assignment;
      }),
      findFirst: vi.fn(async ({ where }: any) => {
        if (where.businessDriver?.userId === state.driver.userId && state.activeOtherAssignment) return { id: 'assignment-other' };
        if (!state.assignment || where.id !== state.assignment.id || where.businessDriver?.userId !== 'driver-user-1') return null;
        return {
          ...state.assignment,
          businessDriver: { ...state.driver, company: { deliveryOperationsEnabled: true } },
          fulfillment: { ...state.fulfillment },
        };
      }),
      updateMany: vi.fn(async ({ where, data }: any) => {
        if (!state.assignment || where.id !== state.assignment.id || where.version !== state.assignment.version) return { count: 0 };
        if (where.status && where.status !== state.assignment.status) return { count: 0 };
        Object.assign(state.assignment, data, { version: state.assignment.version + 1, updatedAt: now });
        return { count: 1 };
      }),
      update: vi.fn(async ({ where, data }: any) => {
        if (!state.assignment || where.id !== state.assignment.id) throw new Error('missing assignment');
        Object.assign(state.assignment, data);
        if (data.version?.increment) state.assignment.version += data.version.increment;
        return state.assignment;
      }),
      findMany: vi.fn(async () => []),
    },
    notification: { create: vi.fn(async ({ data }: any) => ({ id: 'notification-1', ...data })) },
    auditLog: { create: vi.fn(async ({ data }: any) => ({ id: 'audit-1', ...data })) },
    order: { update: orderUpdate },
    jobRecord: { update: jobUpdate },
    payment: { update: paymentUpdate },
  };

  const hydrateDriverAssignment = () => ({
    ...state.assignment,
    compensationTerm: state.term,
    businessDriver: { ...state.driver, company: { id: 'ws-1', name: 'Bakery', logoUrl: null } },
    fulfillment: {
      ...state.fulfillment,
      order: { id: 'order-1', status: 'paid', description: 'Cake delivery', serviceCatalog: { id: 'service-1', name: 'Cake', category: 'food' } },
    },
  });
  db.deliveryAssignment.findFirst.mockImplementation(async ({ where }: any) => {
    if (where.businessDriver?.userId === state.driver.userId && state.activeOtherAssignment) return { id: 'assignment-other' };
    if (!state.assignment || where.id !== state.assignment.id || where.businessDriver?.userId !== 'driver-user-1') return null;
    if (where.businessDriver?.company?.deliveryOperationsEnabled) return hydrateDriverAssignment();
    return {
      ...state.assignment,
      businessDriver: { ...state.driver, company: { deliveryOperationsEnabled: true } },
      fulfillment: { ...state.fulfillment },
    };
  });

  return { db: db as PrismaClient, state, orderUpdate, jobUpdate, paymentUpdate };
}

describe('DeliveryService transactional assignment commands', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lets exactly one of two concurrent dispatchers win the same version', async () => {
    const { db, state } = createFakeDb();
    const service = new DeliveryService(db, () => now);
    const command = () => service.offerAssignment('manager-1', 'ws-1', 'fulfillment-1', {
      businessDriverId: 'driver-1', expectedVersion: 1,
    });
    const results = await Promise.allSettled([command(), command()]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const rejection = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
    expect(rejection?.reason).toMatchObject({ code: 'VERSION_CONFLICT', status: 409 });
    expect(state.sequence).toBe(1);
    expect(state.fulfillment.version).toBe(2);
  });

  it('enforces stale versions and workspace authorization without foreign disclosure', async () => {
    const { db } = createFakeDb();
    const service = new DeliveryService(db, () => now);
    await expect(service.offerAssignment('manager-1', 'ws-1', 'fulfillment-1', {
      businessDriverId: 'driver-1', expectedVersion: 99,
    })).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });
    await expect(service.getFulfillmentForManager('outsider', 'ws-1', 'fulfillment-1'))
      .rejects.toMatchObject({ code: 'FORBIDDEN', status: 403 });
    await expect(service.getFulfillmentForManager('manager-1', 'ws-1', 'foreign-id'))
      .rejects.toMatchObject({ code: 'NOT_FOUND', status: 404, message: 'Resource not found' });
  });

  it('redacts before acceptance, reveals after acceptance, and never mutates commerce state', async () => {
    const { db, state, orderUpdate, jobUpdate, paymentUpdate } = createFakeDb();
    const service = new DeliveryService(db, () => now);
    const offered = await service.offerAssignment('manager-1', 'ws-1', 'fulfillment-1', {
      businessDriverId: 'driver-1', expectedVersion: 1,
      plannedStartAt: '2026-09-11T13:00:00.000Z', plannedEndAt: '2026-09-11T14:00:00.000Z',
    });
    const redacted = await service.getAssignmentForSelf('driver-user-1', offered.id);
    expect(redacted.fulfillment.addressPrecision).toBe('city_province');
    expect(redacted.fulfillment.dropoffAddress).not.toHaveProperty('line1');

    const accepted = await service.respondAssignment('driver-user-1', offered.id, {
      action: 'accept', expectedAssignmentVersion: 1, expectedFulfillmentVersion: 2,
    });
    expect(accepted.fulfillment.addressPrecision).toBe('precise');
    expect(accepted.fulfillment.dropoffAddress).not.toHaveProperty('phone');
    expect(accepted.fulfillment.dropoffAddress).not.toHaveProperty('email');

    await service.transitionAssignment('driver-user-1', offered.id, {
      action: 'pick_up', expectedAssignmentVersion: 2, expectedFulfillmentVersion: 3,
    });
    await service.transitionAssignment('driver-user-1', offered.id, {
      action: 'start_transit', expectedAssignmentVersion: 3, expectedFulfillmentVersion: 4,
    });
    const delivered = await service.transitionAssignment('driver-user-1', offered.id, {
      action: 'deliver', expectedAssignmentVersion: 4, expectedFulfillmentVersion: 5,
    });
    expect(delivered.fulfillment.status).toBe('delivered');
    expect(state.assignment.status).toBe('completed');
    expect(state.block).toBeNull();
    expect(orderUpdate).not.toHaveBeenCalled();
    expect(jobUpdate).not.toHaveBeenCalled();
    expect(paymentUpdate).not.toHaveBeenCalled();
  });

  it('rejects assignment to an inactive driver', async () => {
    const { db, state } = createFakeDb();
    state.driver.status = 'paused';
    const service = new DeliveryService(db, () => now);
    await expect(service.offerAssignment('manager-1', 'ws-1', 'fulfillment-1', {
      businessDriverId: 'driver-1', expectedVersion: 1,
    })).rejects.toBeInstanceOf(DeliveryError);
  });

  it('rechecks offline presence and existing active work before dispatch', async () => {
    const offline = createFakeDb();
    offline.state.driver.presence = 'offline';
    await expect(new DeliveryService(offline.db, () => now).offerAssignment('manager-1', 'ws-1', 'fulfillment-1', {
      businessDriverId: 'driver-1', expectedVersion: 1,
    })).rejects.toMatchObject({ code: 'DRIVER_NOT_ELIGIBLE', status: 409 });

    const busy = createFakeDb();
    busy.state.activeOtherAssignment = true;
    await expect(new DeliveryService(busy.db, () => now).offerAssignment('manager-1', 'ws-1', 'fulfillment-1', {
      businessDriverId: 'driver-1', expectedVersion: 1,
    })).rejects.toMatchObject({ code: 'SLOT_CONFLICT', status: 409 });
    expect(busy.db.deliveryAssignment.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ businessDriver: { userId: 'driver-user-1' } }),
    }));
  });

  it('lets exactly one concurrent driver transition advance the aggregate', async () => {
    const { db } = createFakeDb();
    const service = new DeliveryService(db, () => now);
    const offered = await service.offerAssignment('manager-1', 'ws-1', 'fulfillment-1', {
      businessDriverId: 'driver-1', expectedVersion: 1,
    });
    await service.respondAssignment('driver-user-1', offered.id, {
      action: 'accept', expectedAssignmentVersion: 1, expectedFulfillmentVersion: 2,
    });
    const transition = () => service.transitionAssignment('driver-user-1', offered.id, {
      action: 'pick_up', expectedAssignmentVersion: 2, expectedFulfillmentVersion: 3,
    });
    const results = await Promise.allSettled([transition(), transition()]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const rejection = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
    expect(rejection?.reason).toMatchObject({ code: 'VERSION_CONFLICT' });
  });
});
