import { OrderStatus, Prisma, UserRole } from '@prisma/client';
import prisma from './db.js';

export type AdminOverviewStats = {
  totalUsers: number;
  kycPending: number;
  activeOrders: number;
  ordersToday: number;
  totalProviders: number;
  matchRate: number;
  avgTimeToMatch: number;
  revenueTotal: number;
  revenuePending: number;
};

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

function orderIdFromTxDescription(description: string | null): string | null {
  if (!description) return null;
  const m = /order:([a-z0-9]+)/i.exec(description);
  return m?.[1] ?? null;
}

/** Sum of snapshot-style order value: matched package finalPrice, else latest approved contract amount (CAD). */
async function sumRevenueSnapshotWhere(
  where: Prisma.OrderWhereInput,
): Promise<number> {
  const orders = await prisma.order.findMany({
    where,
    select: {
      id: true,
      matchedPackageId: true,
      matchedPackage: { select: { finalPrice: true } },
      orderContract: {
        select: {
          versions: {
            where: { status: 'approved' as const },
            orderBy: { versionNumber: 'desc' },
            take: 1,
            select: { amount: true },
          },
        },
      },
    },
  });
  let sum = 0;
  for (const o of orders) {
    if (o.matchedPackage?.finalPrice != null && Number.isFinite(o.matchedPackage.finalPrice)) {
      sum += o.matchedPackage.finalPrice;
      continue;
    }
    const amt = o.orderContract?.versions?.[0]?.amount;
    if (amt != null && Number.isFinite(amt)) sum += amt;
  }
  return Math.round(sum * 100) / 100;
}

export async function computeAdminOverviewStats(): Promise<AdminOverviewStats> {
  const now = new Date();
  const dayStart = startOfUtcDay(now);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const inactiveStatuses: OrderStatus[] = [OrderStatus.cancelled, OrderStatus.closed];

  const captureTxs = await prisma.transaction.findMany({
    where: { category: 'order_payment_capture' },
    select: { description: true },
  });
  const capturedOrderIds = new Set<string>();
  for (const t of captureTxs) {
    const oid = orderIdFromTxDescription(t.description);
    if (oid) capturedOrderIds.add(oid);
  }

  const [
    totalUsers,
    kycPersonalPending,
    kycBusinessPending,
    activeOrders,
    ordersToday,
    totalProviders,
    submitted30d,
    matched30d,
    avgMatchRow,
    revenueTotal,
    completedUncaptured,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.kycPersonalSubmission.count({ where: { status: 'pending' } }),
    prisma.businessKycSubmission.count({ where: { status: 'pending' } }),
    prisma.order.count({ where: { NOT: { status: { in: inactiveStatuses } } } }),
    prisma.order.count({
      where: {
        submittedAt: { gte: dayStart },
        status: { not: OrderStatus.draft },
      },
    }),
    prisma.user.count({ where: { role: UserRole.provider } }),
    prisma.order.count({
      where: {
        submittedAt: { gte: thirtyDaysAgo },
        status: { not: OrderStatus.draft },
      },
    }),
    prisma.order.count({
      where: {
        submittedAt: { gte: thirtyDaysAgo },
        status: { not: OrderStatus.draft },
        matchedProviderId: { not: null },
      },
    }),
    prisma.$queryRaw<Array<{ avg_min: number | null }>>`
      SELECT AVG(EXTRACT(EPOCH FROM (m."matchedAt" - o."submittedAt")) / 60.0) AS avg_min
      FROM "Order" o
      INNER JOIN (
        SELECT "offerId", MIN("matchedAt") AS "matchedAt"
        FROM "OfferMatchAttempt"
        WHERE status = 'matched'::"MatchAttemptStatus" AND "matchedAt" IS NOT NULL
        GROUP BY "offerId"
      ) m ON m."offerId" = o.id
      WHERE o."submittedAt" IS NOT NULL
        AND o."submittedAt" >= ${thirtyDaysAgo}
    `,
    sumRevenueSnapshotWhere({
      status: { notIn: [OrderStatus.draft, OrderStatus.cancelled] },
    }),
    prisma.order.findMany({
      where: { status: OrderStatus.completed },
      select: {
        id: true,
        matchedPackage: { select: { finalPrice: true } },
        orderContract: {
          select: {
            versions: {
              where: { status: 'approved' as const },
              orderBy: { versionNumber: 'desc' },
              take: 1,
              select: { amount: true },
            },
          },
        },
      },
    }),
  ]);

  const kycPending = kycPersonalPending + kycBusinessPending;
  const matchRate =
    submitted30d > 0 ? Math.round((matched30d / submitted30d) * 1000) / 10 : 0;
  const rawAvg = avgMatchRow[0]?.avg_min;
  const avgTimeToMatch =
    rawAvg != null && Number.isFinite(Number(rawAvg)) ? Math.round(Number(rawAvg) * 10) / 10 : 0;

  let revenuePending = 0;
  for (const o of completedUncaptured) {
    if (capturedOrderIds.has(o.id)) continue;
    if (o.matchedPackage?.finalPrice != null && Number.isFinite(o.matchedPackage.finalPrice)) {
      revenuePending += o.matchedPackage.finalPrice;
      continue;
    }
    const amt = o.orderContract?.versions?.[0]?.amount;
    if (amt != null && Number.isFinite(amt)) revenuePending += amt;
  }
  revenuePending = Math.round(revenuePending * 100) / 100;

  return {
    totalUsers,
    kycPending,
    activeOrders,
    ordersToday,
    totalProviders,
    matchRate,
    avgTimeToMatch,
    revenueTotal,
    revenuePending,
  };
}

export type OrdersTrendPoint = { date: string; count: number };

export async function computeOrdersSubmittedTrend(days: number): Promise<OrdersTrendPoint[]> {
  const d = Math.min(90, Math.max(1, Math.floor(days)));
  const now = new Date();
  const start = startOfUtcDay(new Date(now.getTime() - (d - 1) * 24 * 60 * 60 * 1000));

  const rows = await prisma.$queryRaw<Array<{ d: Date; c: bigint }>>`
    SELECT date_trunc('day', o."submittedAt" AT TIME ZONE 'UTC') AS d, COUNT(*)::bigint AS c
    FROM "Order" o
    WHERE o."submittedAt" IS NOT NULL
      AND o."submittedAt" >= ${start}
      AND o.status <> 'draft'::"OrderStatus"
    GROUP BY 1
    ORDER BY 1 ASC
  `;

  const byDay = new Map<string, number>();
  for (const r of rows) {
    const key = r.d.toISOString().slice(0, 10);
    byDay.set(key, Number(r.c));
  }

  const out: OrdersTrendPoint[] = [];
  for (let i = 0; i < d; i++) {
    const x = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
    const key = x.toISOString().slice(0, 10);
    out.push({ date: key, count: byDay.get(key) ?? 0 });
  }
  return out;
}
