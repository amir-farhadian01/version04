import { Router, Response } from 'express';
import prisma from '../lib/db.js';
import { authenticate, AuthRequest } from '../lib/auth.middleware.js';

const router = Router();

// GET /api/tickets
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  const { userId, role } = req.user!;
  const isAdmin = ['owner', 'platform_admin', 'support'].includes(role);
  try {
    const where: any = isAdmin ? {} : { creatorId: userId };
    const tickets = await prisma.ticket.findMany({
      where,
      include: {
        creator: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
        recipient: { select: { id: true, displayName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(tickets);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/tickets/:id
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const ticket = await prisma.ticket.findUnique({
      where: { id: req.params.id },
      include: {
        creator: { select: { id: true, displayName: true, avatarUrl: true } },
        recipient: { select: { id: true, displayName: true } },
      },
    });
    if (!ticket) return res.status(404).json({ error: 'Not found' });
    res.json(ticket);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tickets - Create support ticket to admin
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  const { subject, type, message } = req.body;
  if (!subject || !type) return res.status(400).json({ error: 'Missing required fields' });

  // Validate ticket types
  const validTypes = ['kyc', 'technical', 'complaint', 'general', 'client_to_admin'];
  if (!validTypes.includes(type)) {
    return res.status(400).json({ error: `Invalid type. Must be one of: ${validTypes.join(', ')}` });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { displayName: true },
    });

    // Find an admin to assign (or leave unassigned)
    const admin = await prisma.user.findFirst({
      where: { role: { in: ['owner', 'platform_admin', 'support'] } },
      select: { id: true },
    });

    const ticket = await prisma.ticket.create({
      data: {
        creatorId: req.user!.userId,
        recipientId: admin?.id || null, // Assign to admin if available
        subject,
        type: type === 'client_to_admin' ? 'client_to_admin' : type,
        status: 'open',
        messages: message ? [{
          text: message,
          senderId: req.user!.userId,
          senderName: user?.displayName,
          timestamp: new Date().toISOString(),
        }] : [],
      },
    });

    // Create notification for admin
    if (admin) {
      await prisma.notification.create({
        data: {
          userId: admin.id,
          title: `New ${type.toUpperCase()} Ticket`,
          message: `${user?.displayName || 'A user'} created a ticket: ${subject}`,
          type: 'request',
          link: `/admin/tickets/${ticket.id}`,
        },
      });
    }

    res.status(201).json({
      success: true,
      ticket,
      message: 'Ticket created successfully. An admin will respond shortly.',
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/tickets/:id/message
router.put('/:id/message', authenticate, async (req: AuthRequest, res: Response) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'Missing text' });

  try {
    const ticket = await prisma.ticket.findUnique({ where: { id: req.params.id } });
    if (!ticket) return res.status(404).json({ error: 'Not found' });

    const user = await prisma.user.findUnique({ where: { id: req.user!.userId }, select: { displayName: true } });
    const messages: any[] = (ticket.messages as any[]) || [];
    messages.push({ text, senderId: req.user!.userId, senderName: user?.displayName, timestamp: new Date().toISOString() });

    const updated = await prisma.ticket.update({
      where: { id: req.params.id },
      data: { messages, status: 'in_progress' },
    });
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/tickets/:id/status
router.put('/:id/status', authenticate, async (req: AuthRequest, res: Response) => {
  const { status } = req.body;
  try {
    const updated = await prisma.ticket.update({
      where: { id: req.params.id },
      data: { status },
    });
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
