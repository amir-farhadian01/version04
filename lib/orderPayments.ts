import { ContractVersionStatus, OrderStatus, PaymentStatus, type Payment, type Transaction } from '@prisma/client';
import prisma from './db.js';

export const PAYMENT_GATE_CODE_CONTRACT_APPROVAL_REQUIRED = 'CONTRACT_APPROVAL_REQUIRED';

export type PaymentGateResult =
  | {
      ok: true;
      orderId: string;
      amount: number;
      currency: string;
      contractVersionId: string;
    }
  | {
      ok: false;
      code: typeof PAYMENT_GATE_CODE_CONTRACT_APPROVAL_REQUIRED;
      message: string;
    };

export type OrderPaymentSummary = {
  status: 'none' | 'session_created' | 'paid';
  lastTransactionId: string | null;
  lastAmount: number | null;
  currency: string | null;
  lastCreatedAt: string | null;
};

function parseOrderPayment(tx: Transaction): { kind: 'session' | 'capture'; currency: string | null } {
  const category = (tx.category ?? '').toLowerCase();
  if (category === 'order_payment_capture') {
    const m = /currency:([A-Z]{3})/.exec(tx.description ?? '');
    return { kind: 'capture', currency: m?.[1] ?? null };
  }
  const m = /currency:([A-Z]{3})/.exec(tx.description ?? '');
  return { kind: 'session', currency: m?.[1] ?? null };
}

export async function evaluateOrderPaymentGate(orderId: string): Promise<PaymentGateResult> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      matchedPackage: { select: { finalPrice: true, currency: true } },
      orderContract: {
        include: {
          currentVersion: {
            select: { id: true, status: true, amount: true, currency: true },
          },
        },
      },
    },
  });
  if (!order || !order.orderContract?.currentVersion) {
    return {
      ok: false,
      code: PAYMENT_GATE_CODE_CONTRACT_APPROVAL_REQUIRED,
      message: 'Payment is locked until an approved contract version is current for this order.',
    };
  }
  const current = order.orderContract.currentVersion;
  const statusOk = new Set<OrderStatus>([
    OrderStatus.contracted,
    OrderStatus.paid,
    OrderStatus.in_progress,
    OrderStatus.completed,
    OrderStatus.closed,
  ]).has(order.status);
  if (!statusOk || current.status !== ContractVersionStatus.approved) {
    return {
      ok: false,
      code: PAYMENT_GATE_CODE_CONTRACT_APPROVAL_REQUIRED,
      message: 'Payment is locked until order is contracted from an approved contract version.',
    };
  }
  const amount = current.amount ?? order.matchedPackage?.finalPrice ?? 0;
  const currency = current.currency ?? order.matchedPackage?.currency ?? 'CAD';
  return {
    ok: true,
    orderId: order.id,
    amount,
    currency,
    contractVersionId: current.id,
  };
}

export async function getOrderPaymentSummary(orderId: string): Promise<OrderPaymentSummary> {
  const txs = await prisma.transaction.findMany({
    where: {
      category: { in: ['order_payment_session', 'order_payment_capture'] },
      description: { contains: `order:${orderId}` },
    },
    orderBy: { timestamp: 'desc' },
    take: 20,
  });
  if (!txs.length) {
    return {
      status: 'none',
      lastTransactionId: null,
      lastAmount: null,
      currency: null,
      lastCreatedAt: null,
    };
  }
  const latest = txs[0]!;
  const parsed = parseOrderPayment(latest);
  return {
    status: parsed.kind === 'capture' ? 'paid' : 'session_created',
    lastTransactionId: latest.id,
    lastAmount: latest.amount,
    currency: parsed.currency,
    lastCreatedAt: latest.timestamp.toISOString(),
  };
}

/**
 * Create a Payment record when an order reaches `contracted` state.
 * All monetary values are in cents (integers).
 * Default commission is 15% of the amount.
 */
export async function createEscrowPayment(
  orderId: string,
  amount: number,
  commissionPercent: number = 15,
): Promise<Payment> {
  try {
    const commission = Math.round(amount * commissionPercent / 100);
    const deduction = amount - commission;

    const payment = await prisma.payment.create({
      data: {
        orderId,
        amount,
        commission,
        deduction,
        status: PaymentStatus.pending,
      },
    });

    return payment;
  } catch (error) {
    throw new Error(
      `Failed to create escrow payment for order ${orderId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
}

/**
 * Capture payment when customer pays (order transitions to `paid`).
 * Optionally associates a Stripe PaymentIntent ID.
 */
export async function captureEscrowPayment(
  orderId: string,
  stripePaymentIntentId?: string,
): Promise<Payment> {
  try {
    const existing = await prisma.payment.findUnique({ where: { orderId } });

    if (!existing) {
      throw new Error('No payment record found for this order');
    }

    if (existing.status !== PaymentStatus.pending) {
      throw new Error('Payment cannot be captured in its current state');
    }

    const payment = await prisma.payment.update({
      where: { orderId },
      data: {
        status: PaymentStatus.captured,
        stripePaymentIntentId: stripePaymentIntentId ?? null,
      },
    });

    return payment;
  } catch (error) {
    if (error instanceof Error && error.message !== 'No payment record found for this order' && error.message !== 'Payment cannot be captured in its current state') {
      throw new Error(
        `Failed to capture escrow payment for order ${orderId}: ${error.message}`,
      );
    }
    throw error;
  }
}

/**
 * Mark payment for release when provider completes the job (order transitions to `completed`).
 * Sets escrowReleaseAt to 48 hours from now.
 */
export async function releaseEscrowPayment(orderId: string): Promise<Payment> {
  try {
    const existing = await prisma.payment.findUnique({ where: { orderId } });

    if (!existing) {
      throw new Error('No payment record found for this order');
    }

    if (existing.status !== PaymentStatus.captured) {
      throw new Error('Only captured payments can be released');
    }

    const escrowReleaseAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

    const payment = await prisma.payment.update({
      where: { orderId },
      data: { escrowReleaseAt },
    });

    return payment;
  } catch (error) {
    if (error instanceof Error && error.message !== 'No payment record found for this order' && error.message !== 'Only captured payments can be released') {
      throw new Error(
        `Failed to release escrow payment for order ${orderId}: ${error.message}`,
      );
    }
    throw error;
  }
}

/**
 * Refund payment when order is cancelled after being paid.
 * Only captured payments can be refunded.
 */
export async function refundEscrowPayment(orderId: string): Promise<Payment> {
  try {
    const existing = await prisma.payment.findUnique({ where: { orderId } });

    if (!existing) {
      throw new Error('No payment record found for this order');
    }

    if (existing.status !== PaymentStatus.captured) {
      throw new Error('Only captured payments can be refunded');
    }

    const payment = await prisma.payment.update({
      where: { orderId },
      data: { status: PaymentStatus.refunded },
    });

    return payment;
  } catch (error) {
    if (error instanceof Error && error.message !== 'No payment record found for this order' && error.message !== 'Only captured payments can be refunded') {
      throw new Error(
        `Failed to refund escrow payment for order ${orderId}: ${error.message}`,
      );
    }
    throw error;
  }
}
