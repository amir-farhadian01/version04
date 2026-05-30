import { Router, Response } from 'express';
import prisma from '../lib/db.js';
import { authenticate, AuthRequest } from '../lib/auth.middleware.js';

const router = Router();

/**
 * Verify the requesting user is owner or admin of the workspace.
 */
async function verifyWorkspaceAccess(
  req: AuthRequest,
  workspaceId: string,
): Promise<{ allowed: boolean; error?: { status: number; message: string } }> {
  const company = await prisma.company.findUnique({
    where: { id: workspaceId },
    select: { id: true, ownerId: true },
  });

  if (!company) {
    return { allowed: false, error: { status: 404, message: 'Workspace not found' } };
  }

  const isOwner = company.ownerId === req.user!.userId;
  const isAdmin = ['platform_admin', 'owner', 'support', 'finance'].includes(req.user!.role);

  if (!isOwner && !isAdmin) {
    // Check if user is an admin of the company
    const membership = await prisma.companyUser.findUnique({
      where: { companyId_userId: { companyId: workspaceId, userId: req.user!.userId } },
    });
    if (!membership || membership.role !== 'admin') {
      return { allowed: false, error: { status: 403, message: 'Forbidden' } };
    }
  }

  return { allowed: true };
}

// GET /api/staff/:workspaceId — List staff with profiles, roles, assignments
router.get('/:workspaceId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId } = req.params;

    const access = await verifyWorkspaceAccess(req, workspaceId);
    if (!access.allowed) {
      return res.status(access.error!.status).json({ error: access.error!.message });
    }

    const members = await prisma.companyUser.findMany({
      where: { companyId: workspaceId },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            email: true,
            phone: true,
            bio: true,
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });

    // Get staff assignment counts
    const staffIds = members.map((m) => m.user.id);
    const assignments = await prisma.packageStaffAssignment.findMany({
      where: { staffId: { in: staffIds } },
      select: { staffId: true, packageId: true },
    });

    const assignmentMap = new Map<string, string[]>();
    for (const a of assignments) {
      const list = assignmentMap.get(a.staffId) ?? [];
      list.push(a.packageId);
      assignmentMap.set(a.staffId, list);
    }

    // Get upcoming appointment counts
    const now = new Date();
    const upcomingOrders = await prisma.order.groupBy({
      by: ['assignedStaffId'],
      where: {
        assignedStaffId: { in: staffIds },
        status: { in: ['contracted', 'paid', 'in_progress'] },
        scheduledAt: { gte: now },
      },
      _count: true,
    });
    const upcomingMap = new Map(upcomingOrders.map((o) => [o.assignedStaffId, o._count]));

    const staff = members.map((m) => ({
      id: m.user.id,
      displayName: m.user.displayName,
      firstName: m.user.firstName,
      lastName: m.user.lastName,
      avatarUrl: m.user.avatarUrl,
      email: m.user.email,
      phone: m.user.phone,
      bio: m.user.bio,
      role: m.role,
      staffRole: (m as any).staffRole ?? null,
      isActive: true, // Will be enhanced with active status tracking
      assignedServices: assignmentMap.get(m.user.id) ?? [],
      upcomingAppointments: upcomingMap.get(m.user.id) ?? 0,
      joinedAt: m.joinedAt,
    }));

    res.json({ staff });
  } catch (err: unknown) {
    console.error(err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
  }
});

// POST /api/staff/:workspaceId/invite — Invite a user to join as staff
router.post('/:workspaceId/invite', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId } = req.params;
    const { userId, role, staffRole } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'Missing userId' });
    }

    const access = await verifyWorkspaceAccess(req, workspaceId);
    if (!access.allowed) {
      return res.status(access.error!.status).json({ error: access.error!.message });
    }

    // Check if user exists
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if already a member
    const existing = await prisma.companyUser.findUnique({
      where: { companyId_userId: { companyId: workspaceId, userId } },
    });
    if (existing) {
      return res.status(409).json({ error: 'User is already a member of this workspace' });
    }

    const member = await prisma.companyUser.create({
      data: {
        companyId: workspaceId,
        userId,
        role: role || 'staff',
        staffRole: staffRole ?? null,
      },
    });

    // Update user's companyId if not set
    if (!user.companyId) {
      await prisma.user.update({
        where: { id: userId },
        data: { companyId: workspaceId },
      });
    }

    res.status(201).json({ success: true, member });
  } catch (err: unknown) {
    console.error(err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
  }
});

