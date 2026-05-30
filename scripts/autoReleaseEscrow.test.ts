import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/db.js', () => ({
  default: {
    payment: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import prisma from '../lib/db.js';
import { autoReleaseEscrow } from './autoReleaseEscrow.js';

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// autoReleaseEscrow
// ---------------------------------------------------------------------------
describe('autoReleaseEscrow', () => {
  it('should skip payments with future escrowReleaseAt', async () => {
    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h in future
    vi.mocked(prisma.payment.findMany).mockResolvedValue([]);

    const result = await autoReleaseEscrow();

    expect(prisma.payment.findMany).toHaveBeenCalledWith({
      where: {
        status: 'captured',
        escrowReleaseAt: {
          lte: expect.any(Date),
          not: null,
        },
      },
    });
    expect(result).toEqual({ released: 0, errors: 0 });
  });

  it('should release payments with past escrowReleaseAt', async () => {
    const pastDate = new Date(Date.now() - 60 * 60 * 1000); // 1h in past
    const mockPayment = {
      id: 'pay_1',
      orderId: 'order_1',
      amount: 10000,
      status: 'captured',
      escrowReleaseAt: pastDate,
    };

    vi.mocked(prisma.payment.findMany).mockResolvedValue([mockPayment] as any);

    // Mock $transaction to execute the callback
    vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) => {
      await cb(prisma);
    });

    // Mock findUnique inside transaction to return the payment
    vi.mocked(prisma.payment.findUnique).mockResolvedValue({
      id: 'pay_1',
      status: 'captured',
      escrowReleaseAt: pastDate,
    } as any);

    const result = await autoReleaseEscrow();

    expect(prisma.payment.update).toHaveBeenCalledWith({
      where: { id: 'pay_1' },
      data: { status: 'releaseScheduled' },
    });
    expect(result).toEqual({ released: 1, errors: 0 });
  });

  it('should skip payments with null escrowReleaseAt', async () => {
    // findMany query already filters for escrowReleaseAt not null,
    // so this tests that the query correctly excludes null values
    vi.mocked(prisma.payment.findMany).mockResolvedValue([]);

    const result = await autoReleaseEscrow();

    expect(prisma.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          escrowReleaseAt: expect.objectContaining({
            not: null,
          }),
        }),
      }),
    );
    expect(result).toEqual({ released: 0, errors: 0 });
  });

  it('should skip payments that are not in captured status', async () => {
    // findMany query already filters for status: 'captured',
    // so this tests that the query correctly excludes other statuses
    vi.mocked(prisma.payment.findMany).mockResolvedValue([]);

    const result = await autoReleaseEscrow();

    expect(prisma.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'captured',
        }),
      }),
    );
    expect(result).toEqual({ released: 0, errors: 0 });
  });

  it('should use transaction for atomicity', async () => {
    const pastDate = new Date(Date.now() - 60 * 60 * 1000);
    const mockPayment = {
      id: 'pay_1',
      orderId: 'order_1',
      amount: 10000,
      status: 'captured',
      escrowReleaseAt: pastDate,
    };

    vi.mocked(prisma.payment.findMany).mockResolvedValue([mockPayment] as any);

    // Track that $transaction was called
    let transactionCalled = false;
    vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) => {
      transactionCalled = true;
      await cb(prisma);
    });

    vi.mocked(prisma.payment.findUnique).mockResolvedValue({
      id: 'pay_1',
      status: 'captured',
      escrowReleaseAt: pastDate,
    } as any);

    await autoReleaseEscrow();

    expect(transactionCalled).toBe(true);
    expect(prisma.payment.update).toHaveBeenCalledWith({
      where: { id: 'pay_1' },
      data: { status: 'releaseScheduled' },
    });
  });

  it('should handle errors gracefully and continue processing', async () => {
    const pastDate = new Date(Date.now() - 60 * 60 * 1000);
    const mockPayment1 = {
      id: 'pay_1',
      orderId: 'order_1',
      amount: 10000,
      status: 'captured',
      escrowReleaseAt: pastDate,
    };
    const mockPayment2 = {
      id: 'pay_2',
      orderId: 'order_2',
      amount: 5000,
      status: 'captured',
      escrowReleaseAt: pastDate,
    };

    vi.mocked(prisma.payment.findMany).mockResolvedValue([mockPayment1, mockPayment2] as any);

    // First transaction throws, second succeeds
    vi.mocked(prisma.$transaction)
      .mockRejectedValueOnce(new Error('DB error'))
      .mockImplementationOnce(async (cb: any) => {
        await cb(prisma);
      });

    vi.mocked(prisma.payment.findUnique).mockResolvedValue({
      id: 'pay_2',
      status: 'captured',
      escrowReleaseAt: pastDate,
    } as any);

    const result = await autoReleaseEscrow();

    expect(result).toEqual({ released: 1, errors: 1 });
  });
});
