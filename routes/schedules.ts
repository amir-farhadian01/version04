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
    const membership = await prisma.companyUser.findUnique({
      where: { companyId_userId: { companyId: workspaceId, userId: req.user!.userId } },
    });
    if (!membership || (membership.role !== 'admin' && membership.role !== 'owner')) {
      return { allowed: false, error: { status: 403, message: 'Forbidden' } };
    }
  }

  return { allowed: true };
}

// GET /api/schedules/:workspaceId — List all schedules for a workspace
router.get('/:workspaceId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId } = req.params;
    const { startDate, endDate, staffId } = req.query as Record<string, string>;

    const access = await verifyWorkspaceAccess(req, workspaceId);
    if (!access.allowed) {
      return res.status(access.error!.status).json({ error: access.error!.message });
    }

    const where: Record<string, unknown> = { companyId: workspaceId };

    if (staffId) {
      where.staffId = staffId;
    }
    if (startDate) {
      where.startTime = { gte: new Date(startDate) };
    }
    if (endDate) {
      where.endTime = { lte: new Date(endDate) };
    }

    const schedules = await prisma.schedule.findMany({
      where,
      include: {
        staff: {
          select: {
            id: true,
            displayName: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: [{ startTime: 'asc' }],
    });

    res.json({ schedules });
  } catch (err: unknown) {
    console.error(err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
  }
});

// POST /api/schedules/:workspaceId — Create a schedule block
router.post('/:workspaceId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId } = req.params;
    const { staffId, startTime, endTime, taskId, status } = req.body;

    if (!staffId || !startTime || !endTime) {
      return res.status(400).json({ error: 'Missing required fields: staffId, startTime, endTime' });
    }

    const access = await verifyWorkspaceAccess(req, workspaceId);
    if (!access.allowed) {
      return res.status(access.error!.status).json({ error: access.error!.message });
    }

    const schedule = await prisma.schedule.create({
      data: {
        companyId: workspaceId,
        staffId,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        taskId: taskId ?? null,
        status: status ?? 'scheduled',
        isActive: true,
      },
      include: {
        staff: {
          select: {
            id: true,
            displayName: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
    });

    res.status(201).json(schedule);
  } catch (err: unknown) {
    console.error(err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
  }
});

// PUT /api/schedules/:workspaceId/:scheduleId — Update schedule block
router.put('/:workspaceId/:scheduleId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId, scheduleId } = req.params;
    const { startTime, endTime, taskId, status, isActive } = req.body;

    const access = await verifyWorkspaceAccess(req, workspaceId);
    if (!access.allowed) {
      return res.status(access.error!.status).json({ error: access.error!.message });
    }

    const existing = await prisma.schedule.findUnique({
      where: { id: scheduleId },
    });
    if (!existing || existing.companyId !== workspaceId) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    const updated = await prisma.schedule.update({
      where: { id: scheduleId },
      data: {
        ...(startTime !== undefined && { startTime: new Date(startTime) }),
        ...(endTime !== undefined && { endTime: new Date(endTime) }),
        ...(taskId !== undefined && { taskId }),
        ...(status !== undefined && { status }),
        ...(isActive !== undefined && { isActive }),
      },
      include: {
        staff: {
          select: {
            id: true,
            displayName: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
    });

    res.json(updated);
  } catch (err: unknown) {
    console.error(err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
  }
});

// DELETE /api/schedules/:workspaceId/:scheduleId — Delete schedule block
router.delete('/:workspaceId/:scheduleId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId, scheduleId } = req.params;

    const access = await verifyWorkspaceAccess(req, workspaceId);
    if (!access.allowed) {
      return res.status(access.error!.status).json({ error: access.error!.message });
    }

    const existing = await prisma.schedule.findUnique({
      where: { id: scheduleId },
    });
    if (!existing || existing.companyId !== workspaceId) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    await prisma.schedule.delete({ where: { id: scheduleId } });

    res.json({ success: true });
  } catch (err: unknown) {
    console.error(err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
  }
});

// GET /api/schedules/:workspaceId/slots — Calculate available slots for a date
// Query params: date (YYYY-MM-DD), packageId (optional — if omitted, returns all)
router.get('/:workspaceId/slots', async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId } = req.params;
    const { date, packageId } = req.query as Record<string, string>;

    if (!date) {
      return res.status(400).json({ error: 'Missing required query param: date' });
    }

    // Parse the date
    const targetDate = new Date(date + 'T00:00:00.000Z');
    const dayStart = new Date(targetDate);
    const dayEnd = new Date(targetDate);
    dayEnd.setDate(dayEnd.getDate() + 1);

    // If packageId is provided, calculate slots for that specific package
    if (packageId) {
      const slots = await calculateSlotsForPackage(workspaceId, packageId, dayStart, dayEnd);
      return res.json(slots);
    }

    // Otherwise, return all schedules for the day grouped by staff
    const schedules = await prisma.schedule.findMany({
      where: {
        companyId: workspaceId,
        isActive: true,
        startTime: { gte: dayStart },
        endTime: { lte: dayEnd },
      },
      include: {
        staff: {
          select: {
            id: true,
            displayName: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: [{ startTime: 'asc' }],
    });

    res.json({ date, schedules });
  } catch (err: unknown) {
    console.error(err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
  }
});

/**
 * Calculate available time slots for a specific package on a given date.
 */
async function calculateSlotsForPackage(
  workspaceId: string,
  packageId: string,
  dayStart: Date,
  dayEnd: Date,
): Promise<Record<string, unknown>> {
  // 1. Fetch the package with duration and break time
  const pkg = await prisma.providerServicePackage.findUnique({
    where: { id: packageId },
    select: {
      id: true,
      name: true,
      durationMinutes: true,
      breakTimeMinutes: true,
    },
  });

  if (!pkg) {
    return { error: 'Package not found' };
  }

  const durationMinutes = pkg.durationMinutes ?? 60;
  const breakTimeMinutes = pkg.breakTimeMinutes ?? 15;
  const slotDuration = durationMinutes + breakTimeMinutes;

  // 2. Fetch all staff assigned to this package
  const assignments = await prisma.packageStaffAssignment.findMany({
    where: { packageId },
    include: {
      staff: {
        select: {
          id: true,
          displayName: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
        },
      },
    },
  });

  if (assignments.length === 0) {
    return {
      date: dayStart.toISOString().slice(0, 10),
      packageId: pkg.id,
      packageName: pkg.name,
      durationMinutes,
      breakTimeMinutes,
      slots: [],
    };
  }

  const staffIds = assignments.map((a) => a.staff.id);

  // 3. Fetch all Schedule entries for these staff on the given date where isActive=true
  const schedules = await prisma.schedule.findMany({
    where: {
      companyId: workspaceId,
      staffId: { in: staffIds },
      isActive: true,
      startTime: { gte: dayStart },
      endTime: { lte: dayEnd },
    },
    orderBy: [{ staffId: 'asc' }, { startTime: 'asc' }],
  });

  // 4. Fetch all existing orders for this workspace on the given date
  const existingOrders = await prisma.order.findMany({
    where: {
      matchedWorkspaceId: workspaceId,
      scheduledAt: {
        gte: dayStart,
        lt: dayEnd,
      },
      status: {
        in: ['contracted', 'paid', 'in_progress'],
      },
    },
    select: {
      scheduledAt: true,
      assignedStaffId: true,
      matchedPackageId: true,
    },
  });

  // Build a set of booked slots: "staffId:HH:MM"
  const bookedSlots = new Set<string>();
  for (const order of existingOrders) {
    if (order.scheduledAt && order.assignedStaffId) {
      const h = order.scheduledAt.getUTCHours().toString().padStart(2, '0');
      const m = order.scheduledAt.getUTCMinutes().toString().padStart(2, '0');
      bookedSlots.add(`${order.assignedStaffId}:${h}:${m}`);
    }
  }

  // 5. For each staff member, calculate available slots
  const staffSlotMap = new Map<string, { id: string; displayName: string | null; firstName: string | null; lastName: string | null; avatarUrl: string | null }[]>();
  const slotStaffMap = new Map<string, Set<string>>(); // "HH:MM" -> Set of staff IDs

  for (const assignment of assignments) {
    const staffMember = assignment.staff;
    const staffSchedules = schedules.filter((s) => s.staffId === staffMember.id);

    for (const schedule of staffSchedules) {
      const startH = schedule.startTime.getUTCHours();
      const startM = schedule.startTime.getUTCMinutes();
      const endH = schedule.endTime.getUTCHours();
      const endM = schedule.endTime.getUTCMinutes();

      const scheduleStartMinutes = startH * 60 + startM;
      const scheduleEndMinutes = endH * 60 + endM;

      // Walk through the schedule in slotDuration steps
      for (let slotStart = scheduleStartMinutes; slotStart + durationMinutes <= scheduleEndMinutes; slotStart += slotDuration) {
        const slotH = Math.floor(slotStart / 60);
        const slotM = slotStart % 60;
        const timeKey = `${slotH.toString().padStart(2, '0')}:${slotM.toString().padStart(2, '0')}`;

        // Check if this slot is already booked for this staff
        if (bookedSlots.has(`${staffMember.id}:${timeKey}`)) {
          continue;
        }

        // Add to slot map
        if (!slotStaffMap.has(timeKey)) {
          slotStaffMap.set(timeKey, new Set());
        }
        slotStaffMap.get(timeKey)!.add(staffMember.id);

        // Add staff info
        if (!staffSlotMap.has(staffMember.id)) {
          staffSlotMap.set(staffMember.id, []);
        }
      }
    }
  }

  // 6. Build sorted slots array
  const sortedTimes = Array.from(slotStaffMap.keys()).sort();
  const slots = sortedTimes.map((timeKey) => {
    const staffIdsInSlot = Array.from(slotStaffMap.get(timeKey)!);
    const staffInfo = staffIdsInSlot.map((sid) => {
      const assignment = assignments.find((a) => a.staff.id === sid);
      if (!assignment) return null;
      return {
        id: assignment.staff.id,
        displayName: assignment.staff.displayName,
        firstName: assignment.staff.firstName,
        lastName: assignment.staff.lastName,
        avatarUrl: assignment.staff.avatarUrl,
      };
    }).filter(Boolean);

    const [h, m] = timeKey.split(':').map(Number);
    const endH = h + Math.floor((m + durationMinutes) / 60);
    const endM = (m + durationMinutes) % 60;

    return {
      startTime: timeKey,
      endTime: `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`,
      availableStaff: staffIdsInSlot.length,
      staff: staffInfo,
    };
  });

  return {
    date: dayStart.toISOString().slice(0, 10),
    packageId: pkg.id,
    packageName: pkg.name,
    durationMinutes,
    breakTimeMinutes,
    slots,
  };
}

export default router;
