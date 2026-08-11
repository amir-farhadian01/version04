import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../lib/db.js';
import { authenticate } from '../lib/auth.middleware.js';

const router = Router();

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

const BlockSlotSchema = z.object({
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  reason: z.string().max(200).optional().default('manual'),
  orderId: z.string().optional(),
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseISODate(s: string): Date {
  const d = new Date(s);
  if (isNaN(d.getTime())) throw new Error(`Invalid date: ${s}`);
  return d;
}

// ─── Routes ──────────────────────────────────────────────────────────────────

/**
 * GET /api/staff/:staffId/availability
 * Returns unified availability for a staff member across ALL workspaces.
 * Query: ?from=ISO8601&to=ISO8601
 */
router.get(
  '/:staffId/availability',
  authenticate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { staffId } = req.params as { staffId: string };
      const { from, to } = req.query as Record<string, string>;

      if (!from || !to) {
        res.status(400).json({ code: 'MISSING_PARAMS', message: 'from and to query params are required (ISO 8601)' });
        return;
      }

      const fromDate = parseISODate(from);
      const toDate = parseISODate(to);

      // Security: user can only view their own availability, or workspace member can view their staff
      const requestingUserId = (req as unknown as { user: { id: string } }).user?.id;
      const isSelf = requestingUserId === staffId;
      if (!isSelf) {
        // Check if requester shares any workspace with the staff member
        const staffWorkspaces = await prisma.companyUser.findMany({ where: { userId: staffId }, select: { companyId: true } });
        const companyIds = staffWorkspaces.map((w) => w.companyId);
        const sharedWorkspace = await prisma.companyUser.findFirst({
          where: { userId: requestingUserId, companyId: { in: companyIds } },
        });
        if (!sharedWorkspace) {
          res.status(403).json({ code: 'FORBIDDEN', message: 'Not authorized to view this staff availability' });
          return;
        }
      }

      // Get all slot blocks in range
      const blockedSlots = await prisma.staffSlotBlock.findMany({
        where: {
          staffId,
          startAt: { lt: toDate },
          endAt: { gt: fromDate },
        },
        include: {
          workspace: { select: { id: true, name: true, logoUrl: true } },
        },
        orderBy: { startAt: 'asc' },
      });

      // Get all workspaces this staff belongs to
      const workspaces = await prisma.companyUser.findMany({
        where: { userId: staffId },
        include: { company: { select: { id: true, name: true, logoUrl: true } } },
      });

      res.json({
        data: {
          staffId,
          from: fromDate.toISOString(),
          to: toDate.toISOString(),
          blockedSlots: blockedSlots.map((b) => ({
            id: b.id,
            startAt: b.startAt,
            endAt: b.endAt,
            reason: b.reason,
            orderId: b.orderId,
            workspace: b.workspace,
          })),
          workspaces: workspaces.map((w) => ({
            id: w.company.id,
            name: w.company.name,
            logoUrl: w.company.logoUrl,
            role: w.role,
          })),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/workspaces/:workspaceId/staff/:staffId/block-slot
 * Manually block a time slot for a staff member.
 */
router.post(
  '/workspaces/:workspaceId/staff/:staffId/block-slot',
  authenticate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { workspaceId, staffId } = req.params as { workspaceId: string; staffId: string };
      const requestingUserId = (req as unknown as { user: { id: string } }).user?.id;
      const input = BlockSlotSchema.parse(req.body);

      // Verify requester belongs to workspace
      const requesterMember = await prisma.companyUser.findUnique({
        where: { companyId_userId: { companyId: workspaceId, userId: requestingUserId } },
      });
      if (!requesterMember || !['owner', 'admin', 'member'].includes(requesterMember.role)) {
        res.status(403).json({ code: 'FORBIDDEN', message: 'Not authorized in this workspace' });
        return;
      }

      // Verify staff belongs to workspace
      const staffMember = await prisma.companyUser.findUnique({
        where: { companyId_userId: { companyId: workspaceId, userId: staffId } },
      });
      if (!staffMember) {
        res.status(400).json({ code: 'STAFF_NOT_FOUND', message: 'Staff member not in this workspace' });
        return;
      }

      const startAt = parseISODate(input.startAt);
      const endAt = parseISODate(input.endAt);

      if (startAt >= endAt) {
        res.status(400).json({ code: 'INVALID_RANGE', message: 'startAt must be before endAt' });
        return;
      }

      // Check for overlapping blocks in ANY workspace
      const overlap = await prisma.staffSlotBlock.findFirst({
        where: {
          staffId,
          startAt: { lt: endAt },
          endAt: { gt: startAt },
        },
        include: { workspace: { select: { name: true } } },
      });

      if (overlap) {
        res.status(409).json({
          code: 'SLOT_CONFLICT',
          message: `Staff member already has a slot block from ${overlap.startAt.toISOString()} to ${overlap.endAt.toISOString()} in workspace: ${overlap.workspace.name}`,
        });
        return;
      }

      const block = await prisma.staffSlotBlock.create({
        data: {
          staffId,
          workspaceId,
          startAt,
          endAt,
          reason: input.reason,
          orderId: input.orderId,
        },
      });

      res.status(201).json({ data: block });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/workspaces/:workspaceId/staff/:staffId/block-slot/:blockId
 * Release a manually blocked slot.
 */
router.delete(
  '/workspaces/:workspaceId/staff/:staffId/block-slot/:blockId',
  authenticate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { workspaceId, staffId, blockId } = req.params as { workspaceId: string; staffId: string; blockId: string };
      const requestingUserId = (req as unknown as { user: { id: string } }).user?.id;

      // Verify requester belongs to workspace
      const requesterMember = await prisma.companyUser.findUnique({
        where: { companyId_userId: { companyId: workspaceId, userId: requestingUserId } },
      });
      if (!requesterMember) {
        res.status(403).json({ code: 'FORBIDDEN', message: 'Not authorized in this workspace' });
        return;
      }

      const block = await prisma.staffSlotBlock.findUnique({ where: { id: blockId } });
      if (!block || block.staffId !== staffId || block.workspaceId !== workspaceId) {
        res.status(404).json({ code: 'NOT_FOUND', message: 'Block not found' });
        return;
      }

      // Only allow deleting manual blocks (not order-related ones)
      if (block.orderId) {
        res.status(409).json({
          code: 'CANNOT_DELETE_ORDER_BLOCK',
          message: 'Cannot manually delete a slot block linked to an order. Cancel the order instead.',
        });
        return;
      }

      await prisma.staffSlotBlock.delete({ where: { id: blockId } });
      res.json({ data: { deleted: true } });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/workspaces/:workspaceId/staff-conflicts
 * List staff members with scheduling conflicts in this workspace.
 */
router.get(
  '/workspaces/:workspaceId/staff-conflicts',
  authenticate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { workspaceId } = req.params as { workspaceId: string };
      const requestingUserId = (req as unknown as { user: { id: string } }).user?.id;

      const member = await prisma.companyUser.findUnique({
        where: { companyId_userId: { companyId: workspaceId, userId: requestingUserId } },
      });
      if (!member) {
        res.status(403).json({ code: 'FORBIDDEN', message: 'Not a member of this workspace' });
        return;
      }

      // Find all staff in this workspace
      const staff = await prisma.companyUser.findMany({
        where: { companyId: workspaceId },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        },
      });

      const now = new Date();
      const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      // For each staff member, get blocks from OTHER workspaces
      const conflicts = await Promise.all(
        staff.map(async (s) => {
          const otherWorkspaceBlocks = await prisma.staffSlotBlock.findMany({
            where: {
              staffId: s.userId,
              workspaceId: { not: workspaceId },
              startAt: { lt: nextWeek },
              endAt: { gt: now },
            },
            include: { workspace: { select: { id: true, name: true } } },
            orderBy: { startAt: 'asc' },
          });
          return {
            staff: s.user,
            conflictCount: otherWorkspaceBlocks.length,
            nextConflict: otherWorkspaceBlocks[0] ?? null,
          };
        })
      );

      res.json({ data: conflicts.filter((c) => c.conflictCount > 0) });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
