import { Router, Response } from 'express';
import prisma from '../lib/db.js';
import { authenticate, AuthRequest } from '../lib/auth.middleware.js';
import { publish } from '../lib/bus.js';

const router = Router();

// GET /api/contracts
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  const { userId, role } = req.user!;
  const isAdmin = ['owner', 'platform_admin', 'support', 'finance'].includes(role);
  try {
    const where: any = isAdmin ? {} : { OR: [{ customerId: userId }, { providerId: userId }] };
    const contracts = await prisma.contract.findMany({
      where,
      include: {
        customer: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
        provider: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
        request: { select: { id: true, details: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(contracts);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/contracts/:id
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const contract = await prisma.contract.findUnique({
      where: { id: req.params.id },
      include: {
        customer: { select: { id: true, displayName: true, email: true, phone: true } },
        provider: { select: { id: true, displayName: true, email: true, phone: true } },
        request: { include: { service: true } },
      },
    });
    if (!contract) return res.status(404).json({ error: 'Not found' });
    res.json(contract);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/contracts
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  const { requestId, customerId, providerId, amount, terms, paymentMethod } = req.body;
  if (!customerId || !providerId || amount === undefined)
    return res.status(400).json({ error: 'Missing required fields' });

  try {
    const contract = await prisma.contract.create({
      data: { requestId, customerId, providerId, amount: parseFloat(amount), terms, paymentMethod },
    });

    await publish('contract.created', { contractId: contract.id });

    await prisma.notification.createMany({
      data: [
        { userId: customerId, title: 'Contract Created', message: 'A new contract is ready for your signature', type: 'payment', link: `/contract/${contract.id}` },
        { userId: providerId, title: 'Contract Created', message: 'A new contract is ready for your signature', type: 'payment', link: `/contract/${contract.id}` },
      ],
    });

    res.status(201).json(contract);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/contracts/:id/sign
router.put('/:id/sign', authenticate, async (req: AuthRequest, res: Response) => {
  const { userId, role } = req.user!;
  try {
    const contract = await prisma.contract.findUnique({ where: { id: req.params.id } });
    if (!contract) return res.status(404).json({ error: 'Not found' });

    const data: any = {};
    if (contract.customerId === userId) {
      data.clientSigned = true;
      data.clientSignedAt = new Date();
      if (req.body.paymentMethod) data.paymentMethod = req.body.paymentMethod;
    } else if (contract.providerId === userId) {
      data.providerSigned = true;
      data.providerSignedAt = new Date();
    } else {
      return res.status(403).json({ error: 'Not a party to this contract' });
    }

    // Auto-confirm if both signed
    const updated = await prisma.contract.update({ where: { id: req.params.id }, data });
    if (updated.clientSigned && updated.providerSigned) {
      await prisma.contract.update({ where: { id: req.params.id }, data: { status: 'confirmed' } });
    }

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/contracts/:id/status
router.put('/:id/status', authenticate, async (req: AuthRequest, res: Response) => {
  const { status, checkInTime, checkOutTime } = req.body;
  try {
    const updated = await prisma.contract.update({
      where: { id: req.params.id },
      data: { status, checkInTime, checkOutTime },
    });
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
