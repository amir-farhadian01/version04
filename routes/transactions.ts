import { Router, Response } from 'express';
import prisma from '../lib/db.js';
import { authenticate, AuthRequest } from '../lib/auth.middleware.js';

const router = Router();

// GET /api/transactions/finance-history - Get complete finance history with orders
router.get('/finance-history', authenticate, async (req: AuthRequest, res: Response) => {
  const { userId } = req.user!;

  try {
    // Fetch all requests with their related data
    const requests = await prisma.request.findMany({
      where: { customerId: userId },
      include: {
        customer: {
          select: { id: true, displayName: true, email: true, avatarUrl: true }
        },
        provider: {
          select: { id: true, displayName: true, email: true, avatarUrl: true }
        },
        service: {
          select: { id: true, title: true, price: true, description: true }
        },
        contracts: {
          select: {
            id: true,
            status: true,
            amount: true,
            paymentMethod: true,
            createdAt: true,
            clientSigned: true,
            providerSigned: true,
          }
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Fetch transactions for this user
    const transactions = await prisma.transaction.findMany({
      where: { customerId: userId },
      orderBy: { timestamp: 'desc' },
    });

    // Combine and format the data
    const financeHistory = requests.map(request => {
      // Find related contract
      const contract = request.contracts && request.contracts.length > 0
        ? request.contracts[0]
        : null;

      // Find related transaction
      const transaction = transactions.find(t =>
        t.description?.includes(request.id) ||
        t.description?.includes(request.service?.title || '')
      );

      // Determine status
      let status = request.status;
      if (contract) {
        if (contract.status === 'active' || (contract.clientSigned && contract.providerSigned)) {
          status = 'in_progress';
        } else if (contract.status === 'completed') {
          status = 'completed';
        } else if (contract.status === 'cancelled') {
          status = 'cancelled';
        }
      }

      // Determine amount
      const amount = contract?.amount || request.service?.price || 0;

      return {
        id: request.id,
        status: status,
        amount: amount,
        service: request.service,
        provider: request.provider,
        customer: request.customer,
        contract: contract,
        transactionId: transaction?.id || null,
        createdAt: request.createdAt,
        updatedAt: request.createdAt,
        details: request.details,
      };
    });

    res.json(financeHistory);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/transactions
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  const { userId, role } = req.user!;
  const isAdmin = ['owner', 'platform_admin', 'finance'].includes(role);

  try {
    const where: any = isAdmin ? {} : { OR: [{ customerId: userId }, { company: { ownerId: userId } }] };
    const transactions = await prisma.transaction.findMany({
      where,
      include: {
        customer: { select: { id: true, displayName: true, email: true } },
        company: { select: { id: true, name: true } },
      },
      orderBy: { timestamp: 'desc' },
      take: 100,
    });
    res.json(transactions);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/transactions
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  const { type, amount, category, description, companyId } = req.body;
  if (!type || amount === undefined) return res.status(400).json({ error: 'Missing required fields' });

  try {
    const transaction = await prisma.transaction.create({
      data: {
        type,
        amount: parseFloat(amount),
        category,
        description,
        customerId: req.user!.userId,
        companyId,
      },
    });
    res.status(201).json(transaction);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
