import prisma from './db.js';

export interface CommissionSummary {
  totalCommission: number;      // Total commission earned (cents)
  totalRevenue: number;         // Total order revenue (cents)
  pendingCommission: number;    // Commission from pending payments
  capturedCommission: number;   // Commission from captured payments
  refundedCommission: number;   // Commission from refunded payments
  periodStart: Date;
  periodEnd: Date;
  orderCount: number;
}

export interface CommissionByProvider {
  providerId: string;
  providerName: string;
  totalCommission: number;
  orderCount: number;
}

/**
 * Get commission summary for a date range
 */
export async function getCommissionSummary(
  periodStart?: Date,
  periodEnd?: Date
): Promise<CommissionSummary> {
  const start = periodStart || new Date('2020-01-01');
  const end = periodEnd || new Date();

  const payments = await prisma.payment.findMany({
    where: {
      createdAt: { gte: start, lte: end }
    }
  });

  const totalCommission = payments.reduce((sum, p) => sum + p.commission, 0);
  const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);
  const pendingCommission = payments.filter(p => p.status === 'pending').reduce((sum, p) => sum + p.commission, 0);
  const capturedCommission = payments.filter(p => p.status === 'captured' || p.status === 'releaseScheduled').reduce((sum, p) => sum + p.commission, 0);
  const refundedCommission = payments.filter(p => p.status === 'refunded').reduce((sum, p) => sum + p.commission, 0);

  return {
    totalCommission,
    totalRevenue,
    pendingCommission,
    capturedCommission,
    refundedCommission,
    periodStart: start,
    periodEnd: end,
    orderCount: payments.length
  };
}

/**
 * Get commission breakdown by provider
 */
export async function getCommissionByProvider(
  periodStart?: Date,
  periodEnd?: Date
): Promise<CommissionByProvider[]> {
  const start = periodStart || new Date('2020-01-01');
  const end = periodEnd || new Date();

  const payments = await prisma.payment.findMany({
    where: {
      createdAt: { gte: start, lte: end }
    },
    include: {
      order: {
        include: {
          matchedWorkspace: {
            select: {
              id: true,
              name: true
            }
          }
        }
      }
    }
  });

  // Group by provider
  const providerMap = new Map<string, CommissionByProvider>();

  for (const payment of payments) {
    const providerId = payment.order.matchedWorkspace?.id || 'unknown';
    const providerName = payment.order.matchedWorkspace?.name || 'Unknown Provider';

    const existing = providerMap.get(providerId);
    if (existing) {
      existing.totalCommission += payment.commission;
      existing.orderCount += 1;
    } else {
      providerMap.set(providerId, {
        providerId,
        providerName,
        totalCommission: payment.commission,
        orderCount: 1
      });
    }
  }

  return Array.from(providerMap.values()).sort((a, b) => b.totalCommission - a.totalCommission);
}
