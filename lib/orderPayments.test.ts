import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/db.js', () => ({
  default: {
    payment: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import prisma from '../lib/db.js';
import {
  createEscrowPayment,
  captureEscrowPayment,
  releaseEscrowPayment,
  refundEscrowPayment,
} from './orderPayments.js';

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// createEscrowPayment
// ---------------------------------------------------------------------------
describe('createEscrowPayment', () => {
  it('creates a payment with default 15% commission', async () => {
    const mockPayment = {
      id: 'pay_1',
      orderId: 'order_1',
      amount: 10000,
      commission: 1500,
      deduction: 8500,
      status: 'pending',
    };
    vi.mocked(prisma.payment.create).mockResolvedValue(mockPayment as any);

    const result = await createEscrowPayment('order_1', 10000);

    expect(prisma.payment.create).toHaveBeenCalledWith({
      data: {
        orderId: 'order_1',
        amount: 10000,
        commission: 1500,
        deduction: 8500,
        status: 'pending',
      },
    });
    expect(result).toEqual(mockPayment);
  });

  it('creates a payment with custom commission percent', async () => {
    const mockPayment = {
      id: 'pay_2',
      orderId: 'order_1',
      amount: 10000,
      commission: 1000,
      deduction: 9000,
      status: 'pending',
    };
    vi.mocked(prisma.payment.create).mockResolvedValue(mockPayment as any);

    const result = await createEscrowPayment('order_1', 10000, 10);

    expect(prisma.payment.create).toHaveBeenCalledWith({
      data: {
        orderId: 'order_1',
        amount: 10000,
        commission: 1000,
        deduction: 9000,
        status: 'pending',
      },
    });
    expect(result).toEqual(mockPayment);
  });

  it('rounds commission correctly', async () => {
    const mockPayment = {
      id: 'pay_3',
      orderId: 'order_1',
      amount: 100,
      commission: 15,
      deduction: 85,
      status: 'pending',
    };
    vi.mocked(prisma.payment.create).mockResolvedValue(mockPayment as any);

    const result = await createEscrowPayment('order_1', 100, 15);

    expect(prisma.payment.create).toHaveBeenCalledWith({
      data: {
        orderId: 'order_1',
        amount: 100,
        commission: 15,
        deduction: 85,
        status: 'pending',
      },
    });
    expect(result).toEqual(mockPayment);
  });

  it('throws when prisma create fails', async () => {
    vi.mocked(prisma.payment.create).mockRejectedValue(new Error('DB error'));

    await expect(createEscrowPayment('order_1', 10000)).rejects.toThrow(
      'Failed to create escrow payment for order order_1: DB error',
    );
  });
});

// ---------------------------------------------------------------------------
// captureEscrowPayment
// ---------------------------------------------------------------------------
describe('captureEscrowPayment', () => {
  it('captures a pending payment', async () => {
    vi.mocked(prisma.payment.findUnique).mockResolvedValue({
      id: 'pay_1',
      orderId: 'order_1',
      status: 'pending',
    } as any);

    const updatedPayment = {
      id: 'pay_1',
      orderId: 'order_1',
      status: 'captured',
      stripePaymentIntentId: null,
    };
    vi.mocked(prisma.payment.update).mockResolvedValue(updatedPayment as any);

    const result = await captureEscrowPayment('order_1');

    expect(prisma.payment.update).toHaveBeenCalledWith({
      where: { orderId: 'order_1' },
      data: {
        status: 'captured',
        stripePaymentIntentId: null,
      },
    });
    expect(result).toEqual(updatedPayment);
  });

  it('stores stripePaymentIntentId when provided', async () => {
    vi.mocked(prisma.payment.findUnique).mockResolvedValue({
      id: 'pay_1',
      orderId: 'order_1',
      status: 'pending',
    } as any);

    const updatedPayment = {
      id: 'pay_1',
      orderId: 'order_1',
      status: 'captured',
      stripePaymentIntentId: 'pi_123',
    };
    vi.mocked(prisma.payment.update).mockResolvedValue(updatedPayment as any);

    const result = await captureEscrowPayment('order_1', 'pi_123');

    expect(prisma.payment.update).toHaveBeenCalledWith({
      where: { orderId: 'order_1' },
      data: {
        status: 'captured',
        stripePaymentIntentId: 'pi_123',
      },
    });
    expect(result).toEqual(updatedPayment);
  });

  it('throws when payment not found', async () => {
    vi.mocked(prisma.payment.findUnique).mockResolvedValue(null);

    await expect(captureEscrowPayment('order_1')).rejects.toThrow(
      'No payment record found for this order',
    );
  });

  it('throws when payment is not pending', async () => {
    vi.mocked(prisma.payment.findUnique).mockResolvedValue({
      id: 'pay_1',
      orderId: 'order_1',
      status: 'captured',
    } as any);

    await expect(captureEscrowPayment('order_1')).rejects.toThrow(
      'Payment cannot be captured in its current state',
    );
  });
});

// ---------------------------------------------------------------------------
// releaseEscrowPayment
// ---------------------------------------------------------------------------
describe('releaseEscrowPayment', () => {
  it('sets escrowReleaseAt to 48 hours from now', async () => {
    const now = Date.now();
    vi.setSystemTime(now);

    vi.mocked(prisma.payment.findUnique).mockResolvedValue({
      id: 'pay_1',
      orderId: 'order_1',
      status: 'captured',
    } as any);

    const updatedPayment = {
      id: 'pay_1',
      orderId: 'order_1',
      status: 'captured',
      escrowReleaseAt: new Date(now + 48 * 60 * 60 * 1000),
    };
    vi.mocked(prisma.payment.update).mockResolvedValue(updatedPayment as any);

    const result = await releaseEscrowPayment('order_1');

    expect(prisma.payment.update).toHaveBeenCalledWith({
      where: { orderId: 'order_1' },
      data: { escrowReleaseAt: expect.any(Date) },
    });

    const calledArg = vi.mocked(prisma.payment.update).mock.calls[0][0];
    const releaseAt = (calledArg as any).data.escrowReleaseAt as Date;
    const diff = releaseAt.getTime() - now;
    // Allow a small tolerance for test execution time
    expect(diff).toBeGreaterThanOrEqual(48 * 60 * 60 * 1000 - 100);
    expect(diff).toBeLessThanOrEqual(48 * 60 * 60 * 1000 + 100);

    expect(result).toEqual(updatedPayment);
  });

  it('throws when payment not found', async () => {
    vi.mocked(prisma.payment.findUnique).mockResolvedValue(null);

    await expect(releaseEscrowPayment('order_1')).rejects.toThrow(
      'No payment record found for this order',
    );
  });

  it('throws when payment is not captured', async () => {
    vi.mocked(prisma.payment.findUnique).mockResolvedValue({
      id: 'pay_1',
      orderId: 'order_1',
      status: 'pending',
    } as any);

    await expect(releaseEscrowPayment('order_1')).rejects.toThrow(
      'Only captured payments can be released',
    );
  });
});

// ---------------------------------------------------------------------------
// refundEscrowPayment
// ---------------------------------------------------------------------------
describe('refundEscrowPayment', () => {
  it('refunds a captured payment', async () => {
    vi.mocked(prisma.payment.findUnique).mockResolvedValue({
      id: 'pay_1',
      orderId: 'order_1',
      status: 'captured',
    } as any);

    const updatedPayment = {
      id: 'pay_1',
      orderId: 'order_1',
      status: 'refunded',
    };
    vi.mocked(prisma.payment.update).mockResolvedValue(updatedPayment as any);

    const result = await refundEscrowPayment('order_1');

    expect(prisma.payment.update).toHaveBeenCalledWith({
      where: { orderId: 'order_1' },
      data: { status: 'refunded' },
    });
    expect(result).toEqual(updatedPayment);
  });

  it('throws when payment not found', async () => {
    vi.mocked(prisma.payment.findUnique).mockResolvedValue(null);

    await expect(refundEscrowPayment('order_1')).rejects.toThrow(
      'No payment record found for this order',
    );
  });

  it('throws when payment is not captured', async () => {
    vi.mocked(prisma.payment.findUnique).mockResolvedValue({
      id: 'pay_1',
      orderId: 'order_1',
      status: 'pending',
    } as any);

    await expect(refundEscrowPayment('order_1')).rejects.toThrow(
      'Only captured payments can be refunded',
    );
  });
});
