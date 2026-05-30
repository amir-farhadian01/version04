import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/db.js';
import { authenticate, AuthRequest } from '../lib/auth.middleware.js';
import { assertWorkspaceMember, WorkspaceAccessError } from '../lib/workspaceAccess.js';

const router = Router();

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const transactionsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  status: z.enum(['PENDING', 'CAPTURED', 'REFUNDED', 'FAILED']).optional(),
  serviceType: z.string().optional(),
  clientName: z.string().optional(),
  staffName: z.string().optional(),
});

const paymentSettingsSchema = z.object({
  stripeEnabled: z.boolean().optional(),
  stripeAccountId: z.string().optional(),
  paypalEnabled: z.boolean().optional(),
  paypalEmail: z.string().email().optional(),
  interacEnabled: z.boolean().optional(),
  interacEmail: z.string().email().optional(),
  squareEnabled: z.boolean().optional(),
  squareLocationId: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function serializeTransaction(t: Record<string, unknown>) {
  return {
    id: t.id,
    date: (t.createdAt as Date).toISOString(),
    orderId: t.orderId,
    serviceName: (t.serviceCatalog as Record<string, unknown>)?.name ?? (t.matchedPackage as Record<string, unknown>)?.name ?? null,
    packageName: (t.matchedPackage as Record<string, unknown>)?.name ?? null,
    clientName: (t.customer as Record<string, unknown>)?.displayName ?? null,
    clientId: t.customerId,
    staffName: (t.matchedProvider as Record<string, unknown>)?.displayName ?? null,
    staffId: t.matchedProviderId,
    amount: t.amount ?? 0,
    commission: t.commission ?? 0,
    net: (t.amount ?? 0) - (t.commission ?? 0),
    paymentRef: (t.payment as Record<string, unknown>)?.stripePaymentIntentId ?? null,
    status: (t.payment as Record<string, unknown>)?.status ?? null,
    paymentMethod: (t.payment as Record<string, unknown>)?.method ?? null,
  };
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// GET /api/workspace/:workspaceId/finance/transactions — Transactions table
router.get('/:workspaceId/finance/transactions', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId } = req.params;
    const userId = req.user!.userId;

    try {
      await assertWorkspaceMember(userId, workspaceId);
    } catch (e) {
      if (e instanceof WorkspaceAccessError) {
        return res.status(403).json({ code: 'FORBIDDEN', message: 'Not a workspace member' });
      }
      throw e;
    }

    const query = transactionsQuerySchema.parse(req.query);
    const where: Record<string, unknown> = {
      matchedWorkspaceId: workspaceId,
      status: { in: ['completed', 'closed', 'in_progress'] },
      payment: { isNot: null },
    };

    if (query.dateFrom || query.dateTo) {
      where.createdAt = {};
      if (query.dateFrom) (where.createdAt as Record<string, unknown>).gte = new Date(query.dateFrom);
      if (query.dateTo) (where.createdAt as Record<string, unknown>).lte = new Date(query.dateTo);
    }
    if (query.clientName) {
      where.customer = {
        OR: [
          { displayName: { contains: query.clientName, mode: 'insensitive' } },
          { firstName: { contains: query.clientName, mode: 'insensitive' } },
          { lastName: { contains: query.clientName, mode: 'insensitive' } },
        ],
      };
    }
    if (query.staffName) {
      where.matchedProvider = {
        displayName: { contains: query.staffName, mode: 'insensitive' },
      };
    }
    if (query.status) {
      where.payment = { status: query.status };
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where: where as any,
        include: {
          customer: { select: { id: true, displayName: true, avatarUrl: true } },
          matchedProvider: { select: { id: true, displayName: true, avatarUrl: true } },
          serviceCatalog: { select: { name: true } },
          matchedPackage: { select: { name: true, finalPrice: true } },
          payment: true,
          orderContract: {
            select: { currentVersion: { select: { amount: true } } },
          },
        },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.order.count({ where: where as any }),
    ]);

    // Compute totals for running total row
    let totalAmount = 0;
    let totalCommission = 0;
    let totalNet = 0;

    const transactions = orders.map((o) => {
      const amount = o.orderContract?.currentVersion?.amount ?? o.matchedPackage?.finalPrice ?? o.payment?.amount ?? 0;
      const commission = o.payment?.commission ?? 0;
      const net = amount - commission;

      totalAmount += amount;
      totalCommission += commission;
      totalNet += net;

      return {
        id: o.id,
        date: o.createdAt.toISOString(),
        orderId: o.id,
        serviceName: o.serviceCatalog?.name ?? null,
        packageName: o.matchedPackage?.name ?? null,
        clientName: o.customer?.displayName ?? null,
        clientId: o.customer?.id ?? null,
        staffName: o.matchedProvider?.displayName ?? null,
        staffId: o.matchedProvider?.id ?? null,
        amount,
        commission,
        net,
        paymentRef: o.payment?.stripePaymentIntentId ?? null,
        status: o.payment?.status ?? null,
        paymentMethod: o.payment?.method ?? null,
        invoiceId: o.payment?.invoiceId ?? null,
      };
    });

    res.json({
      data: transactions,
      totals: {
        amount: totalAmount,
        commission: totalCommission,
        net: totalNet,
      },
      total,
      page: query.page,
      pageSize: query.pageSize,
    });
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Invalid query parameters', details: err.flatten() });
    }
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ code: 'INTERNAL_ERROR', message });
  }
});

