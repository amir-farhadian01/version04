import { Router, Response } from 'express';
import { MatchAttemptStatus, OrderPhase, OrderStatus, Prisma } from '@prisma/client';
import prisma from '../lib/db.js';
import {
  authenticate,
  isAdmin,
  requireRole,
  AuthRequest,
} from '../lib/auth.middleware.js';
import { getAdminOrdersList } from '../lib/adminOrdersList.js';
import { categoryBreadcrumbs } from '../lib/categoryBreadcrumbs.js';
import { isServiceQuestionnaireV1 } from '../lib/serviceDefinitionTypes.js';
import { phaseFromStatus } from '../lib/orderPhase.js';
import {
  findEligiblePackagesForOffer,
  findEligibleNegotiationPackagesForOffer,
} from '../lib/matching/eligibility.js';
import { manualMatchOffer } from '../lib/matching/orchestrator.js';
import {
  expireStaleAttempts,
  parseOrderPriorityWeights,
  roundRobinInviteOffer,
  RoundRobinValidationError,
} from '../lib/matching/roundRobin.js';

const router = Router();

router.use(authenticate, isAdmin);

function pickStr(v: unknown): string | undefined {
  if (typeof v === 'string' && v.trim()) return v.trim();
  return undefined;
}

function startOfUtcWeek(d: Date): Date {
  const day = d.getUTCDay();
  const mondayOffset = day === 0 ? 6 : day - 1;
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - mondayOffset, 0, 0, 0, 0),
  );
}

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

router.get('/stats', async (_req: AuthRequest, res: Response) => {
  try {
    const now = new Date();
    const weekStart = startOfUtcWeek(new Date());
    const dayStart = startOfUtcDay(now);
    const cx = OrderStatus.cancelled;
    const weekWhere = { createdAt: { gte: weekStart } };
    const [
      totalOrders,
      ordersThisWeek,
      draftCount,
      submittedCount,
      cancelledCount,
      offers,
      ordersPhase,
      jobsPhase,
      offersThisWeek,
      orderPhaseThisWeek,
      jobsThisWeek,
      cancelledOffers,
      cancelledOrders,
      cancelledJobs,
      matchedAutoToday,
      matchedAutoThisWeek,
      autoMatchExhaustedThisWeek,
      declinedAttemptsThisWeek,
    ] = await Promise.all([
      prisma.order.count(),
      prisma.order.count({ where: weekWhere }),
      prisma.order.count({ where: { status: OrderStatus.draft } }),
      prisma.order.count({ where: { status: OrderStatus.submitted } }),
      prisma.order.count({ where: { status: cx } }),
      prisma.order.count({ where: { phase: OrderPhase.offer, NOT: { status: cx } } }),
      prisma.order.count({ where: { phase: OrderPhase.order, NOT: { status: cx } } }),
      prisma.order.count({ where: { phase: OrderPhase.job, NOT: { status: cx } } }),
      prisma.order.count({
        where: { phase: OrderPhase.offer, NOT: { status: cx }, ...weekWhere },
      }),
      prisma.order.count({
        where: { phase: OrderPhase.order, NOT: { status: cx }, ...weekWhere },
      }),
      prisma.order.count({
        where: { phase: OrderPhase.job, NOT: { status: cx }, ...weekWhere },
      }),
      prisma.order.count({ where: { phase: OrderPhase.offer, status: cx } }),
      prisma.order.count({ where: { phase: OrderPhase.order, status: cx } }),
      prisma.order.count({ where: { phase: OrderPhase.job, status: cx } }),
      prisma.offerMatchAttempt.count({
        where: { status: MatchAttemptStatus.matched, matchedAt: { gte: dayStart } },
      }),
      prisma.offerMatchAttempt.count({
        where: { status: MatchAttemptStatus.matched, matchedAt: { gte: weekStart } },
      }),
      prisma.order.count({
        where: { autoMatchExhausted: true, updatedAt: { gte: weekStart } },
      }),
      prisma.offerMatchAttempt.count({
        where: { status: MatchAttemptStatus.declined, respondedAt: { gte: weekStart } },
      }),
    ]);
    res.json({
      totalOrders,
      ordersThisWeek,
      draftCount,
      submittedCount,
      cancelledCount,
      offers,
      orders: ordersPhase,
      jobs: jobsPhase,
      offersThisWeek,
      orderPhaseThisWeek,
      jobsThisWeek,
      cancelledOffers,
      cancelledOrders,
      cancelledJobs,
      matchedAutoToday,
      matchedAutoThisWeek,
      autoMatchExhaustedThisWeek,
      declinedAttemptsThisWeek,
    });
  } catch (err: unknown) {
    console.error(err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
  }
});

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const r = await getAdminOrdersList(req);
    return res.status(r.status).json(r.body);
  } catch (err: unknown) {
    console.error(err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
  }
});

