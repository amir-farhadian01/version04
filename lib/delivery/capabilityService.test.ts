import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';

vi.mock('../bus.js', () => ({ publish: vi.fn().mockResolvedValue(undefined) }));

import { DeliveryService } from './service.js';

function capabilityDb(activeFulfillments: number) {
  const db: any = {
    $transaction: (operation: (tx: any) => Promise<unknown>) => operation(db),
    company: {
      findUnique: vi.fn().mockResolvedValue({ id: 'ws-1', deliveryOperationsEnabled: true }),
      update: vi.fn().mockResolvedValue({ id: 'ws-1', deliveryOperationsEnabled: false }),
    },
    fulfillment: { count: vi.fn().mockResolvedValue(activeFulfillments) },
    auditLog: { create: vi.fn().mockResolvedValue({ id: 'audit-1' }) },
  };
  return db as PrismaClient;
}

describe('delivery capability guard', () => {
  it('allows only platform roles and refuses disablement with nonterminal work', async () => {
    const db = capabilityDb(1);
    const service = new DeliveryService(db, () => new Date('2026-09-12T00:00:00.000Z'));
    await expect(service.setWorkspaceCapability('support-1', 'support', 'ws-1', false))
      .rejects.toMatchObject({ code: 'FORBIDDEN', status: 403 });
    await expect(service.setWorkspaceCapability('owner-1', 'owner', 'ws-1', false))
      .rejects.toMatchObject({ code: 'ACTIVE_FULFILLMENTS_EXIST', status: 409 });
    expect(db.company.update).not.toHaveBeenCalled();
  });
});
