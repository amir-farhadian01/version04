import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../lib/db.js';
import { authenticate } from '../lib/auth.middleware.js';

const router = Router();

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

const AssignSubcontractorSchema = z.object({
  subWorkspaceId: z.string().min(1),
  assignedStaffId: z.string().optional(),
  primeSharePercent: z.number().min(0).max(100).default(70),
  subSharePercent: z.number().min(0).max(100).default(30),
  notes: z.string().max(1000).optional(),
});

const RespondToAssignmentSchema = z.object({
  action: z.enum(['accept', 'reject']),
  rejectionReason: z.string().max(500).optional(),
  assignedStaffId: z.string().optional(),
});

// ─── Middleware: ensure user belongs to workspace ─────────────────────────────

async function requireWorkspaceMembership(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const workspaceId = req.params['workspaceId'];
  const userId = (req as unknown as { user: { id: string } }).user?.id;
  if (!userId || !workspaceId) {
    res.status(401).json({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
    return;
  }
  const member = await prisma.companyUser.findUnique({
    where: { companyId_userId: { companyId: workspaceId, userId } },
  });
  if (!member) {
    res.status(403).json({ code: 'FORBIDDEN', message: 'Not a member of this workspace' });
    return;
  }
  next();
}

// ─── Routes ──────────────────────────────────────────────────────────────────

/**
 * POST /api/workspaces/:workspaceId/orders/:orderId/subcontract
 * Prime assigns a matched order to an approved subcontractor workspace.
 */
router.post(
  '/:workspaceId/orders/:orderId/subcontract',
  authenticate,
  requireWorkspaceMembership,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { workspaceId, orderId } = req.params as { workspaceId: string; orderId: string };
      const input = AssignSubcontractorSchema.parse(req.body);

      if (Math.abs(input.primeSharePercent + input.subSharePercent - 100) > 0.01) {
        res.status(400).json({
          code: 'INVALID_SHARE_SPLIT',
          message: 'primeSharePercent + subSharePercent must equal 100',
        });
        return;
      }

      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { subcontractorAssignment: true },
      });
      if (!order) {
        res.status(404).json({ code: 'NOT_FOUND', message: 'Order not found' });
        return;
      }
      if (order.matchedWorkspaceId !== workspaceId) {
        res.status(403).json({ code: 'FORBIDDEN', message: 'This order is not matched to your workspace' });
        return;
      }
      if (!['matched', 'contracted', 'paid', 'in_progress'].includes(order.status)) {
        res.status(409).json({
          code: 'INVALID_ORDER_STATUS',
          message: `Cannot subcontract an order with status: ${order.status}`,
        });
        return;
      }
      if (order.subcontractorAssignment) {
        res.status(409).json({ code: 'ALREADY_SUBCONTRACTED', message: 'This order already has a subcontractor assignment' });
        return;
      }

      const b2bConnection = await prisma.b2BConnection.findFirst({
        where: {
          OR: [
            { providerAId: workspaceId, providerBId: input.subWorkspaceId },
            { providerAId: input.subWorkspaceId, providerBId: workspaceId },
          ],
          status: 'approved',
        },
      });
      if (!b2bConnection) {
        res.status(403).json({ code: 'NO_B2B_CONNECTION', message: 'No approved B2B connection with this subcontractor' });
        return;
      }

      if (input.assignedStaffId) {
        const staffMember = await prisma.companyUser.findUnique({
          where: { companyId_userId: { companyId: input.subWorkspaceId, userId: input.assignedStaffId } },
        });
        if (!staffMember) {
          res.status(400).json({ code: 'INVALID_STAFF', message: 'Assigned staff does not belong to subcontractor workspace' });
          return;
        }
      }

      const assignment = await prisma.subcontractorAssignment.create({
        data: {
          orderId,
          primeWorkspaceId: workspaceId,
          subWorkspaceId: input.subWorkspaceId,
          assignedStaffId: input.assignedStaffId,
          primeSharePercent: input.primeSharePercent,
          subSharePercent: input.subSharePercent,
          notes: input.notes,
          status: 'pending',
        },
        include: {
          subWorkspace: { select: { id: true, name: true, logoUrl: true, ownerId: true } },
          assignedStaff: { select: { id: true, firstName: true, lastName: true } },
        },
      });

      // Notify sub workspace owner
      await prisma.notification.create({
        data: {
          userId: assignment.subWorkspace.ownerId,
          title: 'New Subcontract Assignment',
          message: 'You have been assigned a job. Please review and respond.',
          type: 'system',
          link: `/workspace/subcontracts/${assignment.id}`,
        },
      });

      res.status(201).json({ data: assignment });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/workspaces/:workspaceId/subcontracts
 * List all jobs assigned TO this workspace as subcontractor.
 */
router.get(
  '/:workspaceId/subcontracts',
  authenticate,
  requireWorkspaceMembership,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { workspaceId } = req.params as { workspaceId: string };
      const { status, page = '1', pageSize = '20' } = req.query as Record<string, string>;

      const where: Record<string, unknown> = { subWorkspaceId: workspaceId };
      if (status) where['status'] = status;

      const [items, total] = await prisma.$transaction([
        prisma.subcontractorAssignment.findMany({
          where,
          skip: (Number(page) - 1) * Number(pageSize),
          take: Number(pageSize),
          orderBy: { createdAt: 'desc' },
          include: {
            order: {
              select: {
                id: true, status: true, description: true, scheduledAt: true, address: true,
                serviceCatalog: { select: { name: true, category: true } },
                customer: { select: { id: true, firstName: true, avatarUrl: true } },
              },
            },
            primeWorkspace: { select: { id: true, name: true, logoUrl: true } },
            assignedStaff: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
          },
        }),
        prisma.subcontractorAssignment.count({ where }),
      ]);

      res.json({ data: items, total, page: Number(page), pageSize: Number(pageSize) });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/workspaces/:workspaceId/prime-contracts
 * List all jobs this workspace has assigned to subcontractors.
 */
router.get(
  '/:workspaceId/prime-contracts',
  authenticate,
  requireWorkspaceMembership,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { workspaceId } = req.params as { workspaceId: string };
      const { status, page = '1', pageSize = '20' } = req.query as Record<string, string>;

      const where: Record<string, unknown> = { primeWorkspaceId: workspaceId };
      if (status) where['status'] = status;

      const [items, total] = await prisma.$transaction([
        prisma.subcontractorAssignment.findMany({
          where,
          skip: (Number(page) - 1) * Number(pageSize),
          take: Number(pageSize),
          orderBy: { createdAt: 'desc' },
          include: {
            order: {
              select: {
                id: true, status: true, description: true, scheduledAt: true, address: true,
                serviceCatalog: { select: { name: true, category: true } },
              },
            },
            subWorkspace: { select: { id: true, name: true, logoUrl: true } },
            assignedStaff: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
          },
        }),
        prisma.subcontractorAssignment.count({ where }),
      ]);

      res.json({ data: items, total, page: Number(page), pageSize: Number(pageSize) });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/workspaces/:workspaceId/subcontracts/:assignmentId/respond
 * Subcontractor accepts or rejects an assignment.
 */
router.patch(
  '/:workspaceId/subcontracts/:assignmentId/respond',
  authenticate,
  requireWorkspaceMembership,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { workspaceId, assignmentId } = req.params as { workspaceId: string; assignmentId: string };
      const input = RespondToAssignmentSchema.parse(req.body);

      const assignment = await prisma.subcontractorAssignment.findUnique({
        where: { id: assignmentId },
        include: { primeWorkspace: { select: { ownerId: true, name: true } } },
      });
      if (!assignment || assignment.subWorkspaceId !== workspaceId) {
        res.status(404).json({ code: 'NOT_FOUND', message: 'Assignment not found' });
        return;
      }
      if (assignment.status !== 'pending') {
        res.status(409).json({ code: 'ALREADY_RESPONDED', message: `Assignment is already in status: ${assignment.status}` });
        return;
      }

      const updated = await prisma.subcontractorAssignment.update({
        where: { id: assignmentId },
        data: {
          status: input.action === 'accept' ? 'accepted' : 'rejected',
          agreedAt: input.action === 'accept' ? new Date() : undefined,
          rejectedAt: input.action === 'reject' ? new Date() : undefined,
          rejectionReason: input.action === 'reject' ? input.rejectionReason : undefined,
          assignedStaffId: input.action === 'accept'
            ? (input.assignedStaffId ?? assignment.assignedStaffId)
            : assignment.assignedStaffId,
        },
      });

      // Notify prime workspace owner
      if (assignment.primeWorkspace) {
        await prisma.notification.create({
          data: {
            userId: assignment.primeWorkspace.ownerId,
            title: input.action === 'accept' ? 'Subcontractor Accepted' : 'Subcontractor Rejected',
            message: input.action === 'accept'
              ? 'The subcontractor has accepted the job assignment.'
              : `Subcontractor rejected. Reason: ${input.rejectionReason ?? 'Not specified'}`,
            type: 'system',
            link: `/workspace/prime-contracts/${assignmentId}`,
          },
        });
      }

      res.json({ data: updated });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/workspaces/:workspaceId/subcontracts/:assignmentId/start
 * Sub marks job as in_progress.
 */
router.patch(
  '/:workspaceId/subcontracts/:assignmentId/start',
  authenticate,
  requireWorkspaceMembership,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { workspaceId, assignmentId } = req.params as { workspaceId: string; assignmentId: string };
      const assignment = await prisma.subcontractorAssignment.findUnique({ where: { id: assignmentId } });
      if (!assignment || assignment.subWorkspaceId !== workspaceId) {
        res.status(404).json({ code: 'NOT_FOUND', message: 'Assignment not found' });
        return;
      }
      if (assignment.status !== 'accepted') {
        res.status(409).json({ code: 'INVALID_STATUS', message: 'Assignment must be accepted before starting' });
        return;
      }
      const updated = await prisma.subcontractorAssignment.update({
        where: { id: assignmentId },
        data: { status: 'in_progress', startedAt: new Date() },
      });
      res.json({ data: updated });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/workspaces/:workspaceId/subcontracts/:assignmentId/complete
 * Sub marks job as complete.
 */
router.patch(
  '/:workspaceId/subcontracts/:assignmentId/complete',
  authenticate,
  requireWorkspaceMembership,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { workspaceId, assignmentId } = req.params as { workspaceId: string; assignmentId: string };
      const assignment = await prisma.subcontractorAssignment.findUnique({
        where: { id: assignmentId },
        include: { primeWorkspace: { select: { ownerId: true } } },
      });
      if (!assignment || assignment.subWorkspaceId !== workspaceId) {
        res.status(404).json({ code: 'NOT_FOUND', message: 'Assignment not found' });
        return;
      }
      if (assignment.status !== 'in_progress') {
        res.status(409).json({ code: 'INVALID_STATUS', message: 'Must be in_progress to complete' });
        return;
      }
      const updated = await prisma.subcontractorAssignment.update({
        where: { id: assignmentId },
        data: { status: 'completed', completedAt: new Date() },
      });
      if (assignment.primeWorkspace) {
        await prisma.notification.create({
          data: {
            userId: assignment.primeWorkspace.ownerId,
            title: 'Subcontractor Job Completed',
            message: 'The subcontractor has completed the job. Please review.',
            type: 'system',
            link: `/workspace/prime-contracts/${assignmentId}`,
          },
        });
      }
      res.json({ data: updated });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/workspaces/:workspaceId/b2b-network
 * List all approved B2B partners for this workspace.
 */
router.get(
  '/:workspaceId/b2b-network',
  authenticate,
  requireWorkspaceMembership,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { workspaceId } = req.params as { workspaceId: string };
      const connections = await prisma.b2BConnection.findMany({
        where: {
          OR: [{ providerAId: workspaceId }, { providerBId: workspaceId }],
          status: 'approved',
        },
        include: {
          providerA: { select: { id: true, name: true, logoUrl: true, type: true } },
          providerB: { select: { id: true, name: true, logoUrl: true, type: true } },
        },
      });
      const partners = connections.map((conn) => ({
        connectionId: conn.id,
        type: conn.type,
        specialPrice: conn.specialPrice,
        partner: conn.providerAId === workspaceId ? conn.providerB : conn.providerA,
      }));
      res.json({ data: partners });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