router.post(
  '/:id/start-round-robin',
  requireRole('owner', 'platform_admin'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const order = await prisma.order.findUnique({ where: { id } });
      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }
      if (order.status !== OrderStatus.submitted && order.status !== OrderStatus.matching) {
        return res.status(400).json({ error: 'Order must be submitted or matching' });
      }
      try {
        const result = await roundRobinInviteOffer(id);
        const snap = await prisma.order.findUnique({
          where: { id },
          select: { matchingExpiresAt: true },
        });
        return res.json({
          ...result,
          windowExpiresAt: snap?.matchingExpiresAt?.toISOString() ?? null,
        });
      } catch (e: unknown) {
        if (e instanceof RoundRobinValidationError) {
          return res.status(400).json({ error: e.message });
        }
        throw e;
      }
    } catch (err: unknown) {
      console.error(err);
      res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
    }
  },
);

router.post(
  '/:id/extend-window',
  requireRole('owner', 'platform_admin'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const raw = (req.body as Record<string, unknown>)?.hours;
      const hours =
        typeof raw === 'number'
          ? raw
          : typeof raw === 'string'
            ? Number.parseFloat(raw)
            : Number.NaN;
      if (!Number.isFinite(hours) || hours < 1 || hours > 168) {
        return res.status(400).json({ error: 'hours must be a number between 1 and 168' });
      }
      const order = await prisma.order.findUnique({ where: { id } });
      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }
      if (order.status !== OrderStatus.matching) {
        return res.status(400).json({ error: 'Order is not in matching status' });
      }
      const matchingExpiresAt = new Date(Date.now() + hours * 3600 * 1000);
      await prisma.$transaction([
        prisma.order.update({ where: { id }, data: { matchingExpiresAt } }),
        prisma.offerMatchAttempt.updateMany({
          where: { offerId: id, status: MatchAttemptStatus.invited },
          data: { expiresAt: matchingExpiresAt },
        }),
      ]);
      res.json({ matchingExpiresAt: matchingExpiresAt.toISOString() });
    } catch (err: unknown) {
      console.error(err);
      res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
    }
  },
);