// GET /api/workspace/:workspaceId/finance/summary — Revenue, commission, net summary
router.get('/:workspaceId/finance/summary', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId } = req.params;
    const userId = req.user!.userId;

    try {
      await assertWorkspaceMember(userId, workspaceId);
    } catch (e) {
      if (e instanceof WorkspaceAccessError) {
        return res.status(403).json({ code: 'FORBIDDEN', message: 'Not a workspace member' });
      }
      throw e;
    }

    const period = typeof req.query.period === 'string' ? req.query.period : 'all';
    let dateFilter: Date | null = null;
    const now = new Date();

    if (period === 'week') {
      dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (period === 'month') {
      dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else if (period === 'year') {
      dateFilter = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    }

    const orderWhere: Record<string, unknown> = {
      matchedWorkspaceId: workspaceId,
      status: { in: ['completed', 'closed'] },
      payment: { isNot: null },
    };

    if (dateFilter) {
      orderWhere.createdAt = { gte: dateFilter };
    }

    const orders = await prisma.order.findMany({
      where: orderWhere as any,
      include: {
        payment: true,
        orderContract: {
          select: { currentVersion: { select: { amount: true } } },
        },
        matchedPackage: { select: { finalPrice: true } },
      },
    });

    let totalRevenue = 0;
    let totalCommission = 0;
    const completedCount = orders.length;

    for (const o of orders) {
      const amount = o.orderContract?.currentVersion?.amount ?? o.matchedPackage?.finalPrice ?? o.payment?.amount ?? 0;
      const commission = o.payment?.commission ?? 0;
      totalRevenue += amount;
      totalCommission += commission;
    }

    const totalNet = totalRevenue - totalCommission;

    // Count active/in-progress orders
    const activeOrders = await prisma.order.count({
      where: {
        matchedWorkspaceId: workspaceId,
        status: { in: ['matched', 'contracted', 'paid', 'in_progress'] },
      },
    });

    // Get workspace payment settings
    const workspace = await prisma.company.findUnique({
      where: { id: workspaceId },
      select: {
        id: true,
        stripeAccountId: true,
        stripeEnabled: true,
        paypalEnabled: true,
        paypalEmail: true,
        interacEnabled: true,
        interacEmail: true,
        squareEnabled: true,
        squareLocationId: true,
      },
    });

    res.json({
      data: {
        totalRevenue,
        totalCommission,
        totalNet,
        completedOrders: completedCount,
        activeOrders,
        period,
        paymentSettings: workspace ? {
          stripeEnabled: workspace.stripeEnabled,
          stripeAccountId: workspace.stripeAccountId,
          paypalEnabled: workspace.paypalEnabled,
          paypalEmail: workspace.paypalEmail,
          interacEnabled: workspace.interacEnabled,
          interacEmail: workspace.interacEmail,
          squareEnabled: workspace.squareEnabled,
          squareLocationId: workspace.squareLocationId,
        } : null,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ code: 'INTERNAL_ERROR', message });
  }
});

// GET /api/workspace/:workspaceId/finance/settings — Payment gateway settings
router.get('/:workspaceId/finance/settings', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId } = req.params;
    const userId = req.user!.userId;

    try {
      await assertWorkspaceMember(userId, workspaceId);
    } catch (e) {
      if (e instanceof WorkspaceAccessError) {
        return res.status(403).json({ code: 'FORBIDDEN', message: 'Not a workspace member' });
      }
      throw e;
    }

    const workspace = await prisma.company.findUnique({
      where: { id: workspaceId },
      select: {
        id: true,
        name: true,
        stripeEnabled: true,
        stripeAccountId: true,
        stripeChargesEnabled: true,
        stripePayoutsEnabled: true,
        paypalEnabled: true,
        paypalEmail: true,
        interacEnabled: true,
        interacEmail: true,
        squareEnabled: true,
        squareLocationId: true,
      },
    });

    if (!workspace) {
      return res.status(404).json({ code: 'NOT_FOUND', message: 'Workspace not found' });
    }

    res.json({ data: workspace });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ code: 'INTERNAL_ERROR', message });
  }
});

