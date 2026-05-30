import { Router, type Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/db.js';
import { authenticate, isAdmin, type AuthRequest } from '../lib/auth.middleware.js';
import { getCommissionSummary, getCommissionByProvider } from '../lib/commissionTracking.js';
import { refundPaymentForOrder } from '../lib/stripeService.js';

const router = Router();
router.use(authenticate, isAdmin);

const PAYMENT_LEDGER_CATEGORIES = ['order_payment_session', 'order_payment_capture'] as const;
const PAYMENT_ROW_CATEGORIES = [
  'order_payment_session',
  'order_payment_capture',
  'order_payment_refund',
  'order_payment_failed',
] as const;

const PLATFORM_FEE_PERCENT = 10;

function extractOrderId(description: string | null): string | null {
  if (!description) return null;
  const m = /order:([a-z0-9]+)/i.exec(description);
  return m?.[1] ?? null;
}

function userDisplayName(u: {
  displayName: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string;
} | null): string {
  if (!u) return '—';
  const d = u.displayName?.trim();
  if (d) return d;
  const parts = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
  if (parts) return parts;
  return u.email;
}

type RowStatus = 'PENDING' | 'CAPTURED' | 'REFUNDED' | 'FAILED';

function statusFromCategory(category: string | null): RowStatus {
  const c = (category ?? '').toLowerCase();
  if (c === 'order_payment_failed') return 'FAILED';
  if (c === 'order_payment_refund') return 'REFUNDED';
  if (c === 'order_payment_capture') return 'CAPTURED';
  return 'PENDING';
}

/** Paginated payment rows derived from ledger transactions (no Stripe SDK). */
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const pageRaw = typeof req.query.page === 'string' ? parseInt(req.query.page, 10) : 1;
    const pageSizeRaw = typeof req.query.pageSize === 'string' ? parseInt(req.query.pageSize, 10) : 20;
    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
    const pageSize = Math.min(100, Math.max(1, Number.isFinite(pageSizeRaw) && pageSizeRaw > 0 ? pageSizeRaw : 20));

    const txs = await prisma.transaction.findMany({
      where: { category: { in: [...PAYMENT_ROW_CATEGORIES] } },
      orderBy: { timestamp: 'desc' },
      select: {
        id: true,
        timestamp: true,
        category: true,
        amount: true,
        description: true,
      },
      take: 8000,
    });

    const byOrder = new Map<
      string,
      { orderId: string; lastAt: Date; lastCategory: string | null; amount: number; lastTxId: string }
    >();
    for (const tx of txs) {
      const oid = extractOrderId(tx.description);
      if (!oid) continue;
      const cur = byOrder.get(oid);
      if (!cur || tx.timestamp > cur.lastAt) {
        byOrder.set(oid, {
          orderId: oid,
          lastAt: tx.timestamp,
          lastCategory: tx.category,
          amount: tx.amount,
          lastTxId: tx.id,
        });
      }
    }

    const sortedIds = [...byOrder.values()].sort((a, b) => b.lastAt.getTime() - a.lastAt.getTime());
    const total = sortedIds.length;
    const slice = sortedIds.slice((page - 1) * pageSize, page * pageSize);
    const orderIds = slice.map((s) => s.orderId);

    const orders = orderIds.length
      ? await prisma.order.findMany({
          where: { id: { in: orderIds } },
          select: {
            id: true,
            customer: {
              select: { id: true, email: true, displayName: true, firstName: true, lastName: true },
            },
            matchedProvider: {
              select: { id: true, email: true, displayName: true, firstName: true, lastName: true },
            },
            matchedWorkspace: { select: { id: true, name: true } },
            serviceCatalog: { select: { id: true, name: true } },
            orderContract: {
              select: {
                currentVersion: { select: { amount: true, currency: true } },
              },
            },
          },
        })
      : [];
    const orderMap = new Map(orders.map((o) => [o.id, o]));

    const items = slice.map((row) => {
      const o = orderMap.get(row.orderId);
      const subtotal =
        o?.orderContract?.currentVersion?.amount ?? row.amount ?? 0;
      const status = statusFromCategory(row.lastCategory);
      return {
        orderId: row.orderId,
        customerName: userDisplayName(o?.customer ?? null),
        providerName: o?.matchedWorkspace?.name?.trim() || userDisplayName(o?.matchedProvider ?? null),
        amount: subtotal,
        currency: o?.orderContract?.currentVersion?.currency ?? 'CAD',
        status,
        date: row.lastAt.toISOString(),
        lastTransactionId: row.lastTxId,
      };
    });

    return res.json({ items, page, pageSize, total });
  } catch (err: unknown) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/orders/:orderId', async (req: AuthRequest, res: Response) => {
  try {
    const orderId = req.params.orderId?.trim();
    if (!orderId) return res.status(400).json({ error: 'orderId is required' });

    const txs = await prisma.transaction.findMany({
      where: {
        category: { in: [...PAYMENT_ROW_CATEGORIES] },
        description: { contains: `order:${orderId}` },
      },
      orderBy: { timestamp: 'asc' },
      select: { id: true, timestamp: true, category: true, amount: true, description: true },
    });
    if (!txs.length) {
      return res.status(404).json({ error: 'No payment records for this order' });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        customer: {
          select: { id: true, email: true, displayName: true, firstName: true, lastName: true },
        },
        matchedProvider: {
          select: { id: true, email: true, displayName: true, firstName: true, lastName: true },
        },
        matchedWorkspace: { select: { id: true, name: true } },
        serviceCatalog: { select: { id: true, name: true } },
        orderContract: {
          select: {
            currentVersion: { select: { amount: true, currency: true } },
          },
        },
      },
    });

    const last = txs[txs.length - 1]!;
    const rowStatus = statusFromCategory(last.category);
    const subtotal = order?.orderContract?.currentVersion?.amount ?? last.amount ?? 0;
    const platformFeeAmount = (subtotal * PLATFORM_FEE_PERCENT) / 100;
    const providerPayout = Math.max(0, subtotal - platformFeeAmount);

    const sessionTx = txs.find((t) => (t.category ?? '').toLowerCase() === 'order_payment_session');
    const captureTx = txs.find((t) => (t.category ?? '').toLowerCase() === 'order_payment_capture');

    const audit = await prisma.auditLog.findMany({
      where: {
        resourceType: 'order',
        resourceId: orderId,
        action: { in: ['PAYMENT_SESSION_CREATED', 'PAYMENT_CAPTURED'] },
      },
      orderBy: { timestamp: 'asc' },
      take: 50,
      include: { actor: { select: { id: true, email: true, displayName: true } } },
    });

    return res.json({
      orderId,
      customerName: userDisplayName(order?.customer ?? null),
      providerName:
        order?.matchedWorkspace?.name?.trim() || userDisplayName(order?.matchedProvider ?? null),
      serviceName: order?.serviceCatalog?.name ?? '—',
      currency: order?.orderContract?.currentVersion?.currency ?? 'CAD',
      status: rowStatus,
      breakdown: {
        subtotal,
        platformFeePercent: PLATFORM_FEE_PERCENT,
        platformFeeAmount,
        providerPayout,
      },
      timeline: {
        sessionCreatedAt: sessionTx?.timestamp.toISOString() ?? null,
        capturedAt: captureTx?.timestamp.toISOString() ?? null,
        settledAt: null as string | null,
      },
      audit,
    });
  } catch (err: unknown) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/ledger', async (req: AuthRequest, res: Response) => {
  try {
    const orderId = typeof req.query.orderId === 'string' ? req.query.orderId.trim() : '';
    const txs = await prisma.transaction.findMany({
      where: {
        category: { in: [...PAYMENT_LEDGER_CATEGORIES] },
        ...(orderId ? { description: { contains: `order:${orderId}` } } : {}),
      },
      include: {
        customer: { select: { id: true, email: true, displayName: true, firstName: true, lastName: true } },
        company: { select: { id: true, name: true } },
      },
      orderBy: { timestamp: 'desc' },
      take: 300,
    });
    const orderIds = [...new Set(txs.map((tx) => extractOrderId(tx.description)).filter(Boolean))] as string[];
    const orders = orderIds.length
      ? await prisma.order.findMany({
          where: { id: { in: orderIds } },
          select: {
            id: true,
            status: true,
            phase: true,
            orderContract: {
              select: {
                currentVersionId: true,
                currentVersion: { select: { status: true, amount: true, currency: true } },
              },
            },
          },
        })
      : [];
    const orderMap = new Map(orders.map((o) => [o.id, o]));
    return res.json({
      items: txs.map((tx) => {
        const resolvedOrderId = extractOrderId(tx.description);
        return {
          id: tx.id,
          timestamp: tx.timestamp,
          category: tx.category,
          amount: tx.amount,
          type: tx.type,
          description: tx.description,
          customer: tx.customer,
          company: tx.company,
          order: resolvedOrderId ? orderMap.get(resolvedOrderId) ?? null : null,
        };
      }),
    });
  } catch (err: unknown) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/ledger/:transactionId', async (req: AuthRequest, res: Response) => {
  try {
    const transactionId = req.params.transactionId;
    if (!transactionId) return res.status(400).json({ error: 'transactionId is required' });
    const tx = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        customer: { select: { id: true, email: true, displayName: true, firstName: true, lastName: true } },
        company: { select: { id: true, name: true } },
      },
    });
    if (!tx || ![...PAYMENT_LEDGER_CATEGORIES].includes((tx.category ?? '') as (typeof PAYMENT_LEDGER_CATEGORIES)[number])) {
      return res.status(404).json({ error: 'Payment ledger record not found' });
    }
    const orderId = extractOrderId(tx.description);
    const order = orderId
      ? await prisma.order.findUnique({
          where: { id: orderId },
          include: {
            orderContract: {
              include: {
                currentVersion: true,
                versions: { orderBy: { versionNumber: 'desc' }, take: 20 },
                events: { orderBy: { createdAt: 'desc' }, take: 50 },
              },
            },
          },
        })
      : null;
    const audit = await prisma.auditLog.findMany({
      where: { resourceType: 'order', resourceId: orderId ?? '' },
      orderBy: { timestamp: 'desc' },
      take: 100,
      include: { actor: { select: { id: true, email: true, displayName: true } } },
    });
    return res.json({ transaction: tx, order, audit });
  } catch (err: unknown) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/commission/summary', async (req: AuthRequest, res: Response) => {
  try {
    const periodStart = typeof req.query.periodStart === 'string' ? new Date(req.query.periodStart) : undefined;
    const periodEnd = typeof req.query.periodEnd === 'string' ? new Date(req.query.periodEnd) : undefined;

    const summary = await getCommissionSummary(periodStart, periodEnd);
    return res.json({ data: summary });
  } catch (err: unknown) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/commission/by-provider', async (req: AuthRequest, res: Response) => {
  try {
    const periodStart = typeof req.query.periodStart === 'string' ? new Date(req.query.periodStart) : undefined;
    const periodEnd = typeof req.query.periodEnd === 'string' ? new Date(req.query.periodEnd) : undefined;

    const byProvider = await getCommissionByProvider(periodStart, periodEnd);
    return res.json({ data: byProvider });
  } catch (err: unknown) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /admin/payments/stripe-workspaces — Stripe Connect overview
