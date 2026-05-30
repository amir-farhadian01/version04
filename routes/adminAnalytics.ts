import { Router, type Response, type NextFunction } from "express";
import prisma from "../lib/db.js";
import { authenticate, isAdmin } from "../lib/auth.middleware.js";
import type { AuthRequest } from "../lib/auth.middleware.js";

const router = Router();

// All analytics routes require admin auth
router.use(authenticate, isAdmin);

/**
 * GET /api/admin/analytics/overview
 * Key metrics: total orders, total revenue, active users, KYC completion rate
 */
router.get("/overview", async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const [totalOrders, totalRevenue, activeUsers, kycStats, totalCommission] = await Promise.all([
      prisma.order.count(),
      prisma.payment.aggregate({
        _sum: { amount: true },
        where: { status: "captured" },
      }),
      prisma.user.count({ where: { status: "active" } }),
      prisma.kycPersonalSubmission.groupBy({
        by: ["status"],
        _count: { id: true },
      }),
      prisma.payment.aggregate({
        _sum: { commission: true },
        where: { status: "captured" },
      }),
    ]);

    const kycTotal = kycStats.reduce((sum: number, g: { _count: { id: number } }) => sum + g._count.id, 0);
    const kycApproved = kycStats.find((g: { status: string; _count: { id: number } }) => g.status === "approved")?._count.id ?? 0;
    const kycRate = kycTotal > 0 ? Math.round((kycApproved / kycTotal) * 100) : 0;

    res.json({
      data: {
        totalOrders,
        totalRevenue: totalRevenue._sum.amount ?? 0,
        totalRevenueFormatted: formatCents(totalRevenue._sum.amount ?? 0),
        activeUsers,
        kycCompletionRate: kycRate,
        totalCommission: totalCommission._sum.commission ?? 0,
        totalCommissionFormatted: formatCents(totalCommission._sum.commission ?? 0),
        orderCompletionRate: await getOrderCompletionRate(),
        avgOrderValue: await getAverageOrderValue(),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/analytics/orders
 * Order volume over time, by day/week/month
 */
router.get("/orders", async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const orders = await prisma.order.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: {
        id: true,
        status: true,
        createdAt: true,
        serviceCatalog: { select: { categoryId: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Group by date
    const byDate = new Map<string, { count: number; completed: number; cancelled: number }>();
    for (const o of orders) {
      const date = o.createdAt.toISOString().split("T")[0]!;
      const entry = byDate.get(date) ?? { count: 0, completed: 0, cancelled: 0 };
      entry.count++;
      if (o.status === "completed" || o.status === "closed") entry.completed++;
      if (o.status === "cancelled") entry.cancelled++;
      byDate.set(date, entry);
    }

    // Get top categories
    const categoryCounts = new Map<string, number>();
    for (const o of orders) {
      if (o.serviceCatalog?.categoryId) {
        const catId = o.serviceCatalog.categoryId;
        categoryCounts.set(catId, (categoryCounts.get(catId) ?? 0) + 1);
      }
    }

    const topCategoryIds = [...categoryCounts.entries()]
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([id]) => id);

    const categories = await prisma.category.findMany({
      where: { id: { in: topCategoryIds } },
      select: { id: true, name: true },
    });

    const catNameMap = new Map(categories.map((c: { id: string; name: string }) => [c.id, c.name]));

    const topCategories = [...categoryCounts.entries()]
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([id, count]) => ({
        categoryId: id,
        categoryName: catNameMap.get(id) ?? "Unknown",
        orderCount: count,
      }));

    // Convert byDate map to sorted array
    const orderTimeline = [...byDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({
        date,
        count: data.count,
        completed: data.completed,
        cancelled: data.cancelled,
      }));

    res.json({
      data: {
        orderTimeline,
        topCategories,
        totalOrders: orders.length,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/analytics/revenue
 * Revenue over time, by day
 */
router.get("/revenue", async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const payments = await prisma.payment.findMany({
      where: {
        status: "captured",
        createdAt: { gte: thirtyDaysAgo },
      },
      select: {
        amount: true,
        commission: true,
        createdAt: true,
        order: {
          select: {
            serviceCatalog: {
              select: { categoryId: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Revenue by date
    const byDate = new Map<string, { revenue: number; commission: number; count: number }>();
    for (const p of payments) {
      const date = p.createdAt.toISOString().split("T")[0]!;
      const entry = byDate.get(date) ?? { revenue: 0, commission: 0, count: 0 };
      entry.revenue += p.amount;
      entry.commission += p.commission;
      entry.count++;
      byDate.set(date, entry);
    }

    const revenueTimeline = [...byDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({
        date,
        revenue: data.revenue,
        revenueFormatted: formatCents(data.revenue),
        commission: data.commission,
        commissionFormatted: formatCents(data.commission),
        count: data.count,
      }));

    // Top providers by revenue
    const providerRevenue = new Map<string, { amount: number; count: number }>();
    for (const p of payments) {
      // Get provider from order
      const catId = p.order?.serviceCatalog?.categoryId;
      if (catId) {
        const entry = providerRevenue.get(catId) ?? { amount: 0, count: 0 };
        entry.amount += p.amount;
        entry.count++;
        providerRevenue.set(catId, entry);
      }
    }

    res.json({
      data: {
        revenueTimeline,
        totalRevenue: payments.reduce((sum: number, p: { amount: number }) => sum + p.amount, 0),
        totalRevenueFormatted: formatCents(payments.reduce((sum: number, p: { amount: number }) => sum + p.amount, 0)),
        totalCommission: payments.reduce((sum: number, p: { commission: number }) => sum + p.commission, 0),
        totalCommissionFormatted: formatCents(payments.reduce((sum: number, p: { commission: number }) => sum + p.commission, 0)),
        transactionCount: payments.length,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/analytics/users
 * User growth (new registrations), role distribution
 */
router.get("/users", async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const newUsers = await prisma.user.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: {
        id: true,
        role: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Group registrations by date
    const byDate = new Map<string, { total: number; customers: number; providers: number }>();
    for (const u of newUsers) {
      const date = u.createdAt.toISOString().split("T")[0]!;
      const entry = byDate.get(date) ?? { total: 0, customers: 0, providers: 0 };
      entry.total++;
      if (u.role === "customer") entry.customers++;
      if (u.role === "provider") entry.providers++;
      byDate.set(date, entry);
    }

    const registrationTimeline = [...byDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({
        date,
        total: data.total,
        customers: data.customers,
        providers: data.providers,
      }));

    // Role distribution
    const roleDistribution = await prisma.user.groupBy({
      by: ["role"],
      _count: { id: true },
    });

    // Total counts
    const totalUsers = await prisma.user.count();
    const activeUsers = await prisma.user.count({ where: { status: "active" } });

    res.json({
      data: {
        registrationTimeline,
        roleDistribution: roleDistribution.map((g: { role: string; _count: { id: number } }) => ({
          role: g.role,
          count: g._count.id,
        })),
        newUsersLast30Days: newUsers.length,
        totalUsers,
        activeUsers,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/analytics/kyc
 * KYC completion rate, pending reviews, rejection rate
 */
router.get("/kyc", async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const kycStats = await prisma.kycPersonalSubmission.groupBy({
      by: ["status"],
      _count: { id: true },
    });

    const pending = kycStats
      .filter((g: { status: string }) => g.status === "pending")
      .reduce((sum: number, g: { _count: { id: number } }) => sum + g._count.id, 0);

    const approved = kycStats
      .filter((g: { status: string }) => g.status === "approved")
      .reduce((sum: number, g: { _count: { id: number } }) => sum + g._count.id, 0);

    const rejected = kycStats
      .filter((g: { status: string }) => g.status === "rejected")
      .reduce((sum: number, g: { _count: { id: number } }) => sum + g._count.id, 0);

    const total = kycStats.reduce((sum: number, g: { _count: { id: number } }) => sum + g._count.id, 0);

    res.json({
      data: {
        kycBreakdown: kycStats.map((g: { status: string; _count: { id: number } }) => ({
          status: g.status,
          type: "personal",
          count: g._count.id,
        })),
        total,
        pending,
        approved,
        rejected,
        approvalRate: total > 0 ? Math.round((approved / total) * 100) : 0,
        rejectionRate: total > 0 ? Math.round((rejected / total) * 100) : 0,
        pendingCount: pending,
      },
    });
  } catch (error) {
    next(error);
  }
});

// --- Helpers ---

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

async function getOrderCompletionRate(): Promise<number> {
  const total = await prisma.order.count();
  if (total === 0) return 0;
  const completed = await prisma.order.count({
    where: { status: { in: ["completed", "closed"] } },
  });
  return Math.round((completed / total) * 100);
}

async function getAverageOrderValue(): Promise<number> {
  const result = await prisma.payment.aggregate({
    _avg: { amount: true },
    where: { status: "captured" },
  });
  return Math.round(result._avg.amount ?? 0);
}

export default router;