// PUT /api/workspace/:workspaceId/finance/settings/payment — Update payment method
router.put('/:workspaceId/finance/settings/payment', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId } = req.params;
    const userId = req.user!.userId;

    try {
      await assertWorkspaceMember(userId, workspaceId);
    } catch (e) {
      if (e instanceof WorkspaceAccessError) {
        return res.status(403).json({ code: 'FORBIDDEN', message: 'Not a workspace member' });
      }
      throw e;
    }

    const input = paymentSettingsSchema.parse(req.body);

    const updated = await prisma.company.update({
      where: { id: workspaceId },
      data: {
        ...(input.stripeEnabled !== undefined && { stripeEnabled: input.stripeEnabled }),
        ...(input.stripeAccountId !== undefined && { stripeAccountId: input.stripeAccountId }),
        ...(input.paypalEnabled !== undefined && { paypalEnabled: input.paypalEnabled }),
        ...(input.paypalEmail !== undefined && { paypalEmail: input.paypalEmail }),
        ...(input.interacEnabled !== undefined && { interacEnabled: input.interacEnabled }),
        ...(input.interacEmail !== undefined && { interacEmail: input.interacEmail }),
        ...(input.squareEnabled !== undefined && { squareEnabled: input.squareEnabled }),
        ...(input.squareLocationId !== undefined && { squareLocationId: input.squareLocationId }),
      },
      select: {
        id: true,
        stripeEnabled: true,
        stripeAccountId: true,
        paypalEnabled: true,
        paypalEmail: true,
        interacEnabled: true,
        interacEmail: true,
        squareEnabled: true,
        squareLocationId: true,
      },
    });

    res.json({ data: updated });
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Invalid settings', details: err.flatten() });
    }
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ code: 'INTERNAL_ERROR', message });
  }
});

// POST /api/workspace/:workspaceId/finance/stripe-connect — Initiate Stripe Connect OAuth
router.post('/:workspaceId/finance/stripe-connect', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId } = req.params;
    const userId = req.user!.userId;

    try {
      await assertWorkspaceMember(userId, workspaceId);
    } catch (e) {
      if (e instanceof WorkspaceAccessError) {
        return res.status(403).json({ code: 'FORBIDDEN', message: 'Not a workspace member' });
      }
      throw e;
    }

    // Generate a state token for OAuth security
    const stateToken = `stripe_connect_${workspaceId}_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;

    // Store state token to verify callback
    // In production, this would be stored in Redis with TTL
    // For now, we return it for the client to use in the redirect URL

    const stripeClientId = process.env.STRIPE_CLIENT_ID || '';

    res.json({
      data: {
        stateToken,
        authorizeUrl: `https://connect.stripe.com/oauth/authorize?response_type=code&client_id=${stripeClientId}&scope=read_write&state=${stateToken}`,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ code: 'INTERNAL_ERROR', message });
  }
});

// GET /api/workspace/:workspaceId/finance/stripe-status — Check Stripe connection status
router.get('/:workspaceId/finance/stripe-status', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId } = req.params;
    const userId = req.user!.userId;

    try {
      await assertWorkspaceMember(userId, workspaceId);
    } catch (e) {
      if (e instanceof WorkspaceAccessError) {
        return res.status(403).json({ code: 'FORBIDDEN', message: 'Not a workspace member' });
      }
      throw e;
    }

    const workspace = await prisma.company.findUnique({
      where: { id: workspaceId },
      select: {
        id: true,
        stripeAccountId: true,
        stripeEnabled: true,
        stripeChargesEnabled: true,
        stripePayoutsEnabled: true,
      },
    });

    if (!workspace) {
      return res.status(404).json({ code: 'NOT_FOUND', message: 'Workspace not found' });
    }

    const connected = !!(workspace.stripeAccountId && workspace.stripeEnabled);

    res.json({
      data: {
        connected,
        accountId: workspace.stripeAccountId ?? null,
        chargesEnabled: workspace.stripeChargesEnabled ?? false,
        payoutsEnabled: workspace.stripePayoutsEnabled ?? false,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ code: 'INTERNAL_ERROR', message });
  }
});

export default router;