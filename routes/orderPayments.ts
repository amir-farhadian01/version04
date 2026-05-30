import { Router, type Response } from 'express';
import { OrderStatus, Prisma } from '@prisma/client';
import prisma from '../lib/db.js';
import { authenticate, type AuthRequest } from '../lib/auth.middleware.js';
import {
  notifyPaymentCaptured,
  notifyPaymentFailed,
} from '../lib/orderLifecycleNotifications.js';
import {
  evaluateOrderPaymentGate,
  getOrderPaymentSummary,
  createEscrowPayment,
  captureEscrowPayment,
  PAYMENT_GATE_CODE_CONTRACT_APPROVAL_REQUIRED,
} from '../lib/orderPayments.js';
import { phaseFromStatus } from '../lib/orderPhase.js';
import { assertWorkspaceMember, WorkspaceAccessError } from '../lib/workspaceAccess.js';
import { userHasActiveInboxAttemptForOrder } from '../lib/orderNegotiationAccess.js';

const router = Router({ mergeParams: true });
router.use(authenticate);

const STAFF_ROLES = new Set(['owner', 'platform_admin', 'support', 'finance']);

type PaymentStatusAudience = 'deny' | 'full' | 'inbox_preview';

async function paymentStatusAudience(
  order: { id: string; customerId: string; matchedProviderId: string | null; matchedWorkspaceId: string | null },
  req: AuthRequest,
): Promise<PaymentStatusAudience> {
  const uid = req.user?.userId;
  const role = req.user?.role;
  if (!uid || !role) return 'deny';
  if (uid === order.customerId || uid === order.matchedProviderId || STAFF_ROLES.has(role)) return 'full';
  if (order.matchedWorkspaceId) {
    try {
      await assertWorkspaceMember(uid, order.matchedWorkspaceId);
      return 'full';
    } catch (e) {
      if (e instanceof WorkspaceAccessError) {
        // not a member of matched workspace — may still be an invited inbox workspace
      } else {
        throw e;
      }
    }
  }
  if (!order.matchedProviderId && (await userHasActiveInboxAttemptForOrder(uid, order.id))) {
    return 'inbox_preview';
  }
  return 'deny';
}

