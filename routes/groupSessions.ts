import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../lib/db.js';
import { authenticate } from '../lib/auth.middleware.js';

interface AuthRequest extends Request {
  user?: { id: string; role: string };
}

const router = Router({ mergeParams: true });

// ─── Zod schemas ────────────────────────────────────────────────────────────

const createGroupSessionSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().max(1000).optional(),
  maxAttendees: z.number().int().min(1).max(100).default(10),
  scheduledAt: z.string().datetime(),
  durationMinutes: z.number().int().min(1).max(1440),
  locationId: z.string().uuid().optional(),
  pricePerAttendee: z.number().int().min(0), // cents
});

/**
 * POST /api/orders/:orderId/group-sessions
 * Create a group service session for an order.
 * Only the assigned provider can create.
 */
router.post('/', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { orderId } = req.params;
    const parsed = createGroupSessionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Invalid input', details: parsed.error.flatten() });
      return;
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, matchedProviderId: true, customerId: true },
    });

    if (!order) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Order not found' });
      return;
    }

    if (order.matchedProviderId !== req.user!.id) {
      res.status(403).json({ code: 'FORBIDDEN', message: 'Only the assigned provider can create group sessions' });
      return;
    }

    const session = await prisma.groupServiceSession.create({
      data: {
        orderId,
        title: parsed.data.title,
        description: parsed.data.description,
        maxAttendees: parsed.data.maxAttendees,
        scheduledAt: new Date(parsed.data.scheduledAt),
        durationMinutes: parsed.data.durationMinutes,
        locationId: parsed.data.locationId,
        pricePerAttendee: parsed.data.pricePerAttendee,
      },
    });

    res.status(201).json({ data: session });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/orders/:orderId/group-sessions
 * List all group sessions for an order.
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

    if (order.customerId !== req.user!.id && order.matchedProviderId !== req.user!.id) {
      res.status(403).json({ code: 'FORBIDDEN', message: 'Access denied' });
      return;
    }

    const sessions = await prisma.groupServiceSession.findMany({
      where: { orderId, archivedAt: null },
      include: {
        _count: { select: { attendees: true } },
      },
      orderBy: { scheduledAt: 'asc' },
    });

    res.json({ data: sessions });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/orders/:orderId/group-sessions/:sessionId/attendees
 * List attendees for a group session.
 */
router.get('/:sessionId/attendees', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { orderId, sessionId } = req.params;

    const session = await prisma.groupServiceSession.findFirst({
      where: { id: sessionId, orderId, archivedAt: null },
      include: {
        attendees: {
          select: {
            id: true,
            userId: true,
            status: true,
            paidAt: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!session) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Group session not found' });
      return;
    }

    res.json({ data: session.attendees });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/orders/:orderId/group-sessions/:sessionId/join
 * Join a group session as a customer.
 * Any authenticated customer can join (subject to maxAttendees).
 */
router.post('/:sessionId/join', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { orderId, sessionId } = req.params;

    const session = await prisma.groupServiceSession.findFirst({
      where: { id: sessionId, orderId, archivedAt: null },
      include: {
        _count: { select: { attendees: true } },
      },
    });

    if (!session) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Group session not found' });
      return;
    }

    // Check capacity
    if (session._count.attendees >= session.maxAttendees) {
      res.status(409).json({ code: 'SESSION_FULL', message: 'This group session is full' });
      return;
    }

    // Check if already joined
    const existing = await prisma.groupSessionAttendee.findUnique({
      where: { sessionId_userId: { sessionId, userId: req.user!.id } },
    });

    if (existing) {
      // Allow re-join if previously cancelled
      if (existing.status === 'cancelled') {
        await prisma.groupSessionAttendee.update({
          where: { id: existing.id },
          data: { status: 'registered' },
        });
        res.json({ data: { ...existing, status: 'registered' } });
        return;
      }
      res.status(409).json({ code: 'ALREADY_JOINED', message: 'You have already joined this session' });
      return;
    }

    const attendee = await prisma.groupSessionAttendee.create({
      data: {
        sessionId,
        userId: req.user!.id,
        status: 'registered',
      },
    });

    res.status(201).json({ data: attendee });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/orders/:orderId/group-sessions/:sessionId/leave
 * Leave a group session (sets status to cancelled).
 */
router.delete('/:sessionId/leave', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { orderId, sessionId } = req.params;

    const attendee = await prisma.groupSessionAttendee.findUnique({
      where: { sessionId_userId: { sessionId, userId: req.user!.id } },
    });

    if (!attendee) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'You are not registered for this session' });
      return;
    }

    await prisma.groupSessionAttendee.update({
      where: { id: attendee.id },
      data: { status: 'cancelled' },
    });

    res.json({ data: { left: true } });
  } catch (err) {
    next(err);
  }
});

export default router;