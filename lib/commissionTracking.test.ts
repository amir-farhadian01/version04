import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/db.js', () => ({
  default: {
    payment: {
      findMany: vi.fn(),
    },
  },
}));

import prisma from '../lib/db.js';
import { getCommissionSummary, getCommissionByProvider } from './commissionTracking.js';

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// getCommissionSummary
// ---------------------------------------------------------------------------
describe('getCommissionSummary', () => {
  it('should return empty summary when no payments exist', async () => {
    vi.mocked(prisma.payment.findMany).mockResolvedValue([]);

    const result = await getCommissionSummary();

    expect(result.totalCommission).toBe(0);
    expect(result.totalRevenue).toBe(0);
    expect(result.pendingCommission).toBe(0);
    expect(result.capturedCommission).toBe(0);
    expect(result.refundedCommission).toBe(0);
    expect(result.orderCount).toBe(0);
    expect(result.periodStart).toBeInstanceOf(Date);
    expect(result.periodEnd).toBeInstanceOf(Date);
  });

  it('should calculate total commission correctly', async () => {
    vi.mocked(prisma.payment.findMany).mockResolvedValue([
      { id: 'p1', orderId: 'o1', amount: 10000, commission: 1500, deduction: 8500, status: 'captured', stripePaymentIntentId: null, stripeTransferId: null, escrowReleaseAt: null, createdAt: new Date('2025-01-01'), updatedAt: new Date('2025-01-01') },
      { id: 'p2', orderId: 'o2', amount: 20000, commission: 3000, deduction: 17000, status: 'captured', stripePaymentIntentId: null, stripeTransferId: null, escrowReleaseAt: null, createdAt: new Date('2025-01-02'), updatedAt: new Date('2025-01-02') },
      { id: 'p3', orderId: 'o3', amount: 5000, commission: 750, deduction: 4250, status: 'pending', stripePaymentIntentId: null, stripeTransferId: null, escrowReleaseAt: null, createdAt: new Date('2025-01-03'), updatedAt: new Date('2025-01-03') },
    ] as any);

    const result = await getCommissionSummary();

    expect(result.totalCommission).toBe(5250); // 1500 + 3000 + 750
    expect(result.totalRevenue).toBe(35000);   // 10000 + 20000 + 5000
    expect(result.orderCount).toBe(3);
  });

  it('should filter by date range', async () => {
    vi.mocked(prisma.payment.findMany).mockResolvedValue([
      { id: 'p2', orderId: 'o2', amount: 20000, commission: 3000, deduction: 17000, status: 'captured', stripePaymentIntentId: null, stripeTransferId: null, escrowReleaseAt: null, createdAt: new Date('2025-06-15'), updatedAt: new Date('2025-06-15') },
    ] as any);

    const start = new Date('2025-06-01');
    const end = new Date('2025-07-01');
    const result = await getCommissionSummary(start, end);

    expect(prisma.payment.findMany).toHaveBeenCalledWith({
      where: {
        createdAt: { gte: start, lte: end },
      },
    });
    expect(result.totalCommission).toBe(3000);
    expect(result.orderCount).toBe(1);
    expect(result.periodStart).toEqual(start);
    expect(result.periodEnd).toEqual(end);
  });

  it('should handle mixed payment statuses', async () => {
    vi.mocked(prisma.payment.findMany).mockResolvedValue([
      { id: 'p1', orderId: 'o1', amount: 10000, commission: 1500, deduction: 8500, status: 'pending', stripePaymentIntentId: null, stripeTransferId: null, escrowReleaseAt: null, createdAt: new Date('2025-01-01'), updatedAt: new Date('2025-01-01') },
      { id: 'p2', orderId: 'o2', amount: 20000, commission: 3000, deduction: 17000, status: 'captured', stripePaymentIntentId: null, stripeTransferId: null, escrowReleaseAt: null, createdAt: new Date('2025-01-02'), updatedAt: new Date('2025-01-02') },
      { id: 'p3', orderId: 'o3', amount: 5000, commission: 750, deduction: 4250, status: 'releaseScheduled', stripePaymentIntentId: null, stripeTransferId: null, escrowReleaseAt: new Date('2025-02-01'), createdAt: new Date('2025-01-03'), updatedAt: new Date('2025-01-03') },
      { id: 'p4', orderId: 'o4', amount: 8000, commission: 1200, deduction: 6800, status: 'refunded', stripePaymentIntentId: null, stripeTransferId: null, escrowReleaseAt: null, createdAt: new Date('2025-01-04'), updatedAt: new Date('2025-01-04') },
      { id: 'p5', orderId: 'o5', amount: 3000, commission: 450, deduction: 2550, status: 'failed', stripePaymentIntentId: null, stripeTransferId: null, escrowReleaseAt: null, createdAt: new Date('2025-01-05'), updatedAt: new Date('2025-01-05') },
    ] as any);

    const result = await getCommissionSummary();

    expect(result.totalCommission).toBe(6900);  // 1500 + 3000 + 750 + 1200 + 450
    expect(result.totalRevenue).toBe(46000);    // 10000 + 20000 + 5000 + 8000 + 3000
    expect(result.pendingCommission).toBe(1500);
    expect(result.capturedCommission).toBe(3750); // 3000 (captured) + 750 (releaseScheduled)
    expect(result.refundedCommission).toBe(1200);
    expect(result.orderCount).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// getCommissionByProvider
// ---------------------------------------------------------------------------
describe('getCommissionByProvider', () => {
  it('should group by provider correctly', async () => {
    vi.mocked(prisma.payment.findMany).mockResolvedValue([
      {
        id: 'p1', orderId: 'o1', amount: 10000, commission: 1500, deduction: 8500, status: 'captured',
        stripePaymentIntentId: null, stripeTransferId: null, escrowReleaseAt: null,
        createdAt: new Date('2025-01-01'), updatedAt: new Date('2025-01-01'),
        order: {
          matchedWorkspace: { id: 'w1', name: 'Provider Alpha' },
        },
      },
      {
        id: 'p2', orderId: 'o2', amount: 20000, commission: 3000, deduction: 17000, status: 'captured',
        stripePaymentIntentId: null, stripeTransferId: null, escrowReleaseAt: null,
        createdAt: new Date('2025-01-02'), updatedAt: new Date('2025-01-02'),
        order: {
          matchedWorkspace: { id: 'w2', name: 'Provider Beta' },
        },
      },
      {
        id: 'p3', orderId: 'o3', amount: 5000, commission: 750, deduction: 4250, status: 'pending',
        stripePaymentIntentId: null, stripeTransferId: null, escrowReleaseAt: null,
        createdAt: new Date('2025-01-03'), updatedAt: new Date('2025-01-03'),
        order: {
          matchedWorkspace: { id: 'w1', name: 'Provider Alpha' },
        },
      },
    ] as any);

    const result = await getCommissionByProvider();

    expect(result).toHaveLength(2);

    // Provider Beta should have 1 order: 3000 commission (highest, so first)
    expect(result[0].providerId).toBe('w2');
    expect(result[0].providerName).toBe('Provider Beta');
    expect(result[0].totalCommission).toBe(3000);
    expect(result[0].orderCount).toBe(1);

    // Provider Alpha should have 2 orders: 1500 + 750 = 2250 commission
    expect(result[1].providerId).toBe('w1');
    expect(result[1].providerName).toBe('Provider Alpha');
    expect(result[1].totalCommission).toBe(2250);
    expect(result[1].orderCount).toBe(2);

    // Results should be sorted by totalCommission descending
    expect(result[0].totalCommission).toBeGreaterThanOrEqual(result[1].totalCommission);
  });

  it('should handle providers with no workspace', async () => {
    vi.mocked(prisma.payment.findMany).mockResolvedValue([
      {
        id: 'p1', orderId: 'o1', amount: 10000, commission: 1500, deduction: 8500, status: 'captured',
        stripePaymentIntentId: null, stripeTransferId: null, escrowReleaseAt: null,
        createdAt: new Date('2025-01-01'), updatedAt: new Date('2025-01-01'),
        order: {
          matchedWorkspace: null,
        },
      },
    ] as any);

    const result = await getCommissionByProvider();

    expect(result).toHaveLength(1);
    expect(result[0].providerId).toBe('unknown');
    expect(result[0].providerName).toBe('Unknown Provider');
    expect(result[0].totalCommission).toBe(1500);
    expect(result[0].orderCount).toBe(1);
  });

  it('should return empty array when no payments exist', async () => {
    vi.mocked(prisma.payment.findMany).mockResolvedValue([]);

    const result = await getCommissionByProvider();

    expect(result).toEqual([]);
  });
});