// PUT /api/staff/:workspaceId/:userId — Update staff role, permissions
router.put('/:workspaceId/:userId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId, userId } = req.params;
    const { role, staffRole } = req.body;

    const access = await verifyWorkspaceAccess(req, workspaceId);
    if (!access.allowed) {
      return res.status(access.error!.status).json({ error: access.error!.message });
    }

    const existing = await prisma.companyUser.findUnique({
      where: { companyId_userId: { companyId: workspaceId, userId } },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    const updated = await prisma.companyUser.update({
      where: { companyId_userId: { companyId: workspaceId, userId } },
      data: {
        ...(role !== undefined && { role }),
        ...(staffRole !== undefined && { staffRole }),
      },
    });

    res.json({ success: true, member: updated });
  } catch (err: unknown) {
    console.error(err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
  }
});

// DELETE /api/staff/:workspaceId/:userId — Remove staff member
router.delete('/:workspaceId/:userId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId, userId } = req.params;

    const access = await verifyWorkspaceAccess(req, workspaceId);
    if (!access.allowed) {
      return res.status(access.error!.status).json({ error: access.error!.message });
    }

    // Cannot remove the owner
    const company = await prisma.company.findUnique({
      where: { id: workspaceId },
      select: { ownerId: true },
    });
    if (company?.ownerId === userId) {
      return res.status(400).json({ error: 'Cannot remove the workspace owner' });
    }

    // Remove staff assignments first
    await prisma.packageStaffAssignment.deleteMany({
      where: { staffId: userId, package: { workspaceId } },
    });

    await prisma.companyUser.delete({
      where: { companyId_userId: { companyId: workspaceId, userId } },
    });

    res.json({ success: true });
  } catch (err: unknown) {
    console.error(err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
  }
});

// PUT /api/staff/:workspaceId/:userId/activate — Toggle active status
router.put('/:workspaceId/:userId/activate', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId, userId } = req.params;
    const { isActive } = req.body;

    const access = await verifyWorkspaceAccess(req, workspaceId);
    if (!access.allowed) {
      return res.status(access.error!.status).json({ error: access.error!.message });
    }

    // For now, we use Schedule isActive as a proxy for staff active status
    // In the future, this could be a dedicated field on CompanyUser
    const existing = await prisma.companyUser.findUnique({
      where: { companyId_userId: { companyId: workspaceId, userId } },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    // Update all schedule entries for this staff member
    if (isActive !== undefined) {
      await prisma.schedule.updateMany({
        where: { companyId: workspaceId, staffId: userId },
        data: { isActive },
      });
    }

    res.json({ success: true, isActive });
  } catch (err: unknown) {
    console.error(err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
  }
});

// GET /api/staff/:workspaceId/availability/:staffId — Get staff availability for a date range
router.get('/:workspaceId/availability/:staffId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId, staffId } = req.params;
    const { startDate, endDate } = req.query as Record<string, string>;

    const access = await verifyWorkspaceAccess(req, workspaceId);
    if (!access.allowed) {
      return res.status(access.error!.status).json({ error: access.error!.message });
    }

    const where: Record<string, unknown> = {
      companyId: workspaceId,
      staffId,
      isActive: true,
    };

    if (startDate) {
      where.startTime = { gte: new Date(startDate) };
    }
    if (endDate) {
      where.endTime = { lte: new Date(endDate) };
    }

    const schedules = await prisma.schedule.findMany({
      where,
      orderBy: { startTime: 'asc' },
    });

    res.json({ schedules });
  } catch (err: unknown) {
    console.error(err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
  }
});

export default router;
