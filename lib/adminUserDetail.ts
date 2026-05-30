import type { Prisma } from '@prisma/client';
import prisma from './db.js';
import { mapUserToRow, userListInclude } from './adminUsersList.js';

export async function fetchAdminUserFull(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: userListInclude,
  });
  if (!user) return null;

  const orderWhereUser: Prisma.OrderWhereInput = {
    OR: [{ customerId: userId }, { matchedProviderId: userId }],
  };

  const [auditLogs, transactions, contracts, requests, ordersSummary] = await Promise.all([
    prisma.auditLog.findMany({
      where: {
        OR: [{ resourceId: userId }, { actorId: userId }],
      },
      orderBy: { timestamp: 'desc' },
      take: 20,
      include: { actor: { select: { id: true, email: true, displayName: true } } },
    }),
    (async () => {
      const companyIds = new Set<string>();
      if (user.companyId) companyIds.add(user.companyId);
      const rows = await prisma.companyUser.findMany({ where: { userId }, select: { companyId: true } });
      for (const r of rows) companyIds.add(r.companyId);
      const owned = await prisma.company.findUnique({ where: { ownerId: userId }, select: { id: true } });
      if (owned) companyIds.add(owned.id);
      return prisma.transaction.findMany({
        where: {
          OR: [{ customerId: userId }, { companyId: { in: [...companyIds] } }],
        },
        orderBy: { timestamp: 'desc' },
        take: 10,
        include: {
          customer: { select: { id: true, displayName: true, email: true } },
          company: { select: { id: true, name: true } },
        },
      });
    })(),
    prisma.contract.findMany({
      where: { OR: [{ customerId: userId }, { providerId: userId }] },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.request.findMany({
      where: { OR: [{ customerId: userId }, { providerId: userId }] },
      orderBy: { createdAt: 'desc' },
      take: 30,
      include: {
        service: { select: { id: true, title: true, price: true } },
        customer: { select: { id: true, displayName: true, email: true } },
        provider: { select: { id: true, displayName: true, email: true } },
      },
    }),
    (async () => {
      const [byStatusRows, asCustomer, asProvider, recentRows] = await Promise.all([
        prisma.order.groupBy({
          by: ['status'],
          where: orderWhereUser,
          _count: { _all: true },
        }),
        prisma.order.count({ where: { customerId: userId } }),
        prisma.order.count({ where: { matchedProviderId: userId } }),
        prisma.order.findMany({
          where: orderWhereUser,
          orderBy: { updatedAt: 'desc' },
          take: 20,
          select: {
            id: true,
            status: true,
            phase: true,
            createdAt: true,
            updatedAt: true,
            customerId: true,
            serviceCatalog: { select: { id: true, name: true } },
            matchedWorkspace: { select: { id: true, name: true } },
          },
        }),
      ]);
      const byStatus: Record<string, number> = {};
      for (const r of byStatusRows) {
        byStatus[r.status] = r._count._all;
      }
      const total = Object.values(byStatus).reduce((a, b) => a + b, 0);
      return {
        total,
        asCustomer,
        asMatchedProvider: asProvider,
        byStatus,
        recent: recentRows.map((o) => ({
          id: o.id,
          status: o.status,
          phase: o.phase,
          createdAt: o.createdAt.toISOString(),
          updatedAt: o.updatedAt.toISOString(),
          relation: o.customerId === userId ? ('customer' as const) : ('provider' as const),
          serviceCatalogId: o.serviceCatalog.id,
          serviceName: o.serviceCatalog.name,
          workspaceId: o.matchedWorkspace?.id ?? null,
          workspaceName: o.matchedWorkspace?.name ?? null,
        })),
      };
    })(),
  ]);

  return {
    user: mapUserToRow(user),
    kycRecord: user.kyc
      ? {
          id: user.kyc.id,
          type: user.kyc.type,
          status: user.kyc.status,
          createdAt: user.kyc.createdAt.toISOString(),
        }
      : null,
    auditLogs,
    transactions,
    contracts,
    requests,
    ordersSummary,
  };
}
