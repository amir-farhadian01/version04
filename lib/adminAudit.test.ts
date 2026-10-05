import { describe, expect, it } from 'vitest';
import { toAuditLogEntry, type AdminAuditLogRow } from './adminAudit.js';

function makeRow(overrides: Partial<AdminAuditLogRow> = {}): AdminAuditLogRow {
  return {
    id: 'audit_1',
    actorId: 'user_1',
    actor: { id: 'user_1', displayName: 'Owner Admin', email: 'owner@neighborly.local' },
    action: 'order.submit',
    resourceType: 'Order',
    resourceId: 'order_1',
    timestamp: new Date('2026-10-04T12:00:00.000Z'),
    metadata: { ip: '127.0.0.1' },
    ...overrides,
  } as AdminAuditLogRow;
}

describe('toAuditLogEntry', () => {
  it('maps timestamp → createdAt as ISO string so the UI never renders "Invalid Date"', () => {
    const entry = toAuditLogEntry(makeRow());
    expect(entry.createdAt).toBe('2026-10-04T12:00:00.000Z');
    expect(new Date(entry.createdAt).toString()).not.toBe('Invalid Date');
  });

  it('maps resourceType/resourceId → entityType/entityId and actor → performedBy', () => {
    const entry = toAuditLogEntry(makeRow());
    expect(entry.entityType).toBe('Order');
    expect(entry.entityId).toBe('order_1');
    expect(entry.performedById).toBe('user_1');
    expect(entry.performedBy).toEqual({
      id: 'user_1',
      name: 'Owner Admin',
      email: 'owner@neighborly.local',
    });
  });

  it('falls back to email as name when actor has no displayName', () => {
    const entry = toAuditLogEntry(
      makeRow({ actor: { id: 'user_2', displayName: null, email: 'x@y.local' } }),
    );
    expect(entry.performedBy?.name).toBe('x@y.local');
  });

  it('omits performedBy for system (actor-less) entries', () => {
    const entry = toAuditLogEntry(makeRow({ actorId: null, actor: null }));
    expect(entry.performedBy).toBeUndefined();
    expect(entry.createdAt).toBe('2026-10-04T12:00:00.000Z');
  });
});