import { Router, Response } from 'express';
import prisma from '../lib/db.js';
import { authenticate, AuthRequest } from '../lib/auth.middleware.js';
import { publish } from '../lib/bus.js';

const router = Router();

// GET /api/requests
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  const { userId, role } = req.user!;
  try {
    const where: any = {};
    const isAdmin = ['owner', 'platform_admin', 'support'].includes(role);
    if (!isAdmin) {
      if (role === 'customer') where.customerId = userId;
      else if (role === 'provider') where.providerId = userId;
    }

    const requests = await prisma.request.findMany({
      where,
      include: {
        customer: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
        provider: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
        service: { select: { id: true, title: true, price: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(requests);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/requests/:id
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const request = await prisma.request.findUnique({
      where: { id: req.params.id },
      include: {
        customer: { select: { id: true, displayName: true, email: true } },
        provider: { select: { id: true, displayName: true, email: true } },
        service: true,
        contracts: true,
      },
    });
    if (!request) return res.status(404).json({ error: 'Not found' });
    res.json(request);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Helper function to check KYC level 2
async function checkKycLevel2(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isVerified: true, phone: true },
  });

  const kyc = await prisma.kYC.findUnique({
    where: { userId },
  });

  const emailVerified = user?.isVerified ?? false;
  const phoneVerified = !!user?.phone && user.phone.length > 0;
  const identityVerified = kyc?.status === 'verified' && kyc?.type === 'personal';

  // Level 1: email or phone verified
  // Level 2: identity verified
  return identityVerified && (emailVerified || phoneVerified);
}

// POST /api/requests
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  const { serviceId, providerId, details } = req.body;
  if (!serviceId || !providerId) return res.status(400).json({ error: 'Missing required fields' });

  try {
    // Check KYC Level 2
    const hasKycLevel2 = await checkKycLevel2(req.user!.userId);
    if (!hasKycLevel2) {
      return res.status(403).json({
        error: 'KYC Level 2 Required',
        message: 'You must complete identity verification (KYC Level 2) before placing orders.',
        details: {
          required: 'KYC Level 2 (Identity Verification)',
          redirect: '/kyc',
          steps: [
            'Verify your email address',
            'Verify your phone number',
            'Submit a valid ID (Passport, Driver\'s License, or National ID)',
          ],
        },
      });
    }

    const request = await prisma.request.create({
      data: { customerId: req.user!.userId, serviceId, providerId, details },
    });

    await publish('request.created', { requestId: request.id, customerId: req.user!.userId, providerId });

    // Create notification for provider
    await prisma.notification.create({
      data: {
        userId: providerId,
        title: 'New Service Request',
        message: 'You have a new service request',
        type: 'request',
        link: `/dashboard?tab=requests`,
      },
    });

    res.status(201).json(request);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/requests/:id/status
router.put('/:id/status', authenticate, async (req: AuthRequest, res: Response) => {
  const { status } = req.body;
  try {
    const request = await prisma.request.findUnique({ where: { id: req.params.id } });
    if (!request) return res.status(404).json({ error: 'Not found' });

    const updated = await prisma.request.update({
      where: { id: req.params.id },
      data: { status },
    });
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