router.get('/stripe-workspaces', async (req: AuthRequest, res: Response) => {
  try {
    const workspaces = await prisma.company.findMany({
      where: {
        stripeEnabled: true,
        stripeAccountId: { not: null },
      },
      select: {
        id: true,
        name: true,
        stripeAccountId: true,
        stripeEnabled: true,
        stripeChargesEnabled: true,
        stripePayoutsEnabled: true,
        paypalEnabled: true,
        paypalEmail: true,
        interacEnabled: true,
        squareEnabled: true,
        _count: {
          select: { ordersAsMatchedWorkspace: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    const workspaceIds = workspaces.map((w) => w.id);
    const payments = workspaceIds.length
      ? await prisma.payment.findMany({
          where: {
            order: { matchedWorkspaceId: { in: workspaceIds } },
            status: 'captured',
          },
          select: {
            commission: true,
            order: { select: { matchedWorkspaceId: true } },
          },
        })
      : [];

    const commissionByWorkspace = new Map<string, number>();
    for (const p of payments) {
      const wid = p.order.matchedWorkspaceId;
      commissionByWorkspace.set(wid, (commissionByWorkspace.get(wid) ?? 0) + p.commission);
    }

    res.json({
      data: workspaces.map((w) => ({
        id: w.id,
        name: w.name,
        stripeAccountId: w.stripeAccountId,
        stripeEnabled: w.stripeEnabled,
        chargesEnabled: w.stripeChargesEnabled,
        payoutsEnabled: w.stripePayoutsEnabled,
        paypalEnabled: w.paypalEnabled,
        paypalEmail: w.paypalEmail,
        interacEnabled: w.interacEnabled,
        squareEnabled: w.squareEnabled,
        totalOrders: w._count.ordersAsMatchedWorkspace,
        totalCommission: commissionByWorkspace.get(w.id) ?? 0,
      })),
    });
  } catch (err: unknown) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /admin/payments/failed-payouts — Failed payouts
router.get('/failed-payouts', async (req: AuthRequest, res: Response) => {
  try {
    const failedPayments = await prisma.payment.findMany({
      where: {
        status: 'failed',
      },
      include: {
        order: {
          select: {
            id: true,
            customer: { select: { id: true, displayName: true, email: true } },
            matchedWorkspace: { select: { id: true, name: true } },
            serviceCatalog: { select: { name: true } },
            orderContract: {
              select: { currentVersion: { select: { amount: true, currency: true } } },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });

    res.json({
      data: failedPayments.map((p) => ({
        paymentId: p.id,
        orderId: p.orderId,
        customerName: p.order?.customer?.displayName ?? '—',
        workspaceName: p.order?.matchedWorkspace?.name ?? '—',
        serviceName: p.order?.serviceCatalog?.name ?? '—',
        amount: p.order?.orderContract?.currentVersion?.amount ?? p.amount ?? 0,
        currency: p.order?.orderContract?.currentVersion?.currency ?? 'CAD',
        commission: p.commission,
        failedAt: p.updatedAt.toISOString(),
        stripePaymentIntentId: p.stripePaymentIntentId,
      })),
    });
  } catch (err: unknown) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /admin/payments/manual-commission — Manual commission entry
const manualCommissionSchema = z.object({
  workspaceId: z.string().min(1),
  orderId: z.string().min(1),
  amount: z.number().int().positive(),
  notes: z.string().optional(),
});

router.post('/manual-commission', async (req: AuthRequest, res: Response) => {
  try {
    const input = manualCommissionSchema.parse(req.body);

    const payment = await prisma.payment.findUnique({
      where: { orderId: input.orderId },
    });

    if (!payment) {
      return res.status(404).json({ error: 'Payment record not found for this order' });
    }

    const updated = await prisma.payment.update({
      where: { orderId: input.orderId },
      data: {
        commission: input.amount,
        deduction: payment.amount - input.amount,
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: req.user!.userId,
        action: 'MANUAL_COMMISSION_SET',
        resourceType: 'payment',
        resourceId: payment.id,
        metadata: {
          orderId: input.orderId,
          workspaceId: input.workspaceId,
          commission: input.amount,
          notes: input.notes ?? null,
        },
      },
    });

    res.json({
      data: {
        id: updated.id,
        orderId: updated.orderId,
        amount: updated.amount,
        commission: updated.commission,
        deduction: updated.deduction,
        status: updated.status,
      },
    });
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Invalid input', details: err.flatten() });
    }
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /admin/payments/:orderId/refund — Stripe-powered refund (admin only)
const refundSchema = z.object({
  reason: z.string().optional(),
  amount: z.number().int().positive().optional(),
});

router.post('/:orderId/refund', async (req: AuthRequest, res: Response) => {
  try {
    const orderId = req.params.orderId?.trim();
    if (!orderId) {
      return res.status(400).json({ code: 'MISSING_ORDER_ID', message: 'orderId is required' });
    }

    const input = refundSchema.parse(req.body);

    const result = await refundPaymentForOrder({
      orderId,
      adminId: req.user!.userId,
      reason: input.reason,
      amount: input.amount ?? null,
    });

    return res.json({
      data: {
        orderId,
        status: result.payment.status,
        amount: result.payment.amount,
        deduction: result.payment.deduction,
        commission: result.payment.commission,
        refundedAt: new Date().toISOString(),
        stripeRefundId: result.refundResult.refundId,
        stripeError: result.refundResult.error,
      },
    });
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Invalid input', details: err.flatten() });
    }
    if (err instanceof Error) {
      const status = err.message === 'No payment record found' ? 404 : 400;
      return res.status(status).json({ code: 'REFUND_FAILED', message: err.message });
    }
    console.error(err);
    return res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// POST /admin/payments/:orderId/stripe-payout — Stripe Connect payout to provider
const payoutSchema = z.object({
  stripeAccountId: z.string().min(1, 'stripeAccountId is required'),
});

router.post('/:orderId/stripe-payout', async (req: AuthRequest, res: Response) => {
  try {
    const orderId = req.params.orderId?.trim();
    if (!orderId) {
      return res.status(400).json({ code: 'MISSING_ORDER_ID', message: 'orderId is required' });
    }

    const input = payoutSchema.parse(req.body);

    const payment = await prisma.payment.findUnique({ where: { orderId } });
    if (!payment) {
      return res.status(404).json({ code: 'NOT_FOUND', message: 'No payment record found for this order' });
    }

    if (!payment.stripePaymentIntentId) {
      return res.status(400).json({ code: 'NO_STRIPE_PI', message: 'No Stripe PaymentIntent associated — payment was likely internal only' });
    }

    // Best-effort: create payout via Stripe
    const { createPayoutToProvider } = await import('../lib/stripeService.js');
    const payoutResult = await createPayoutToProvider({
      amount: payment.deduction,
      currency: 'cad',
      stripeAccountId: input.stripeAccountId,
      paymentIntentId: payment.stripePaymentIntentId,
      orderId,
    });

    res.json({
      data: {
        orderId,
        payoutAmount: payment.deduction,
        status: payoutResult.success ? 'transferred' : 'failed',
        transferId: payoutResult.transferId,
        error: payoutResult.error,
      },
    });
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Invalid input', details: err.flatten() });
    }
    console.error(err);
    return res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

export default router;
