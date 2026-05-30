import { BookingMode } from '@prisma/client';
import prisma from './db.js';

export type WorkspaceMemberRole = 'owner' | 'admin' | 'member' | 'staff' | 'client';

const MEMBER_ROLES: ReadonlySet<string> = new Set(['owner', 'admin', 'member', 'staff', 'client']);

function normalizeMemberRole(r: string): WorkspaceMemberRole {
  if (MEMBER_ROLES.has(r)) return r as WorkspaceMemberRole;
  return 'member';
}

export class WorkspaceAccessError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public body?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'WorkspaceAccessError';
  }
}

/**
 * Throws 403 unless the user is the company owner or has a
 * CompanyUser membership in this workspace.
 */
export async function assertWorkspaceMember(
  userId: string,
  workspaceId: string,
): Promise<{ role: WorkspaceMemberRole }> {
  const company = await prisma.company.findUnique({ where: { id: workspaceId } });
  if (!company) {
    throw new WorkspaceAccessError(404, 'Workspace not found');
  }
  if (company.ownerId === userId) {
    return { role: 'owner' };
  }
  const membership = await prisma.companyUser.findUnique({
    where: { companyId_userId: { companyId: workspaceId, userId } },
  });
  if (!membership) {
    throw new WorkspaceAccessError(403, 'Forbidden: not a member of this workspace');
  }
  return { role: normalizeMemberRole(membership.role) };
}

/**
 * Returns the list of workspaces (companies) the user can switch to:
 * the company they own + every CompanyUser membership.
 */
export async function listMyWorkspaces(userId: string): Promise<
  Array<{
    id: string;
    name: string;
    logoUrl: string | null;
    slug: string | null;
    role: string;
    isOwner: boolean;
  }>
> {
  const [owned, memberRows] = await Promise.all([
    prisma.company.findMany({ where: { ownerId: userId } }),
    prisma.companyUser.findMany({
      where: { userId },
      include: { company: true },
    }),
  ]);

  const byId = new Map<
    string,
    { id: string; name: string; logoUrl: string | null; slug: string | null; role: string; isOwner: boolean }
  >();

  for (const c of owned) {
    byId.set(c.id, {
      id: c.id,
      name: c.name,
      logoUrl: c.logoUrl,
      slug: c.slug,
      role: 'owner',
      isOwner: true,
    });
  }
  for (const row of memberRows) {
    const c = row.company;
    if (c.ownerId === userId) {
      if (!byId.has(c.id)) {
        byId.set(c.id, {
          id: c.id,
          name: c.name,
          logoUrl: c.logoUrl,
          slug: c.slug,
          role: 'owner',
          isOwner: true,
        });
      }
      continue;
    }
    if (byId.has(c.id)) {
      continue;
    }
    byId.set(c.id, {
      id: c.id,
      name: c.name,
      logoUrl: c.logoUrl,
      slug: c.slug,
      role: row.role,
      isOwner: false,
    });
  }

  return Array.from(byId.values());
}

const LOCKED_MODES = new Set<string>(['booking', 'direct_booking', 'hybrid', 'quote_first', 'walk_in']);

/**
 * When catalog.lockedBookingMode is set, package bookingMode must be
 * `inherit_from_catalog` or match the lock.
 */
export function assertBookingModeAllowedForCatalog(
  lockedBookingMode: string | null | undefined,
  bookingMode: BookingMode,
): void {
  if (lockedBookingMode == null || lockedBookingMode === '') {
    return;
  }
  if (!LOCKED_MODES.has(lockedBookingMode)) {
    return;
  }
  if (bookingMode === BookingMode.inherit_from_catalog) {
    return;
  }
  if (bookingMode === BookingMode.booking && lockedBookingMode === 'booking') {
    return;
  }
  if (bookingMode === BookingMode.direct_booking && lockedBookingMode === 'direct_booking') {
    return;
  }
  if (bookingMode === BookingMode.hybrid && lockedBookingMode === 'hybrid') {
    return;
  }
  if (bookingMode === BookingMode.quote_first && lockedBookingMode === 'quote_first') {
    return;
  }
  if (bookingMode === BookingMode.walk_in && lockedBookingMode === 'walk_in') {
    return;
  }
  throw new WorkspaceAccessError(400, 'bookingMode conflicts with service catalog lockedBookingMode', {
    error: 'bookingMode not allowed for this catalog',
    lockedBookingMode,
    bookingMode,
  });
}
