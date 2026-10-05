import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';

vi.mock('../bus.js', () => ({ publish: vi.fn().mockResolvedValue(undefined) }));

import { DeliveryService } from './service.js';

const now = new Date('2026-09-11T12:00:00.000Z');

function compensationDb() {
  const state: any = {
    workspace: { id: 'ws-1', ownerId: 'manager-1', name: 'Bakery', deliveryOperationsEnabled: true },
    driver: {
      id: 'driver-1', companyId: 'ws-1', userId: 'driver-user-1', engagementType: 'long_term', status: 'active',
      availabilityMode: 'scheduled', presence: 'offline', version: 5, currentAcceptedTermId: 'term-1', archivedAt: null,
    },
    terms: [{
      id: 'term-1', businessDriverId: 'driver-1', versionNumber: 1, schemaVersion: 1, currency: 'CAD',
      components: [{ type: 'fixed_salary', amountCents: 400_000, frequency: 'monthly' }], status: 'accepted',
      proposedById: 'manager-1', acceptedById: 'driver-user-1', proposedAt: now, acceptedAt: now,
      rejectedAt: null, supersededAt: null, createdAt: now,
    }],
  };
  const termUpdates: any[] = [];
  const db: any = {
    $transaction: (operation: (tx: any) => Promise<any>) => operation(db),
    company: { findUnique: vi.fn(async ({ where }: any) => where.id === 'ws-1' ? state.workspace : null) },
    companyUser: { findUnique: vi.fn(async () => null) },
    businessDriver: {
      findFirst: vi.fn(async ({ where, include }: any) => {
        if (where.id !== state.driver.id) return null;
        return include ? { ...state.driver, company: state.workspace, currentAcceptedTerm: state.terms.find((term: any) => term.id === state.driver.currentAcceptedTermId) } : state.driver;
      }),
      updateMany: vi.fn(async ({ where, data }: any) => {
        if (where.version !== state.driver.version) return { count: 0 };
        if (data.currentAcceptedTermId) state.driver.currentAcceptedTermId = data.currentAcceptedTermId;
        state.driver.version += 1;
        return { count: 1 };
      }),
      findUniqueOrThrow: vi.fn(async () => ({
        ...state.driver,
        currentAcceptedTerm: state.terms.find((term: any) => term.id === state.driver.currentAcceptedTermId),
      })),
    },
    driverCompensationTermVersion: {
      findFirst: vi.fn(async ({ where, orderBy }: any) => {
        if (orderBy) return [...state.terms].sort((a, b) => b.versionNumber - a.versionNumber)[0] ?? null;
        return state.terms.find((term: any) => term.id === where.id && term.businessDriverId === where.businessDriverId) ?? null;
      }),
      updateMany: vi.fn(async ({ where, data }: any) => {
        termUpdates.push(data);
        let count = 0;
        for (const term of state.terms) {
          const matchesId = where.id === undefined || term.id === where.id;
          const matchesDriver = where.businessDriverId === undefined || term.businessDriverId === where.businessDriverId;
          const matchesStatus = where.status === undefined || term.status === where.status;
          if (matchesId && matchesDriver && matchesStatus) { Object.assign(term, data); count += 1; }
        }
        return { count };
      }),
      create: vi.fn(async ({ data }: any) => {
        const term = { id: `term-${data.versionNumber}`, ...data, status: 'proposed', acceptedById: null, acceptedAt: null, rejectedAt: null, supersededAt: null, createdAt: now };
        state.terms.push(term);
        return term;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        termUpdates.push(data);
        const term = state.terms.find((item: any) => item.id === where.id);
        Object.assign(term, data);
        return term;
      }),
    },
    notification: { create: vi.fn(async () => ({ id: 'notification-1' })) },
    auditLog: { create: vi.fn(async () => ({ id: 'audit-1' })) },
  };
  return { db: db as PrismaClient, state, termUpdates };
}

describe('immutable driver compensation revisions', () => {
  it('keeps accepted terms effective until the driver accepts a new version', async () => {
    const { db, state, termUpdates } = compensationDb();
    const service = new DeliveryService(db, () => now);
    const proposed = await service.proposeTerms('manager-1', 'ws-1', 'driver-1', {
      currency: 'CAD', schemaVersion: 1, components: [{ type: 'per_delivery', amountCents: 1500 }],
    });
    expect(proposed.versionNumber).toBe(2);
    expect(proposed.status).toBe('proposed');
    expect(state.driver.currentAcceptedTermId).toBe('term-1');
    expect(state.terms[0].status).toBe('accepted');

    await service.respondTerms('driver-user-1', 'driver-1', proposed.id, { action: 'accept', expectedDriverVersion: 5 });
    expect(state.driver.currentAcceptedTermId).toBe('term-2');
    expect(state.terms[0].status).toBe('superseded');
    expect(state.terms[1].status).toBe('accepted');
    expect(state.terms[1].components).toEqual([{ type: 'per_delivery', amountCents: 1500 }]);
    expect(termUpdates.every((update) => update.components === undefined && update.currency === undefined)).toBe(true);
  });

  it('rejecting a future revision leaves the current accepted version effective', async () => {
    const { db, state } = compensationDb();
    const service = new DeliveryService(db, () => now);
    const proposed = await service.proposeTerms('manager-1', 'ws-1', 'driver-1', {
      currency: 'CAD', schemaVersion: 1, components: [{ type: 'hourly', amountCents: 3000 }],
    });
    await service.respondTerms('driver-user-1', 'driver-1', proposed.id, { action: 'reject', expectedDriverVersion: 5 });
    expect(state.driver.currentAcceptedTermId).toBe('term-1');
    expect(state.terms[0].status).toBe('accepted');
    expect(state.terms[1].status).toBe('rejected');
  });
});
