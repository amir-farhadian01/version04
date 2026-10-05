import type { Prisma } from "@prisma/client";

/**
 * Admin frontend (AdminDashboard) expects the legacy audit-entry shape:
 * `{ entityType, entityId, performedById, details, createdAt, performedBy }`,
 * while the AuditLog table stores `resourceType/resourceId/timestamp/actor`.
 * Map once here so the API contract is explicit instead of leaking raw rows.
 */
export type AdminAuditLogRow = Prisma.AuditLogGetPayload<{
  include: { actor: { select: { id: true; displayName: true; email: true } } };
}>;

export interface AdminAuditLogEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  performedById: string | null;
  details: string | null;
  createdAt: string;
  performedBy?: { id: string; name: string; email: string };
}

export function toAuditLogEntry(row: AdminAuditLogRow): AdminAuditLogEntry {
  return {
    id: row.id,
    action: row.action,
    entityType: row.resourceType,
    entityId: row.resourceId,
    performedById: row.actorId,
    details: null,
    createdAt: row.timestamp.toISOString(),
    performedBy: row.actor
      ? {
          id: row.actor.id,
          name: row.actor.displayName ?? row.actor.email,
          email: row.actor.email,
        }
      : undefined,
  };
}

// Keep the exported surface minimal; the row type is derived from Prisma.
