import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@prisma/client', () => ({
  OrderStatus: {
    matching: 'matching',
    expired: 'expired',
  },
}));

vi.mock('../lib/db.js', () => ({
  default: {
    order: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import prisma from '../lib/db.js';
import { expireMatchingWindows } from './matchingWindowExpiry.js';

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// expireMatchingWindows
// ---------------------------------------------------------------------------
describe('expireMatchingWindows', () => {
  it('should skip orders with future matchingExpiresAt', async () => {
    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h in future
    vi.mocked(prisma.order.findMany).mockResolvedValue([]);

    const result = await expireMatchingWindows();

    expect(prisma.order.findMany).toHaveBeenCalledWith({
      where: {
        status: 'matching',
        matchingExpiresAt: {
          lte: expect.any(Date),
          not: null,
        },
      },
    });
    expect(result).toEqual({ expired: 0, errors: 0 });
  });

  it('should expire orders with past matchingExpiresAt', async () => {
    const pastDate = new Date(Date.now() - 60 * 60 * 1000); // 1h in past
    const mockOrder = {
      id: 'order_1',
      status: 'matching',
      matchingExpiresAt: pastDate,
    };

    vi.mocked(prisma.order.findMany).mockResolvedValue([mockOrder] as any);

    // Mock $transaction to execute the callback
    vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) => {
      await cb(prisma);
    });

    // Mock findUnique inside transaction to return the order
    vi.mocked(prisma.order.findUnique).mockResolvedValue({
      id: 'order_1',
      status: 'matching',
      matchingExpiresAt: pastDate,
    } as any);

    const result = await expireMatchingWindows();

    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: 'order_1' },
      data: { status: 'expired' },
    });
    expect(result).toEqual({ expired: 1, errors: 0 });
  });

  it('should skip orders with null matchingExpiresAt', async () => {
    // findMany query already filters for matchingExpiresAt not null,
    // so this tests that the query correctly excludes null values
    vi.mocked(prisma.order.findMany).mockResolvedValue([]);

    const result = await expireMatchingWindows();

    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          matchingExpiresAt: expect.objectContaining({
            not: null,
          }),
        }),
      }),
    );
    expect(result).toEqual({ expired: 0, errors: 0 });
  });

  it('should skip orders that are not in matching status', async () => {
    // findMany query already filters for status: 'matching',
    // so this tests that the query correctly excludes other statuses
    vi.mocked(prisma.order.findMany).mockResolvedValue([]);

    const result = await expireMatchingWindows();

    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'matching',
        }),
      }),
    );
    expect(result).toEqual({ expired: 0, errors: 0 });
  });

  it('should use transaction for atomicity', async () => {
    const pastDate = new Date(Date.now() - 60 * 60 * 1000);
    const mockOrder = {
      id: 'order_1',
      status: 'matching',
      matchingExpiresAt: pastDate,
    };

    vi.mocked(prisma.order.findMany).mockResolvedValue([mockOrder] as any);

    // Track that $transaction was called
    let transactionCalled = false;
    vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) => {
      transactionCalled = true;
      await cb(prisma);
    });

    vi.mocked(prisma.order.findUnique).mockResolvedValue({
      id: 'order_1',
      status: 'matching',
      matchingExpiresAt: pastDate,
    } as any);

    await expireMatchingWindows();

    expect(transactionCalled).toBe(true);
    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: 'order_1' },
      data: { status: 'expired' },
    });
  });

  it('should handle errors gracefully and continue processing', async () => {
    const pastDate = new Date(Date.now() - 60 * 60 * 1000);
    const mockOrder1 = {
      id: 'order_1',
      status: 'matching',
      matchingExpiresAt: pastDate,
    };
    const mockOrder2 = {
      id: 'order_2',
      status: 'matching',
      matchingExpiresAt: pastDate,
    };

    vi.mocked(prisma.order.findMany).mockResolvedValue([mockOrder1, mockOrder2] as any);

    // First transaction throws, second succeeds
    vi.mocked(prisma.$transaction)
      .mockRejectedValueOnce(new Error('DB error'))
      .mockImplementationOnce(async (cb: any) => {
        await cb(prisma);
      });

    vi.mocked(prisma.order.findUnique).mockResolvedValue({
      id: 'order_2',
      status: 'matching',
      matchingExpiresAt: pastDate,
    } as any);

    const result = await expireMatchingWindows();

    expect(result).toEqual({ expired: 1, errors: 1 });
  });
});