router.get('/status', async (req: AuthRequest, res: Response) => {
  try {
    const orderId = req.params.orderId;
    if (!orderId) return res.status(400).json({ error: 'orderId is required' });
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, customerId: true, matchedProviderId: true, matchedWorkspaceId: true },
    });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    const audience = await paymentStatusAudience(order, req);
    if (audience === 'deny') return res.status(403).json({ error: 'Forbidden' });
    if (audience === 'inbox_preview') {
      return res.json({
        orderId,
        readOnly: true,
        code: 'PAYMENT_CUSTOMER_AFTER_CONTRACT',
        lockReason:
          'Payment sessions are created by the customer after contract approval (ADR-0048). Status details appear here once your workspace is matched and the order advances.',
        orderStatus: 'pending_contract_approval',
        approvedContractVersionId: null,
        payment: null,
      });
    }
    const gate = await evaluateOrderPaymentGate(orderId);
    const payment = await getOrderPaymentSummary(orderId);

    // Include escrow payment info
    let escrowPayment = null;
    try {
      const p = await prisma.payment.findUnique({ where: { orderId } });
      if (p) {
        escrowPayment = {
          id: p.id,
          amount: p.amount,
          commission: p.commission,
          deduction: p.deduction,
          status: p.status,
          escrowReleaseAt: p.escrowReleaseAt?.toISOString() ?? null,
          createdAt: p.createdAt.toISOString(),
        };
      }
    } catch {
      // non-fatal — escrow info is supplementary
    }

    return res.json({
      orderId,
      orderStatus: gate.ok ? 'contracted' : 'pending_contract_approval',
      approvedContractVersionId: gate.ok ? gate.contractVersionId : null,
      payment:
        payment.status === 'none'
          ? null
          : {
              id: payment.lastTransactionId ?? '',
              amount: payment.lastAmount ?? 0,
              status: payment.status === 'paid' ? 'paid' : 'pending',
              kind: payment.status === 'paid' ? 'capture' : 'session',
              timestamp: payment.lastCreatedAt ?? new Date().toISOString(),
            },
      escrow: escrowPayment,
    });
  } catch (err: unknown) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/session', async (req: AuthRequest, res: Response) => {
  try {
    const orderId = req.params.orderId;
    const userId = req.user!.userId;
    if (!orderId) return res.status(400).json({ error: 'orderId is required' });
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, customerId: true, matchedWorkspaceId: true },
    });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.customerId !== userId) return res.status(403).json({ error: 'Only the customer can create payment sessions' });

    const gate = await evaluateOrderPaymentGate(orderId);
    if (gate.ok === false) {
      return res.status(409).json({
        error: gate.message,
        code: PAYMENT_GATE_CODE_CONTRACT_APPROVAL_REQUIRED,
      });
    }
    const sessionToken = `${orderId}.${Date.now().toString(36)}`;
    const checkoutUrl = `/payments/mock-checkout?orderId=${encodeURIComponent(orderId)}&session=${sessionToken}`;

    await prisma.$transaction(async (tx) => {
      await tx.transaction.create({
        data: {
          type: 'income',
          amount: gate.amount,
          category: 'order_payment_session',
          description: `order:${orderId}|contractVersion:${gate.contractVersionId}|currency:${gate.currency}|session:${sessionToken}`,
          customerId: order.customerId,
          companyId: order.matchedWorkspaceId ?? undefined,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: 'PAYMENT_SESSION_CREATED',
          resourceType: 'order',
          resourceId: orderId,
          metadata: {
            amount: gate.amount,
            currency: gate.currency,
            contractVersionId: gate.contractVersionId,
            sessionToken,
          } as Prisma.InputJsonValue,
        },
      });
    });

    // Create escrow payment record if not exists
    try {
      const existingPayment = await prisma.payment.findUnique({ where: { orderId } });
      if (!existingPayment) {
        await createEscrowPayment(orderId, gate.amount);
      }
    } catch (escrowErr) {
      console.error('Failed to create escrow payment record:', escrowErr);
      // non-fatal — escrow record creation is supplementary
    }

    return res.json({
      session: {
        id: sessionToken,
        status: 'pending',
        paymentUrl: checkoutUrl,
        amount: gate.amount,
        currency: gate.currency,
        createdAt: new Date().toISOString(),
      },
    });
  } catch (err: unknown) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/confirm', async (req: AuthRequest, res: Response) => {
  try {
    const orderId = req.params.orderId;
    const userId = req.user!.userId;
    if (!orderId) return res.status(400).json({ error: 'orderId is required' });
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, customerId: true, matchedWorkspaceId: true, phase: true },
    });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.customerId !== userId && !STAFF_ROLES.has(req.user!.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const gate = await evaluateOrderPaymentGate(orderId);
    if (gate.ok === false) {
      return res.status(409).json({
        error: gate.message,
        code: PAYMENT_GATE_CODE_CONTRACT_APPROVAL_REQUIRED,
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.transaction.create({
        data: {
          type: 'income',
          amount: gate.amount,
          category: 'order_payment_capture',
          description: `order:${orderId}|contractVersion:${gate.contractVersionId}|currency:${gate.currency}|capturedAt:${new Date().toISOString()}`,
          customerId: order.customerId,
          companyId: order.matchedWorkspaceId ?? undefined,
        },
      });
      await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.paid, phase: phaseFromStatus(OrderStatus.paid, order.phase) },
      });
      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: 'PAYMENT_CAPTURED',
          resourceType: 'order',
          resourceId: orderId,
          metadata: {
            amount: gate.amount,
            currency: gate.currency,
            contractVersionId: gate.contractVersionId,
          } as Prisma.InputJsonValue,
        },
      });
    });

    // Capture escrow payment (non-fatal if it fails)
    try {
      await captureEscrowPayment(orderId);
    } catch (escrowErr) {
      console.error('Failed to capture escrow payment:', escrowErr);
      // non-fatal — order is already marked paid
    }

    // Notify customer that payment was captured (non-fatal)
    try {
      await notifyPaymentCaptured(orderId, gate.amount);
    } catch (notifyErr) {
      console.error('Failed to notify payment captured:', notifyErr);
      // non-fatal — payment is already captured
    }

    return res.json({ ok: true, orderId, status: 'paid' });
  } catch (err: unknown) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
