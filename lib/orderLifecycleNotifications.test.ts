import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/db.js', () => ({
  default: {
    order: {
      findUnique: vi.fn(),
    },
    notification: {
      create: vi.fn(),
    },
  },
}));

vi.mock('../lib/bus.js', () => ({
  publish: vi.fn(),
}));

import prisma from '../lib/db.js';
import { publish } from '../lib/bus.js';
import {
  notifyPaymentCaptured,
  notifyEscrowReleased,
  notifyPaymentRefunded,
  notifyPaymentFailed,
} from './orderLifecycleNotifications.js';

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// notifyPaymentCaptured
// ---------------------------------------------------------------------------
describe('notifyPaymentCaptured', () => {
  it('creates notification and publishes event', async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue({
      id: 'order-1',
      customerId: 'customer-1',
      serviceCatalog: { name: 'House Cleaning' },
    } as any);

    await notifyPaymentCaptured('order-1', 10000);

    expect(prisma.order.findUnique).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      select: { id: true, customerId: true, serviceCatalog: { select: { name: true } } },
    });

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: {
        userId: 'customer-1',
        title: 'Payment captured',
        message: 'Your payment of $100.00 for House Cleaning has been captured successfully.',
        type: 'payment_captured',
        link: '/orders/order-1',
      },
    });

    expect(publish).toHaveBeenCalledWith('payment.captured', { orderId: 'order-1', amount: 10000 });
  });

  it('returns early when orderId is empty', async () => {
    await notifyPaymentCaptured('', 10000);
    expect(prisma.order.findUnique).not.toHaveBeenCalled();
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('returns early when order is not found', async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue(null);

    await notifyPaymentCaptured('order-nonexistent', 10000);

    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('handles prisma failure gracefully', async () => {
    vi.mocked(prisma.order.findUnique).mockRejectedValue(new Error('DB connection lost'));

    await expect(notifyPaymentCaptured('order-1', 10000)).rejects.toThrow('DB connection lost');
  });
});

// ---------------------------------------------------------------------------
// notifyEscrowReleased
// ---------------------------------------------------------------------------
describe('notifyEscrowReleased', () => {
  it('creates notification for provider and publishes event', async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue({
      id: 'order-1',
      matchedProviderId: 'provider-1',
      matchedWorkspace: {
        ownerId: 'owner-1',
        members: [{ userId: 'member-1' }, { userId: 'member-2' }],
      },
    } as any);

    await notifyEscrowReleased('order-1', 50000);

    expect(prisma.order.findUnique).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      select: {
        id: true,
        matchedProviderId: true,
        matchedWorkspace: {
          select: {
            ownerId: true,
            members: { select: { userId: true } },
          },
        },
      },
    });

    // Should create notifications for provider-1, owner-1, member-1, member-2
    expect(prisma.notification.create).toHaveBeenCalledTimes(4);

    // Check one of the calls
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: {
        userId: 'provider-1',
        title: 'Escrow released',
        message: 'Escrow funds of $500.00 for a completed order have been released to your account.',
        type: 'escrow_released',
        link: '/orders/order-1',
      },
    });

    expect(publish).toHaveBeenCalledWith('escrow.released', { orderId: 'order-1', amount: 50000 });
  });

  it('returns early when orderId is empty', async () => {
    await notifyEscrowReleased('', 50000);
    expect(prisma.order.findUnique).not.toHaveBeenCalled();
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('returns early when order is not found', async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue(null);

    await notifyEscrowReleased('order-nonexistent', 50000);

    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('handles prisma failure gracefully', async () => {
    vi.mocked(prisma.order.findUnique).mockRejectedValue(new Error('DB connection lost'));

    await expect(notifyEscrowReleased('order-1', 50000)).rejects.toThrow('DB connection lost');
  });
});

// ---------------------------------------------------------------------------
// notifyPaymentRefunded
// ---------------------------------------------------------------------------
describe('notifyPaymentRefunded', () => {
  it('creates notification and publishes event', async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue({
      id: 'order-1',
      customerId: 'customer-1',
      serviceCatalog: { name: 'House Cleaning' },
    } as any);

    await notifyPaymentRefunded('order-1', 10000, 'Customer requested cancellation');

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: {
        userId: 'customer-1',
        title: 'Payment refunded',
        message: 'Your payment of $100.00 for House Cleaning has been refunded. Reason: Customer requested cancellation',
        type: 'payment_refunded',
        link: '/orders/order-1',
      },
    });

    expect(publish).toHaveBeenCalledWith('payment.refunded', {
      orderId: 'order-1',
      amount: 10000,
      reason: 'Customer requested cancellation',
    });
  });

  it('works without a reason', async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue({
      id: 'order-1',
      customerId: 'customer-1',
      serviceCatalog: { name: 'House Cleaning' },
    } as any);

    await notifyPaymentRefunded('order-1', 10000);

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: {
        userId: 'customer-1',
        title: 'Payment refunded',
        message: 'Your payment of $100.00 for House Cleaning has been refunded.',
        type: 'payment_refunded',
        link: '/orders/order-1',
      },
    });

    expect(publish).toHaveBeenCalledWith('payment.refunded', {
      orderId: 'order-1',
      amount: 10000,
      reason: undefined,
    });
  });

  it('returns early when orderId is empty', async () => {
    await notifyPaymentRefunded('', 10000);
    expect(prisma.order.findUnique).not.toHaveBeenCalled();
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('handles prisma failure gracefully', async () => {
    vi.mocked(prisma.order.findUnique).mockRejectedValue(new Error('DB connection lost'));

    await expect(notifyPaymentRefunded('order-1', 10000)).rejects.toThrow('DB connection lost');
  });
});

// ---------------------------------------------------------------------------
// notifyPaymentFailed
// ---------------------------------------------------------------------------
describe('notifyPaymentFailed', () => {
  it('creates notification and publishes event', async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue({
      id: 'order-1',
      customerId: 'customer-1',
      serviceCatalog: { name: 'House Cleaning' },
    } as any);

    await notifyPaymentFailed('order-1', 10000, 'Insufficient funds');

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: {
        userId: 'customer-1',
        title: 'Payment failed',
        message: 'Your payment of $100.00 for House Cleaning has failed. Please check your payment method and try again. Error: Insufficient funds',
        type: 'payment_failed',
        link: '/orders/order-1',
      },
    });

    expect(publish).toHaveBeenCalledWith('payment.failed', {
      orderId: 'order-1',
      amount: 10000,
      error: 'Insufficient funds',
    });
  });

  it('works without an error message', async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue({
      id: 'order-1',
      customerId: 'customer-1',
      serviceCatalog: { name: 'House Cleaning' },
    } as any);

    await notifyPaymentFailed('order-1', 10000);

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: {
        userId: 'customer-1',
        title: 'Payment failed',
        message: 'Your payment of $100.00 for House Cleaning has failed. Please check your payment method and try again.',
        type: 'payment_failed',
        link: '/orders/order-1',
      },
    });

    expect(publish).toHaveBeenCalledWith('payment.failed', {
      orderId: 'order-1',
      amount: 10000,
      error: undefined,
    });
  });

  it('returns early when orderId is empty', async () => {
    await notifyPaymentFailed('', 10000);
    expect(prisma.order.findUnique).not.toHaveBeenCalled();
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('handles prisma failure gracefully', async () => {
    vi.mocked(prisma.order.findUnique).mockRejectedValue(new Error('DB connection lost'));

    await expect(notifyPaymentFailed('order-1', 10000)).rejects.toThrow('DB connection lost');
  });
});