router.get(
  '/:id/round-robin-state',
  requireRole('owner', 'platform_admin'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const order = await prisma.order.findUnique({ where: { id } });
      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }
      await expireStaleAttempts(id);
      const fresh = await prisma.order.findUnique({
        where: { id },
        include: {
          customer: { select: { orderPriorities: true } },
          matchAttempts: {
            orderBy: { invitedAt: 'desc' },
            include: {
              package: {
                select: {
                  id: true,
                  name: true,
                  finalPrice: true,
                  currency: true,
                  durationMinutes: true,
                  bookingMode: true,
                },
              },
              provider: {
                select: {
                  id: true,
                  displayName: true,
                  firstName: true,
                  lastName: true,
                  avatarUrl: true,
                  email: true,
                },
              },
              workspace: {
                select: { id: true, name: true, logoUrl: true, kycStatus: true },
              },
            },
          },
        },
      });
      if (!fresh) {
        return res.status(404).json({ error: 'Order not found' });
      }
      const attempted = [...new Set(fresh.matchAttempts.map((a) => a.packageId))];
      const weightMultipliers = parseOrderPriorityWeights(fresh.customer?.orderPriorities ?? null);
      const eligible = await findEligibleNegotiationPackagesForOffer(id, attempted, weightMultipliers);
      const nowMs = Date.now();
      const win = fresh.matchingExpiresAt?.getTime() ?? null;
      const secondsRemaining =
        win == null ? null : Math.max(0, Math.floor((win - nowMs) / 1000));
      function providerName(p: {
        displayName: string | null;
        firstName: string | null;
        lastName: string | null;
        email: string;
      }): string {
        if (p.displayName?.trim()) return p.displayName.trim();
        const n = `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim();
        return n || p.email;
      }
      res.json({
        orderId: id,
        status: fresh.status,
        phase: fresh.phase,
        matchingExpiresAt: fresh.matchingExpiresAt?.toISOString() ?? null,
        secondsRemaining,
        attempts: fresh.matchAttempts,
        eligibleNotInvited: eligible.slice(0, 10).map((e) => ({
          packageId: e.package.id,
          providerName: providerName(e.package.provider),
          score: e.score,
        })),
      });
    } catch (err: unknown) {
      console.error(err);
      res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
    }
  },
);

router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        customer: {
          select: {
            id: true,
            email: true,
            displayName: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            phone: true,
          },
        },
        serviceCatalog: {
          select: {
            id: true,
            name: true,
            slug: true,
            categoryId: true,
            dynamicFieldsSchema: true,
            description: true,
          },
        },
        customerReview: true,
      },
    });
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    const cid = order.serviceCatalog.categoryId;
    const breadcrumb = cid ? await categoryBreadcrumbs(cid, 5) : [];
    const snap = order.schemaSnapshot;
    const resolvedSchema =
      snap != null && isServiceQuestionnaireV1(snap)
        ? { schema: snap, staleSnapshot: false }
        : order.serviceCatalog.dynamicFieldsSchema != null &&
            isServiceQuestionnaireV1(order.serviceCatalog.dynamicFieldsSchema)
          ? { schema: order.serviceCatalog.dynamicFieldsSchema, staleSnapshot: true }
          : { schema: null, staleSnapshot: true };

    const auditLog = await prisma.auditLog.findMany({
      where: { resourceType: 'order', resourceId: id },
      orderBy: { timestamp: 'desc' },
      include: {
        actor: {
          select: { id: true, email: true, displayName: true },
        },
      },
    });

    const auditRows = auditLog.map((a) => ({
      id: a.id,
      action: a.action,
      resourceType: a.resourceType,
      resourceId: a.resourceId,
      actorId: a.actorId,
      actor: a.actor,
      timestamp: a.timestamp.toISOString(),
      metadata: a.metadata,
    }));

    res.json({
      order: {
        id: order.id,
        customerId: order.customerId,
        serviceCatalogId: order.serviceCatalogId,
        schemaSnapshot: order.schemaSnapshot,
        answers: order.answers,
        photos: order.photos,
        description: order.description,
        descriptionAiAssisted: order.descriptionAiAssisted,
        scheduledAt: order.scheduledAt?.toISOString() ?? null,
        scheduleFlexibility: order.scheduleFlexibility,
        address: order.address,
        locationLat: order.locationLat,
        locationLng: order.locationLng,
        entryPoint: order.entryPoint,
        status: order.status,
        phase: order.phase,
        cancelReason: order.cancelReason,
        cancelledAt: order.cancelledAt?.toISOString() ?? null,
        submittedAt: order.submittedAt?.toISOString() ?? null,
        createdAt: order.createdAt.toISOString(),
        updatedAt: order.updatedAt.toISOString(),
        matchedPackageId: order.matchedPackageId ?? null,
        matchedProviderId: order.matchedProviderId ?? null,
        matchedWorkspaceId: order.matchedWorkspaceId ?? null,
        autoMatchExhausted: order.autoMatchExhausted ?? false,
      },
      customerReview: order.customerReview
        ? {
            rating: order.customerReview.rating,
            reviewText: order.customerReview.reviewText,
            createdAt: order.customerReview.createdAt.toISOString(),
          }
        : null,
      customer: order.customer,
      serviceCatalog: {
        id: order.serviceCatalog.id,
        name: order.serviceCatalog.name,
        slug: order.serviceCatalog.slug,
        description: order.serviceCatalog.description,
        breadcrumb,
      },
      schema: resolvedSchema.schema,
      staleSnapshot: resolvedSchema.staleSnapshot,
      auditLog: auditRows,
      auditLogs: auditRows,
    });
  } catch (err: unknown) {
    console.error(err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
  }
});

router.get('/:id/eligibility', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    const [eligible, attempts] = await Promise.all([
      findEligiblePackagesForOffer(id),
      prisma.offerMatchAttempt.findMany({
        where: { offerId: id },
        orderBy: { invitedAt: 'desc' },
        include: {
          package: {
            select: { id: true, name: true, finalPrice: true, currency: true, bookingMode: true },
          },
          provider: {
            select: { id: true, email: true, displayName: true, isVerified: true, status: true },
          },
          workspace: { select: { id: true, name: true, kycStatus: true } },
        },
      }),
    ]);
    res.json({
      orderId: id,
      eligible: eligible.map((e) => ({
        score: e.score,
        distanceKm: e.distanceKm,
        breakdown: e.breakdown,
        package: {
          id: e.package.id,
          name: e.package.name,
          finalPrice: e.package.finalPrice,
          currency: e.package.currency,
          bookingMode: e.package.bookingMode,
        },
        workspace: {
          id: e.package.workspace.id,
          name: e.package.workspace.name,
          kycStatus: e.package.workspace.kycStatus,
        },
        provider: {
          id: e.package.provider.id,
          email: e.package.provider.email,
          isVerified: e.package.provider.isVerified,
          status: e.package.provider.status,
        },
      })),
      attempts,
    });
  } catch (err: unknown) {
    console.error(err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
  }
});

router.post('/:id/match-override', requireRole('owner', 'platform_admin'), async (req: AuthRequest, res: Response) => {
  try {
    const packageId = pickStr((req.body as Record<string, unknown>)?.packageId);
    if (!packageId) {
      return res.status(400).json({ error: 'packageId required' });
    }
    const { id } = req.params;
    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    try {
      const { attemptId } = await manualMatchOffer(id, packageId, req.user!.userId);
      res.json({ attemptId });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'match failed';
      return res.status(400).json({ error: msg });
    }
  } catch (err: unknown) {
    console.error(err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
  }
});

router.post('/:id/cancel', requireRole('owner', 'platform_admin'), async (req: AuthRequest, res: Response) => {
  try {
    const adminId = req.user!.userId;
    const { id } = req.params;
    const reason = pickStr((req.body as Record<string, unknown>)?.reason);
    if (!reason || reason.length < 5) {
      return res.status(400).json({ error: 'reason must be at least 5 characters' });
    }
    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    if (order.status !== OrderStatus.draft && order.status !== OrderStatus.submitted) {
      return res.status(400).json({ error: 'Order cannot be cancelled in its current state' });
    }
    const now = new Date();
    const updated = await prisma.$transaction(async (tx) => {
      const o = await tx.order.update({
        where: { id },
        data: {
          status: OrderStatus.cancelled,
          phase: phaseFromStatus(OrderStatus.cancelled, order.phase),
          cancelReason: reason,
          cancelledAt: now,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: adminId,
          action: 'ADMIN_CANCELLED_ORDER',
          resourceType: 'order',
          resourceId: id,
          metadata: { reason, previousStatus: order.status } as Prisma.InputJsonValue,
        },
      });
      return o;
    });
    res.json({
      id: updated.id,
      status: updated.status,
      phase: updated.phase,
      cancelReason: updated.cancelReason,
      cancelledAt: updated.cancelledAt?.toISOString() ?? null,
    });
  } catch (err: unknown) {
    console.error(err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
  }
});

export default router;
