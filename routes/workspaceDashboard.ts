import { Router, Response } from 'express';
import prisma from '../lib/db.js';
import { authenticate, AuthRequest } from '../lib/auth.middleware.js';
import { assertWorkspaceMember, WorkspaceAccessError } from '../lib/workspaceAccess.js';
import { buildProviderWorkspaceFinance } from '../lib/buildProviderWorkspaceFinance.js';

const router = Router();

// GET /api/workspace/:workspaceId/dashboard — Live dashboard stats
router.get('/:workspaceId/dashboard', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId } = req.params;
    const userId = req.user!.userId;

    // Verify workspace membership
    try {
      await assertWorkspaceMember(userId, workspaceId);
    } catch (e) {
      if (e instanceof WorkspaceAccessError) {
        return res.status(403).json({ error: 'Not a workspace member' });
      }
      throw e;
    }

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfThisWeek = new Date(startOfToday);
    startOfThisWeek.setDate(startOfThisWeek.getDate() - startOfThisWeek.getDay());
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Run all queries in parallel
    const [
      activeOrdersCount,
      pendingQuotesCount,
      todayAppointments,
      upcomingAppointments,
      recentOrders,
      staffMembers,
      financeData,
      revenueThisMonth,
    ] = await Promise.all([
      // Active orders count (contracted, paid, in_progress)
      prisma.order.count({
        where: {
          matchedWorkspaceId: workspaceId,
          status: { in: ['contracted', 'paid', 'in_progress'] },
        },
      }),

      // Pending quotes count
      prisma.quote.count({
        where: {
          workspaceId,
          status: 'SENT',
        },
      }),

      // Today's appointments
      prisma.order.findMany({
        where: {
          matchedWorkspaceId: workspaceId,
          scheduledAt: {
            gte: startOfToday,
            lt: new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000),
          },
          status: { in: ['contracted', 'paid', 'in_progress'] },
        },
        select: {
          id: true,
          scheduledAt: true,
          status: true,
          customer: { select: { id: true, displayName: true, firstName: true, lastName: true, avatarUrl: true } },
          serviceCatalog: { select: { name: true } },
          matchedPackage: { select: { name: true, finalPrice: true } },
        },
        orderBy: { scheduledAt: 'asc' },
      }),

      // Upcoming appointments (next 5)
      prisma.order.findMany({
        where: {
          matchedWorkspaceId: workspaceId,
          scheduledAt: { gte: now },
          status: { in: ['contracted', 'paid', 'in_progress'] },
        },
        select: {
          id: true,
          scheduledAt: true,
          status: true,
          customer: { select: { id: true, displayName: true, firstName: true, lastName: true, avatarUrl: true } },
          serviceCatalog: { select: { name: true } },
          matchedPackage: { select: { name: true, finalPrice: true } },
        },
        orderBy: { scheduledAt: 'asc' },
        take: 5,
      }),

      // Recent orders (last 10)
      prisma.order.findMany({
        where: { matchedWorkspaceId: workspaceId },
        select: {
          id: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          customer: { select: { id: true, displayName: true, firstName: true, lastName: true, avatarUrl: true } },
          serviceCatalog: { select: { name: true } },
          matchedPackage: { select: { name: true, finalPrice: true, currency: true } },
          orderContract: {
            select: {
              currentVersion: { select: { amount: true, currency: true, status: true } },
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
        take: 10,
      }),

      // Staff members
      prisma.companyUser.findMany({
        where: { companyId: workspaceId },
        select: {
          userId: true,
          role: true,
          staffRole: true,
          user: {
            select: {
              id: true,
              displayName: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
              lastSeenAt: true,
            },
          },
        },
      }),

      // Finance data
      buildProviderWorkspaceFinance(workspaceId),

      // Revenue this month
      prisma.order.aggregate({
        where: {
          matchedWorkspaceId: workspaceId,
          status: { in: ['completed', 'closed'] },
          updatedAt: { gte: startOfThisMonth },
        },
        _sum: {
          // We'll use the orderContract amount via the finance builder
        },
      }),
    ]);

    // Calculate revenue this month from finance data
    const thisMonthRevenue = financeData.invoices
      .filter((inv) => {
        const updated = new Date(inv.updatedAt);
        return updated >= startOfThisMonth && (inv.orderStatus === 'completed' || inv.orderStatus === 'closed');
      })
      .reduce((sum, inv) => sum + inv.amount, 0);

    // Build pipeline breakdown
    const pipelineStatuses = ['draft', 'submitted', 'matching', 'matched', 'contracted', 'paid', 'in_progress', 'completed', 'disputed', 'closed'] as const;
    const pipelineCounts: Record<string, number> = {};
    const pipelineAmounts: Record<string, number> = {};
    for (const s of pipelineStatuses) {
      pipelineCounts[s] = 0;
      pipelineAmounts[s] = 0;
    }
    for (const inv of financeData.invoices) {
      const s = inv.orderStatus;
      if (s in pipelineCounts) {
        pipelineCounts[s] = (pipelineCounts[s] ?? 0) + 1;
        pipelineAmounts[s] = (pipelineAmounts[s] ?? 0) + inv.amount;
      }
    }

    // Top customers by revenue
    const customerRevenue = new Map<string, { name: string; revenue: number; orderCount: number }>();
    for (const inv of financeData.invoices) {
      const key = inv.customerLabel;
      const existing = customerRevenue.get(key) ?? { name: key, revenue: 0, orderCount: 0 };
      existing.revenue += inv.amount;
      existing.orderCount += 1;
      customerRevenue.set(key, existing);
    }
    const topCustomers = Array.from(customerRevenue.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    // Recent activity (combine orders and quotes)
    const recentQuotes = await prisma.quote.findMany({
      where: { workspaceId },
      select: {
        id: true,
        title: true,
        status: true,
        total: true,
        currency: true,
        createdAt: true,
        createdBy: { select: { id: true, displayName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const recentActivity = [
      ...recentOrders.map((o) => ({
        type: 'order' as const,
        id: o.id,
        label: `Order: ${o.serviceCatalog.name}`,
        status: o.status,
        amount: o.orderContract?.currentVersion?.amount ?? o.matchedPackage?.finalPrice ?? 0,
        currency: o.orderContract?.currentVersion?.currency ?? o.matchedPackage?.currency ?? 'CAD',
        customerName: (o.customer.displayName ?? `${o.customer.firstName ?? ''} ${o.customer.lastName ?? ''}`.trim()) || 'Unknown',
        createdAt: o.createdAt.toISOString(),
        updatedAt: o.updatedAt.toISOString(),
      })),
      ...recentQuotes.map((q) => ({
        type: 'quote' as const,
        id: q.id,
        label: `Quote: ${q.title}`,
        status: q.status,
        amount: q.total,
        currency: q.currency,
        customerName: q.createdBy.displayName ?? 'Unknown',
        createdAt: q.createdAt.toISOString(),
        updatedAt: q.createdAt.toISOString(),
      })),
    ]
      .sort((a, b) => (b.createdAt < a.createdAt ? -1 : b.createdAt > a.createdAt ? 1 : 0))
      .slice(0, 10);

    res.json({
      stats: {
        activeOrders: activeOrdersCount,
        pendingQuotes: pendingQuotesCount,
        revenueThisMonth: thisMonthRevenue,
        displayCurrency: financeData.summary.displayCurrency,
        totalEarnings: financeData.summary.estimatedEarnings,
        pendingAmount: financeData.summary.pendingAmount,
        completedJobs: financeData.summary.completedJobCount,
      },
      pipeline: pipelineStatuses.map((s) => ({
        status: s,
        count: pipelineCounts[s] ?? 0,
        amount: pipelineAmounts[s] ?? 0,
      })),
      todayAppointments: todayAppointments.map((a) => ({
        id: a.id,
        scheduledAt: a.scheduledAt?.toISOString() ?? null,
        status: a.status,
        customer: a.customer,
        serviceName: a.serviceCatalog.name,
        packageName: a.matchedPackage?.name ?? null,
        amount: a.matchedPackage?.finalPrice ?? 0,
      })),
      upcomingAppointments: upcomingAppointments.map((a) => ({
        id: a.id,
        scheduledAt: a.scheduledAt?.toISOString() ?? null,
        status: a.status,
        customer: a.customer,
        serviceName: a.serviceCatalog.name,
        packageName: a.matchedPackage?.name ?? null,
        amount: a.matchedPackage?.finalPrice ?? 0,
      })),
      recentOrders: recentOrders.map((o) => ({
        id: o.id,
        status: o.status,
        serviceName: o.serviceCatalog.name,
        packageName: o.matchedPackage?.name ?? null,
        amount: o.orderContract?.currentVersion?.amount ?? o.matchedPackage?.finalPrice ?? 0,
        currency: o.orderContract?.currentVersion?.currency ?? o.matchedPackage?.currency ?? 'CAD',
        customerName: (o.customer.displayName ?? `${o.customer.firstName ?? ''} ${o.customer.lastName ?? ''}`.trim()) || 'Unknown',
        createdAt: o.createdAt.toISOString(),
        updatedAt: o.updatedAt.toISOString(),
      })),
      staff: staffMembers.map((s) => ({
        userId: s.userId,
        displayName: s.user.displayName,
        firstName: s.user.firstName,
        lastName: s.user.lastName,
        avatarUrl: s.user.avatarUrl,
        role: s.role,
        staffRole: s.staffRole,
        lastSeenAt: s.user.lastSeenAt?.toISOString() ?? null,
      })),
      topCustomers,
      recentActivity,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// GET /api/workspace/:workspaceId/finance — Finance overview
router.get('/:workspaceId/finance', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId } = req.params;
    const userId = req.user!.userId;

    // Verify workspace membership
    try {
      await assertWorkspaceMember(userId, workspaceId);
    } catch (e) {
      if (e instanceof WorkspaceAccessError) {
        return res.status(403).json({ error: 'Not a workspace member' });
      }
      throw e;
    }

    const financeData = await buildProviderWorkspaceFinance(workspaceId);

    // Add pipeline breakdown
    const pipelineStatuses = ['draft', 'submitted', 'matching', 'matched', 'contracted', 'paid', 'in_progress', 'completed', 'disputed', 'closed'] as const;
    const pipeline: Record<string, { count: number; amount: number }> = {};
    for (const s of pipelineStatuses) {
      pipeline[s] = { count: 0, amount: 0 };
    }
    for (const inv of financeData.invoices) {
      const s = inv.orderStatus;
      if (s in pipeline) {
        pipeline[s].count += 1;
        pipeline[s].amount += inv.amount;
      }
    }

    res.json({
      ...financeData,
      pipeline,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

export default router;
