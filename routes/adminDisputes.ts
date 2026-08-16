import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../lib/db.js';
import { publish } from '../lib/bus.js';
import {
  authenticate,
  isAdmin,
  AuthRequest,
} from '../lib/auth.middleware.js';

const router = Router();

// All routes require admin auth
router.use(authenticate, isAdmin);

// ── Zod schemas ──────────────────────────────────────────────────────────────

const resolveDisputeSchema = z.object({
  resolution: z.enum(['refund_customer', 'release_provider', 'split']),
  adminNote: z.string().min(10).max(2000),
  customerRefundPercent: z.number().int().min(0).max(100).optional(),
  providerReleasePercent: z.number().int().min(0).max(100).optional(),
});

// ── GET /admin/disputes ──────────────────────────────────────────────────────

/**
 * GET /admin/disputes
 * List all orders with disputes
 */
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const disputes = await prisma.order.findMany({
      where: {
        status: 'disputed',
      },
      include: {
        dispute: true,
        customer: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        matchedWorkspace: {
          select: { id: true, name: true },
        },
        payment: {
          select: { amount: true, commission: true, status: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    res.json({ data: disputes });
  } catch (err) {
    next(err);
  }
});

// ── GET /admin/disputes/:id ──────────────────────────────────────────────────

/**
 * GET /admin/disputes/:id
 * Get dispute details for a specific order
 */
router.get('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: {
        dispute: true,
        customer: {
          select: { id: true, firstName: true, lastName: true, email: true, phone: true },
        },
        matchedWorkspace: {
          select: { id: true, name: true },
        },
        payment: true,
        matchedPackage: {
          select: { name: true },
        },
      },
    });

    if (!order || order.status !== 'disputed') {
      res.status(404).json({ error: 'Dispute not found' });
      return;
    }

    res.json({ data: order });
  } catch (err) {
    next(err);
  }
});

// ── POST /admin/disputes/:id/resolve ─────────────────────────────────────────

/**
 * POST /admin/disputes/:id/resolve
 * Resolve a dispute with a specific resolution
 */
router.post('/:id/resolve', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const parsed = resolveDisputeSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
      return;
    }

    const { resolution, adminNote, customerRefundPercent, providerReleasePercent } = parsed.data;

    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: { payment: true, dispute: true },
    });

    if (!order || order.status !== 'disputed') {
      res.status(404).json({ error: 'Dispute not found or already resolved' });
      return;
    }

    const adminId = req.user?.userId ?? 'unknown';

    // Resolve based on resolution type
    await prisma.$transaction(async (tx) => {
      // Update order status to resolved
      await tx.order.update({
        where: { id: order.id },
        data: { status: 'closed' },
      });

      // Handle payment based on resolution
      if (order.payment) {
        switch (resolution) {
          case 'refund_customer':
            await tx.payment.update({
              where: { orderId: order.id },
              data: { status: 'refunded' },
            });
            break;

          case 'release_provider':
            await tx.payment.update({
              where: { orderId: order.id },
              data: { status: 'captured' },
            });
            break;

          case 'split': {
            const refundPct = customerRefundPercent ?? 50;
            const releasePct = providerReleasePercent ?? 50;
            // In production, this would split the payment via the payment gateway
            // For now, mark as refunded to indicate the dispute is settled
            await tx.payment.update({
              where: { orderId: order.id },
              data: { status: 'refunded' },
            });
            break;
          }
        }
      }

      // Create audit log entry
      await tx.auditLog.create({
        data: {
          actorId: adminId,
          action: 'dispute_resolved',
          resourceType: 'order',
          resourceId: order.id,
          metadata: {
            resolution,
            adminNote,
            customerRefundPercent,
            providerReleasePercent,
          },
        },
      });
    });

    // Publish NATS notification for dispute resolution
    try {
      await publish('dispute.resolved', {
        orderId: order.id,
        resolution,
        adminNote,
        customerRefundPercent: customerRefundPercent ?? null,
        providerReleasePercent: providerReleasePercent ?? null,
        resolvedBy: adminId,
      });
    } catch {
      /* NATS optional */
    }

    res.json({
      data: {
        orderId: order.id,
        resolution,
        message: `Dispute resolved: ${resolution}`,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
