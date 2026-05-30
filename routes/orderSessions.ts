import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../lib/db.js';
import { authenticate } from '../lib/auth.middleware.js';

interface AuthRequest extends Request {
  user?: { id: string; role: string };
}

const router = Router({ mergeParams: true });

// ─── Zod schemas ────────────────────────────────────────────────────────────

const createSessionSchema = z.object({
  sessionIndex: z.number().int().min(1),
  scheduledAt: z.string().datetime().optional(),
  durationMinutes: z.number().int().min(1).max(1440).optional(),
  notes: z.string().max(500).optional(),
});

const updateSessionSchema = z.object({
  status: z.enum(['scheduled', 'in_progress', 'completed', 'cancelled']).optional(),
  scheduledAt: z.string().datetime().optional(),
  actualStartAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
  durationMinutes: z.number().int().min(1).max(1440).optional(),
  providerNotes: z.string().max(1000).optional(),
  cancelReason: z.string().max(500).optional(),
});

/**
 * POST /api/orders/:orderId/sessions
 * Create a new session for a multi-session order.
 * Only the assigned provider can create sessions.
 */
router.post('/', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { orderId } = req.params;
    const parsed = createSessionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Invalid input', details: parsed.error.flatten() });
      return;
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, matchedProviderId: true, customerId: true, isMultiSession: true, totalSessions: true },
    });

    if (!order) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Order not found' });
      return;
    }

    // Only assigned provider can manage sessions
    if (order.matchedProviderId !== req.user!.id) {
      res.status(403).json({ code: 'FORBIDDEN', message: 'Only the assigned provider can manage sessions' });
      return;
    }

    const session = await prisma.orderSession.create({
      data: {
        orderId,
        sessionIndex: parsed.data.sessionIndex,
        scheduledAt: parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : null,
        durationMinutes: parsed.data.durationMinutes,
        providerNotes: parsed.data.notes,
        status: 'scheduled',
      },
    });

    // Update totalSessions on the order
    const sessionCount = await prisma.orderSession.count({ where: { orderId } });
    await prisma.order.update({
      where: { id: orderId },
      data: {
        totalSessions: sessionCount,
        isMultiSession: sessionCount > 1,
      },
    });

    res.status(201).json({ data: session });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/orders/:orderId/sessions
 * List all sessions for an order.
 * Both customer and assigned provider can view.
 */
router.get('/', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { orderId } = req.params;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, matchedProviderId: true, customerId: true },
    });

    if (!order) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Order not found' });
      return;
    }

    // Both customer and provider can view
    if (order.customerId !== req.user!.id && order.matchedProviderId !== req.user!.id) {
      res.status(403).json({ code: 'FORBIDDEN', message: 'Access denied' });
      return;
    }

    const sessions = await prisma.orderSession.findMany({
      where: { orderId },
      orderBy: { sessionIndex: 'asc' },
    });

    res.json({ data: sessions });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/orders/:orderId/sessions/:sessionId
 * Update a session (status, start, complete, cancel).
 * Only the assigned provider can update sessions.
 */
router.patch('/:sessionId', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { orderId, sessionId } = req.params;
    const parsed = updateSessionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Invalid input', details: parsed.error.flatten() });
      return;
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, matchedProviderId: true, completedSessions: true, totalSessions: true },
    });

    if (!order) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Order not found' });
      return;
    }

    if (order.matchedProviderId !== req.user!.id) {
      res.status(403).json({ code: 'FORBIDDEN', message: 'Only the assigned provider can update sessions' });
      return;
    }

    const session = await prisma.orderSession.findFirst({
      where: { id: sessionId, orderId },
    });

    if (!session) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Session not found' });
      return;
    }

    const data: Record<string, unknown> = {};
    if (parsed.data.status) data.status = parsed.data.status;
    if (parsed.data.scheduledAt) data.scheduledAt = new Date(parsed.data.scheduledAt);
    if (parsed.data.actualStartAt) data.actualStartAt = new Date(parsed.data.actualStartAt);
    if (parsed.data.completedAt) data.completedAt = new Date(parsed.data.completedAt);
    if (parsed.data.durationMinutes !== undefined) data.durationMinutes = parsed.data.durationMinutes;
    if (parsed.data.providerNotes !== undefined) data.providerNotes = parsed.data.providerNotes;
    if (parsed.data.cancelReason !== undefined) data.cancelReason = parsed.data.cancelReason;

    if (parsed.data.status === 'cancelled') {
      data.cancelledAt = new Date();
    }

    const updated = await prisma.orderSession.update({
      where: { id: sessionId },
      data: data as any,
    });

    // Recalculate completedSessions
    if (parsed.data.status === 'completed' || parsed.data.status === 'cancelled') {
      const completedCount = await prisma.orderSession.count({
        where: { orderId, status: 'completed' },
      });
      await prisma.order.update({
        where: { id: orderId },
        data: { completedSessions: completedCount },
      });
    }

    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/orders/:orderId/sessions/:sessionId
 * Delete a session (only if status is 'scheduled').
 */
router.delete('/:sessionId', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { orderId, sessionId } = req.params;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, matchedProviderId: true },
    });

    if (!order) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Order not found' });
      return;
    }

    if (order.matchedProviderId !== req.user!.id) {
      res.status(403).json({ code: 'FORBIDDEN', message: 'Only the assigned provider can delete sessions' });
      return;
    }

    const session = await prisma.orderSession.findFirst({
      where: { id: sessionId, orderId },
    });

    if (!session) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Session not found' });
      return;
    }

    if (session.status !== 'scheduled') {
      res.status(409).json({ code: 'INVALID_STATE', message: 'Only scheduled sessions can be deleted' });
      return;
    }

    await prisma.orderSession.delete({ where: { id: sessionId } });

    // Update totalSessions
    const sessionCount = await prisma.orderSession.count({ where: { orderId } });
    await prisma.order.update({
      where: { id: orderId },
      data: {
        totalSessions: sessionCount,
        isMultiSession: sessionCount > 1,
      },
    });

    res.json({ data: { deleted: true } });
  } catch (err) {
    next(err);
  }
});

export default router;