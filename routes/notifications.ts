import { Router, Response } from 'express';
import prisma from '../lib/db.js';
import { authenticate, AuthRequest } from '../lib/auth.middleware.js';

const router = Router();

// GET /api/notifications - Get categorized notifications for user
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user!.userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    // Categorize notifications
    const categorized = notifications.map((n: any) => ({
      ...n,
      category: getNotificationCategory(n.type),
    }));

    res.json(categorized);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Helper to categorize notifications
function getNotificationCategory(type: string): 'reminder' | 'security' | 'payment' | 'system' | 'request' {
  switch (type?.toLowerCase()) {
    case 'reminder':
    case 'appointment':
    case 'schedule':
      return 'reminder';
    case 'security':
    case 'login':
    case 'alert':
      return 'security';
    case 'payment':
    case 'transaction':
    case 'refund':
      return 'payment';
    case 'request':
    case 'contract':
    case 'service':
    case 'order_matched':
    case 'order_completed':
    case 'contract_approved':
      return 'request';
    default:
      return 'system';
  }
}

// PUT /api/notifications/:id/read
router.put('/:id/read', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const owned = await prisma.notification.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
    });
    if (!owned) {
      res.status(404).json({ error: 'Notification not found' });
      return;
    }
    const updated = await prisma.notification.update({
      where: { id: owned.id },
      data: { read: true },
    });
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/notifications/read-all
router.put('/read-all', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user!.userId, read: false },
      data: { read: true },
    });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/notifications/:id
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const owned = await prisma.notification.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
    });
    if (!owned) {
      res.status(404).json({ error: 'Notification not found' });
      return;
    }
    await prisma.notification.delete({ where: { id: owned.id } });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
