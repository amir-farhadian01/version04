/**
 * /api/workspaces — workspace (company) access + products + BOM + service packages
 *
 * GET    /me
 * GET    /:id
 * GET    /:id/members
 * GET    /:id/products?…
 * POST   /:id/products/reorder
 * GET    /:id/products/:productId
 * POST   /:id/products
 * PUT    /:id/products/:productId
 * POST   /:id/products/:productId/archive | unarchive
 * DELETE /:id/products/:productId
 * GET    /:id/service-packages?serviceCatalogId&includeArchived
 * GET    /:id/service-packages/:pkgId
 * POST   /:id/service-packages
 * POST   /:id/service-packages/reorder
 * PUT    /:id/service-packages/:pkgId
 * POST   /:id/service-packages/:pkgId/archive
 * POST   /:id/service-packages/:pkgId/unarchive
 * DELETE /:id/service-packages/:pkgId
 * GET|POST /:id/service-packages/:pkgId/bom …
 * GET    /:id/inbox | /:id/inbox-attempts — list offer match attempts (same handler)
 * GET    /:id/finance — read-only provider finance snapshot (orders + internal transactions; no gateway)
 */
import { Router, Response } from 'express';
import { BookingMode, MatchAttemptStatus, OrderStatus, Prisma } from '@prisma/client';
import prisma from '../lib/db.js';
import { publish } from '../lib/bus.js';
import { authenticate, AuthRequest } from '../lib/auth.middleware.js';
import { phaseFromStatus } from '../lib/orderPhase.js';
import { autoMatchOffer } from '../lib/matching/orchestrator.js';
import { expireStaleAttempts, replaceAttempt } from '../lib/matching/roundRobin.js';
import { computePackageMargin } from '../lib/packageMargin.js';
import {
  assertBookingModeAllowedForCatalog,
  assertWorkspaceMember,
  listMyWorkspaces,
  WorkspaceAccessError,
} from '../lib/workspaceAccess.js';
import { buildProviderWorkspaceFinance } from '../lib/buildProviderWorkspaceFinance.js';

const router = Router();
router.use(authenticate);

const BOOKING_MODES = new Set<BookingMode>(Object.values(BookingMode));

function isWorkspaceAccessError(err: unknown): err is WorkspaceAccessError {
  return err instanceof WorkspaceAccessError;
}

function parseBookingMode(v: unknown): BookingMode | null {
  if (typeof v !== 'string' || !BOOKING_MODES.has(v as BookingMode)) {
    return null;
  }
  return v as BookingMode;
}

const PRODUCT_SORT = new Set(['createdAt', 'name', 'sku', 'unitPrice', 'sortOrder', 'category', 'updatedAt']);
const MAX_PAGE = 100;

const MATCH_ATTEMPT_STATUSES = new Set<string>(Object.values(MatchAttemptStatus));
const LOST_REASONS = new Set([
  'price_too_high',
  'response_too_slow',
  'quality_concern',
  'schedule_mismatch',
  'distance',
  'unclear_brief',
  'other',
]);

function toStrArrayInbox(x: unknown): string[] {
  if (x == null) return [];
  if (Array.isArray(x)) return x.filter((a): a is string => typeof a === 'string' && a.length > 0);
  if (typeof x === 'string' && x.length) return [x];
  return [];
}

function parseMatchAttemptStatusArray(q: AuthRequest['query']): MatchAttemptStatus[] | undefined {
  const segRaw = (q as Record<string, unknown>)['segment'];
  if (typeof segRaw === 'string' && segRaw.trim() === 'awaiting') {
    return [MatchAttemptStatus.invited];
  }
  const raw = [
    ...toStrArrayInbox((q as Record<string, unknown>)['status']),
    ...toStrArrayInbox((q as Record<string, unknown>)['status[]']),
  ].filter((s) => MATCH_ATTEMPT_STATUSES.has(s));
  if (!raw.length) return undefined;
  return raw as MatchAttemptStatus[];
}

function parseInboxPage(req: AuthRequest): { page: number; pageSize: number; skip: number } {
  const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize ?? '20'), 10) || 20));
  return { page, pageSize, skip: (page - 1) * pageSize };
}

async function expireStaleAttemptsForWorkspaceInbox(workspaceId: string): Promise<void> {
  const rows = await prisma.offerMatchAttempt.findMany({
    where: { workspaceId, status: MatchAttemptStatus.invited },
    select: { offerId: true },
    distinct: ['offerId'],
  });
  for (const row of rows) {
    await expireStaleAttempts(row.offerId);
  }
}

function parseProductPage(req: AuthRequest) {
  const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
  const pageSize = Math.min(
    MAX_PAGE,
    Math.max(1, parseInt(String(req.query.pageSize ?? '20'), 10) || 20),
  );
  return { page, pageSize, skip: (page - 1) * pageSize };
}

function parseProductArchivedFilter(v: unknown): 'archived' | 'active' | 'all' {
  if (v === 'true') return 'archived';
  if (v === 'false') return 'active';
  return 'all';
}

type BomLineMargin = { quantity: number; snapshotUnitPrice: number; snapshotCurrency: string };

function marginForPackageRow(pkg: {
  finalPrice: number;
  currency: string;
  bom?: BomLineMargin[];
}): ReturnType<typeof computePackageMargin> {
  return computePackageMargin(
    { finalPrice: pkg.finalPrice, currency: pkg.currency },
    pkg.bom ?? [],
  );
}

/**
 * When Order links `providerServicePackageId`, return count of blocking
 * orders. Until then, always 0.
 */
async function countOrdersReferencingPackage(_packageId: string): Promise<number> {
  void _packageId;
  return 0;
}

function canActAsCompanyOrPlatform(
  userId: string,
  userRole: string,
  companyOwnerId: string,
): boolean {
  if (['owner', 'platform_admin'].includes(userRole)) {
    return true;
  }
  return companyOwnerId === userId;
}

router.get('/me', async (req: AuthRequest, res: Response) => {
  try {
    const list = await listMyWorkspaces(req.user!.userId);
    res.json(list);
  } catch (err: unknown) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    await assertWorkspaceMember(req.user!.userId, req.params.id);
    const company = await prisma.company.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
        coverImageUrl: true,
        slogan: true,
        about: true,
        kycStatus: true,
        type: true,
        address: true,
        phone: true,
        website: true,
        ownerId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!company) {
      return res.status(404).json({ error: 'Workspace not found' });
    }
    res.json(company);
  } catch (err: unknown) {
    if (isWorkspaceAccessError(err)) {
      return res
        .status(err.statusCode)
        .json(err.body ?? { error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id/members', async (req: AuthRequest, res: Response) => {
  try {
    await assertWorkspaceMember(req.user!.userId, req.params.id);
    const members = await prisma.companyUser.findMany({
      where: { companyId: req.params.id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            displayName: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            role: true,
            status: true,
            phone: true,
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });
    res.json(
      members.map((m) => ({
        companyId: m.companyId,
        userId: m.userId,
        role: m.role,
        joinedAt: m.joinedAt,
        user: m.user,
      })),
    );
  } catch (err: unknown) {
    if (isWorkspaceAccessError(err)) {
      return res
        .status(err.statusCode)
        .json(err.body ?? { error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id/finance', async (req: AuthRequest, res: Response) => {
  try {
    const workspaceId = req.params.id;
    await assertWorkspaceMember(req.user!.userId, workspaceId);
    const payload = await buildProviderWorkspaceFinance(workspaceId);
    res.json(payload);
  } catch (err: unknown) {
    if (isWorkspaceAccessError(err)) {
      return res.status(err.statusCode).json(err.body ?? { error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id/dashboard/overview', async (req: AuthRequest, res: Response) => {
  try {
    const workspaceId = req.params.id;
    await assertWorkspaceMember(req.user!.userId, workspaceId);

    const pendingStatuses: OrderStatus[] = [
      OrderStatus.submitted,
      OrderStatus.matching,
      OrderStatus.matched,
      OrderStatus.contracted,
      OrderStatus.paid,
      OrderStatus.in_progress,
      OrderStatus.disputed,
    ];
    const completedStatuses: OrderStatus[] = [OrderStatus.completed, OrderStatus.closed];

    const [totalOrders, pendingOrders, completedOrders, activeStaff, completedRows] = await Promise.all([
      prisma.order.count({
        where: {
          matchedWorkspaceId: workspaceId,
          NOT: { status: OrderStatus.draft },
        },
      }),
      prisma.order.count({
        where: {
          matchedWorkspaceId: workspaceId,
          status: { in: pendingStatuses },
        },
      }),
      prisma.order.count({
        where: {
          matchedWorkspaceId: workspaceId,
          status: { in: completedStatuses },
        },
      }),
      prisma.companyUser.count({ where: { companyId: workspaceId } }),
      prisma.order.findMany({
        where: {
          matchedWorkspaceId: workspaceId,
          status: { in: completedStatuses },
        },
        select: {
          matchedPackage: {
            select: {
              finalPrice: true,
              currency: true,
            },
          },
        },
      }),
    ]);

    const totalEarnings = completedRows.reduce((sum, row) => {
      if (row.matchedPackage?.currency !== 'CAD') return sum;
      return sum + (row.matchedPackage?.finalPrice ?? 0);
    }, 0);

    res.json({
      totalOrders,
      pendingOrders,
      completedOrders,
      totalEarnings,
      activeStaff,
    });
  } catch (err: unknown) {
    if (isWorkspaceAccessError(err)) {
      return res.status(err.statusCode).json(err.body ?? { error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- Inbox (offer match attempts) ---

async function getWorkspaceInboxAttemptsList(req: AuthRequest, res: Response) {
  try {
    await assertWorkspaceMember(req.user!.userId, req.params.id);
    await expireStaleAttemptsForWorkspaceInbox(req.params.id);
    const statuses = parseMatchAttemptStatusArray(req.query);
    const { page, pageSize, skip } = parseInboxPage(req);
    const where: Prisma.OfferMatchAttemptWhereInput = {
      workspaceId: req.params.id,
      ...(statuses?.length ? { status: { in: statuses } } : {}),
    };
    const [total, rows] = await Promise.all([
      prisma.offerMatchAttempt.count({ where }),
      prisma.offerMatchAttempt.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { invitedAt: 'desc' },
        include: {
          package: {
            select: {
              id: true,
              name: true,
              description: true,
              finalPrice: true,
              currency: true,
              bookingMode: true,
              durationMinutes: true,
              serviceCatalogId: true,
              bom: {
                orderBy: { sortOrder: 'asc' },
                select: {
                  quantity: true,
                  snapshotUnitPrice: true,
                  snapshotCurrency: true,
                  snapshotProductName: true,
                  snapshotUnit: true,
                  notes: true,
                },
              },
            },
          },
          offer: {
            include: {
              customer: {
                select: {
                  id: true,
                  email: true,
                  displayName: true,
                  firstName: true,
                  lastName: true,
                  phone: true,
                  avatarUrl: true,
                },
              },
              serviceCatalog: { select: { id: true, name: true, category: true, slug: true } },
              orderContract: {
                select: {
                  currentVersion: { select: { status: true } },
                },
              },
            },
          },
        },
      }),
    ]);
    res.json({
      total,
      page,
      pageSize,
      items: rows.map((a) => ({
        id: a.id,
        providerId: a.providerId,
        workspaceId: a.workspaceId,
        status: a.status,
        score: a.score,
        distanceKm: a.distanceKm,
        invitedAt: a.invitedAt.toISOString(),
        matchedAt: a.matchedAt?.toISOString() ?? null,
        respondedAt: a.respondedAt?.toISOString() ?? null,
        declineReason: a.declineReason,
        expiresAt: a.expiresAt?.toISOString() ?? null,
        supersededAt: a.supersededAt?.toISOString() ?? null,
        lostReason: a.lostReason ?? null,
        lostFeedback: a.lostFeedback ?? null,
        metadata: a.metadata,
        package: a.package,
        order: {
          id: a.offer.id,
          customerId: a.offer.customerId,
          serviceCatalogId: a.offer.serviceCatalogId,
          answers: a.offer.answers,
          photos: a.offer.photos,
          description: a.offer.description,
          address: a.offer.address,
          scheduledAt: a.offer.scheduledAt?.toISOString() ?? null,
          scheduleFlexibility: a.offer.scheduleFlexibility,
          phase: a.offer.phase,
          status: a.offer.status,
          matchedProviderId: a.offer.matchedProviderId,
          matchedWorkspaceId: a.offer.matchedWorkspaceId,
          locationLat: a.offer.locationLat,
          locationLng: a.offer.locationLng,
          submittedAt: a.offer.submittedAt?.toISOString() ?? null,
          customerPicks: a.offer.customerPicks ?? null,
          contractSummary: a.offer.orderContract?.currentVersion
            ? { currentVersionStatus: a.offer.orderContract.currentVersion.status }
            : null,
        },
        customer: a.offer.customer,
        serviceCatalog: a.offer.serviceCatalog,
      })),
    });
  } catch (err: unknown) {
    if (isWorkspaceAccessError(err)) {
      return res.status(err.statusCode).json(err.body ?? { error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

router.get('/:id/inbox', getWorkspaceInboxAttemptsList);
router.get('/:id/inbox-attempts', getWorkspaceInboxAttemptsList);

router.get('/:id/inbox/:attemptId', async (req: AuthRequest, res: Response) => {
  try {
    await assertWorkspaceMember(req.user!.userId, req.params.id);
    const initial = await prisma.offerMatchAttempt.findFirst({
      where: { id: req.params.attemptId, workspaceId: req.params.id },
      select: { offerId: true },
    });
    if (!initial) {
      return res.status(404).json({ error: 'Attempt not found' });
    }
    await expireStaleAttempts(initial.offerId);
    const row = await prisma.offerMatchAttempt.findFirst({
      where: { id: req.params.attemptId, workspaceId: req.params.id },
      include: {
        package: {
          include: {
            serviceCatalog: { select: { id: true, name: true, category: true, lockedBookingMode: true } },
            provider: { select: { id: true, email: true, displayName: true } },
            bom: {
              orderBy: { sortOrder: 'asc' },
              select: {
                quantity: true,
                snapshotUnitPrice: true,
                snapshotCurrency: true,
                snapshotProductName: true,
                snapshotUnit: true,
                notes: true,
              },
            },
          },
        },
        offer: {
          include: {
            customer: {
              select: {
                id: true,
                email: true,
                displayName: true,
                firstName: true,
                lastName: true,
                phone: true,
                avatarUrl: true,
              },
            },
            serviceCatalog: { select: { id: true, name: true, category: true, slug: true } },
            orderContract: {
              select: {
                currentVersion: { select: { status: true } },
              },
            },
          },
        },
      },
    });
    if (!row) {
      return res.status(404).json({ error: 'Attempt not found' });
    }
    res.json({
      id: row.id,
      providerId: row.providerId,
      workspaceId: row.workspaceId,
      status: row.status,
      score: row.score,
      distanceKm: row.distanceKm,
      invitedAt: row.invitedAt.toISOString(),
      matchedAt: row.matchedAt?.toISOString() ?? null,
      respondedAt: row.respondedAt?.toISOString() ?? null,
      expiresAt: row.expiresAt?.toISOString() ?? null,
      declineReason: row.declineReason,
      supersededAt: row.supersededAt?.toISOString() ?? null,
      lostReason: row.lostReason ?? null,
      lostFeedback: row.lostFeedback ?? null,
      metadata: row.metadata,
      package: row.package,
      order: {
        id: row.offer.id,
        customerId: row.offer.customerId,
        serviceCatalogId: row.offer.serviceCatalogId,
        schemaSnapshot: row.offer.schemaSnapshot,
        answers: row.offer.answers,
        photos: row.offer.photos,
        description: row.offer.description,
        descriptionAiAssisted: row.offer.descriptionAiAssisted,
        address: row.offer.address,
        scheduledAt: row.offer.scheduledAt?.toISOString() ?? null,
        scheduleFlexibility: row.offer.scheduleFlexibility,
        phase: row.offer.phase,
        status: row.offer.status,
        matchedProviderId: row.offer.matchedProviderId,
        matchedWorkspaceId: row.offer.matchedWorkspaceId,
        locationLat: row.offer.locationLat,
        locationLng: row.offer.locationLng,
        entryPoint: row.offer.entryPoint,
        submittedAt: row.offer.submittedAt?.toISOString() ?? null,
        createdAt: row.offer.createdAt.toISOString(),
        updatedAt: row.offer.updatedAt.toISOString(),
        customerPicks: row.offer.customerPicks ?? null,
        contractSummary: row.offer.orderContract?.currentVersion
          ? { currentVersionStatus: row.offer.orderContract.currentVersion.status }
          : null,
      },
      customer: row.offer.customer,
      serviceCatalog: row.offer.serviceCatalog,
    });
  } catch (err: unknown) {
    if (isWorkspaceAccessError(err)) {
      return res.status(err.statusCode).json(err.body ?? { error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/inbox/:attemptId/acknowledge', async (req: AuthRequest, res: Response) => {
  try {
    await assertWorkspaceMember(req.user!.userId, req.params.id);
    const attempt = await prisma.offerMatchAttempt.findFirst({
      where: { id: req.params.attemptId, workspaceId: req.params.id },
    });
    if (!attempt) {
      return res.status(404).json({ error: 'Attempt not found' });
    }

    /** Round-robin invite: same outcome as POST …/accept (provider commits as a candidate). */
    if (attempt.status === MatchAttemptStatus.invited) {
      await expireStaleAttempts(attempt.offerId);
      const fresh = await prisma.offerMatchAttempt.findUnique({ where: { id: attempt.id } });
      if (!fresh) return res.status(404).json({ error: 'Attempt not found' });
      if (fresh.status !== MatchAttemptStatus.invited) {
        return res.status(400).json({ error: 'Attempt is no longer open for acknowledgment' });
      }
      const now = new Date();
      await prisma.offerMatchAttempt.update({
        where: { id: fresh.id },
        data: { status: MatchAttemptStatus.accepted, respondedAt: now },
      });
      try {
        await publish('attempts.accepted', {
          attemptId: fresh.id,
          orderId: fresh.offerId,
          providerId: fresh.providerId,
        });
      } catch {
        /* optional */
      }
      return res.json({ success: true, orderId: fresh.offerId });
    }

    if (attempt.status !== MatchAttemptStatus.matched) {
      return res.status(400).json({ error: 'Only matched or invited attempts can be acknowledged' });
    }
    const now = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.offerMatchAttempt.update({
        where: { id: attempt.id },
        data: { status: MatchAttemptStatus.accepted, respondedAt: now },
      });
      await tx.order.update({
        where: { id: attempt.offerId },
        data: {
          status: OrderStatus.contracted,
          phase: phaseFromStatus(OrderStatus.contracted),
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: req.user!.userId,
          action: 'ORDER_PROVIDER_ACKNOWLEDGED',
          resourceType: 'order',
          resourceId: attempt.offerId,
          metadata: { attemptId: attempt.id } as Prisma.InputJsonValue,
        },
      });
    });
    try {
      await publish('orders.provider_acknowledged', {
        orderId: attempt.offerId,
        attemptId: attempt.id,
      });
    } catch {
      /* NATS optional */
    }
    res.json({ success: true, orderId: attempt.offerId });
  } catch (err: unknown) {
    if (isWorkspaceAccessError(err)) {
      return res.status(err.statusCode).json(err.body ?? { error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/inbox/:attemptId/accept', async (req: AuthRequest, res: Response) => {
  try {
    await assertWorkspaceMember(req.user!.userId, req.params.id);
    const attempt = await prisma.offerMatchAttempt.findFirst({
      where: { id: req.params.attemptId, workspaceId: req.params.id },
    });
    if (!attempt) {
      return res.status(404).json({ error: 'Attempt not found' });
    }
    await expireStaleAttempts(attempt.offerId);
    const fresh = await prisma.offerMatchAttempt.findUnique({ where: { id: attempt.id } });
    if (!fresh) return res.status(404).json({ error: 'Attempt not found' });
    if (fresh.status !== MatchAttemptStatus.invited) {
      return res.status(400).json({ error: 'Only invited attempts can be accepted' });
    }
    const now = new Date();
    await prisma.offerMatchAttempt.update({
      where: { id: fresh.id },
      data: { status: MatchAttemptStatus.accepted, respondedAt: now },
    });
    const updated = await prisma.offerMatchAttempt.findUnique({
      where: { id: fresh.id },
      include: {
        package: {
          select: {
            id: true,
            name: true,
            finalPrice: true,
            currency: true,
            bookingMode: true,
            durationMinutes: true,
          },
        },
        provider: { select: { id: true, displayName: true, firstName: true, lastName: true, avatarUrl: true } },
        workspace: { select: { id: true, name: true, logoUrl: true } },
      },
    });
    try {
      await publish('attempts.accepted', {
        attemptId: fresh.id,
        orderId: fresh.offerId,
        providerId: fresh.providerId,
      });
    } catch {
      /* optional */
    }
    res.json(updated);
  } catch (err: unknown) {
    if (isWorkspaceAccessError(err)) {
      return res.status(err.statusCode).json(err.body ?? { error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/inbox/:attemptId/decline', async (req: AuthRequest, res: Response) => {
  try {
    await assertWorkspaceMember(req.user!.userId, req.params.id);
    const reason = typeof (req.body as { reason?: unknown })?.reason === 'string'
      ? String((req.body as { reason: string }).reason).trim()
      : '';
    if (reason.length < 5) {
      return res.status(400).json({ error: 'reason must be at least 5 characters' });
    }
    const attempt = await prisma.offerMatchAttempt.findFirst({
      where: { id: req.params.attemptId, workspaceId: req.params.id },
    });
    if (!attempt) {
      return res.status(404).json({ error: 'Attempt not found' });
    }
    await expireStaleAttempts(attempt.offerId);
    const currentAttempt = await prisma.offerMatchAttempt.findUnique({ where: { id: attempt.id } });
    if (!currentAttempt) {
      return res.status(404).json({ error: 'Attempt not found' });
    }
    if (
      currentAttempt.status !== MatchAttemptStatus.matched &&
      currentAttempt.status !== MatchAttemptStatus.invited
    ) {
      return res.status(400).json({ error: 'Attempt cannot be declined in this state' });
    }
    const now = new Date();
    const meta = currentAttempt.metadata as { rematchDepth?: number } | null;
    const nextDepth = (meta?.rematchDepth ?? 0) + 1;

    await prisma.$transaction(async (tx) => {
      await tx.offerMatchAttempt.update({
        where: { id: currentAttempt.id },
        data: {
          status: MatchAttemptStatus.declined,
          declineReason: reason,
          respondedAt: now,
        },
      });
      if (currentAttempt.status === MatchAttemptStatus.matched) {
        await tx.order.update({
          where: { id: currentAttempt.offerId },
          data: {
            status: OrderStatus.matching,
            phase: phaseFromStatus(OrderStatus.matching),
            matchedPackageId: null,
            matchedProviderId: null,
            matchedWorkspaceId: null,
          },
        });
      }
      await tx.auditLog.create({
        data: {
          actorId: req.user!.userId,
          action: 'ORDER_PROVIDER_DECLINED',
          resourceType: 'order',
          resourceId: currentAttempt.offerId,
          metadata: { attemptId: currentAttempt.id, reason } as Prisma.InputJsonValue,
        },
      });
    });

    let rematch: { matched: boolean; attemptId?: string; reason?: string } = { matched: false };
    if (currentAttempt.status === MatchAttemptStatus.matched) {
      const declinedRows = await prisma.offerMatchAttempt.findMany({
        where: { offerId: currentAttempt.offerId, status: MatchAttemptStatus.declined },
        select: { packageId: true },
      });
      const excludePackageIds = [...new Set(declinedRows.map((d) => d.packageId))];
      try {
        rematch = await autoMatchOffer(currentAttempt.offerId, { excludePackageIds, depth: nextDepth });
      } catch (reErr: unknown) {
        console.error(reErr);
      }
    } else {
      const orderForExpiry = await prisma.order.findUnique({
        where: { id: currentAttempt.offerId },
        select: { matchingExpiresAt: true },
      });
      const keepExpiresAt =
        currentAttempt.expiresAt ?? orderForExpiry?.matchingExpiresAt ?? new Date();
      const repl = await replaceAttempt(currentAttempt.offerId, currentAttempt.packageId, keepExpiresAt);
      rematch = {
        matched: repl.reMatched,
        ...(repl.newAttemptId ? { attemptId: repl.newAttemptId } : {}),
      };
    }

    try {
      await publish('attempts.declined', {
        orderId: currentAttempt.offerId,
        attemptId: currentAttempt.id,
        reason,
        reMatched: rematch.matched,
      });
    } catch {
      /* NATS optional */
    }

    res.json({
      reMatched: rematch.matched,
      ...(rematch.attemptId != null ? { newAttemptId: rematch.attemptId } : {}),
      ...(rematch.reason != null ? { reason: rematch.reason } : {}),
    });
  } catch (err: unknown) {
    if (isWorkspaceAccessError(err)) {
      return res.status(err.statusCode).json(err.body ?? { error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/inbox/:attemptId/lost-feedback', async (req: AuthRequest, res: Response) => {
  try {
    await assertWorkspaceMember(req.user!.userId, req.params.id);
    const attempt = await prisma.offerMatchAttempt.findFirst({
      where: { id: req.params.attemptId, workspaceId: req.params.id },
    });
    if (!attempt) {
      return res.status(404).json({ error: 'Attempt not found' });
    }
    await expireStaleAttempts(attempt.offerId);
    const fresh = await prisma.offerMatchAttempt.findUnique({ where: { id: attempt.id } });
    if (!fresh) {
      return res.status(404).json({ error: 'Attempt not found' });
    }
    if (
      fresh.status !== MatchAttemptStatus.superseded &&
      fresh.status !== MatchAttemptStatus.declined &&
      fresh.status !== MatchAttemptStatus.expired
    ) {
      return res.status(400).json({ error: 'Lost-feedback is only allowed for superseded, declined, or expired attempts' });
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    const reasonsRaw = Array.isArray(body.reasons) ? body.reasons : [];
    const reasons = reasonsRaw
      .filter((r): r is string => typeof r === 'string' && LOST_REASONS.has(r))
      .slice(0, 10);
    if (reasons.length === 0) {
      return res.status(400).json({ error: 'At least one valid reason is required' });
    }
    const payload = {
      reasons,
      ...(typeof body.otherText === 'string' && body.otherText.trim()
        ? { otherText: body.otherText.trim().slice(0, 800) }
        : {}),
      ...(typeof body.providerComment === 'string' && body.providerComment.trim()
        ? { providerComment: body.providerComment.trim().slice(0, 2000) }
        : {}),
    } as Prisma.InputJsonValue;
    await prisma.offerMatchAttempt.update({
      where: { id: fresh.id },
      data: {
        lostReason: reasons.join(','),
        lostFeedback: payload,
      },
    });
    const updated = await prisma.offerMatchAttempt.findUnique({
      where: { id: fresh.id },
      include: {
        package: { select: { id: true, name: true, finalPrice: true, currency: true, bookingMode: true } },
        provider: { select: { id: true, displayName: true, email: true } },
        workspace: { select: { id: true, name: true } },
      },
    });
    try {
      await publish('attempts.lost_feedback_submitted', {
        attemptId: fresh.id,
        orderId: fresh.offerId,
        reasons,
      });
    } catch {
      /* optional */
    }
    res.json(updated);
  } catch (err: unknown) {
    if (isWorkspaceAccessError(err)) {
      return res.status(err.statusCode).json(err.body ?? { error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- Workspace products (inventory) ---

router.get('/:id/products', async (req: AuthRequest, res: Response) => {
  try {
    await assertWorkspaceMember(req.user!.userId, req.params.id);
    const { skip, pageSize, page } = parseProductPage(req);
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const category =
      typeof req.query.category === 'string' && req.query.category ? req.query.category : undefined;
    const isActiveQ =
      req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined;
    const archivedMode = parseProductArchivedFilter(req.query.archived);
    const sortBy =
      typeof req.query.sortBy === 'string' && PRODUCT_SORT.has(req.query.sortBy) ? req.query.sortBy : 'sortOrder';
    const sortDir = req.query.sortDir === 'desc' ? 'desc' : 'asc';

    const where: Prisma.ProductWhereInput = { workspaceId: req.params.id };
    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { sku: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ];
    }
    if (category) {
      where.category = category;
    }
    if (isActiveQ !== undefined) {
      where.isActive = isActiveQ;
    }
    if (archivedMode === 'archived') {
      where.archivedAt = { not: null };
    } else if (archivedMode === 'active') {
      where.archivedAt = null;
    }

    const secondaryOrder = { [sortBy]: sortDir } as Prisma.ProductOrderByWithRelationInput;

    const [total, items] = await prisma.$transaction([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: [{ sortOrder: 'asc' }, secondaryOrder],
        include: { _count: { select: { bomLines: true } } },
      }),
    ]);
    res.json({ items, total, page, pageSize });
  } catch (err: unknown) {
    if (isWorkspaceAccessError(err)) {
      return res
        .status(err.statusCode)
        .json(err.body ?? { error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/products/reorder', async (req: AuthRequest, res: Response) => {
  try {
    await assertWorkspaceMember(req.user!.userId, req.params.id);
    const orderedIds = (req.body as { orderedIds?: unknown })?.orderedIds;
    if (!Array.isArray(orderedIds) || !orderedIds.every((x): x is string => typeof x === 'string')) {
      return res.status(400).json({ error: 'orderedIds: string[] required' });
    }
    const inWorkspace = await prisma.product.findMany({
      where: { workspaceId: req.params.id },
      select: { id: true },
    });
    const allIds = new Set(inWorkspace.map((p) => p.id));
    if (orderedIds.length !== allIds.size || !orderedIds.every((id) => allIds.has(id))) {
      return res.status(400).json({
        error: 'orderedIds must list every product in this workspace exactly once',
      });
    }
    await prisma.$transaction(
      orderedIds.map((id, index) =>
        prisma.product.update({
          where: { id },
          data: { sortOrder: index },
        }),
      ),
    );
    res.json({ success: true });
  } catch (err: unknown) {
    if (isWorkspaceAccessError(err)) {
      return res
        .status(err.statusCode)
        .json(err.body ?? { error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id/products/:productId', async (req: AuthRequest, res: Response) => {
  try {
    await assertWorkspaceMember(req.user!.userId, req.params.id);
    const row = await prisma.product.findFirst({
      where: { id: req.params.productId, workspaceId: req.params.id },
      include: { _count: { select: { bomLines: true } } },
    });
    if (!row) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(row);
  } catch (err: unknown) {
    if (isWorkspaceAccessError(err)) {
      return res
        .status(err.statusCode)
        .json(err.body ?? { error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/products', async (req: AuthRequest, res: Response) => {
  try {
    await assertWorkspaceMember(req.user!.userId, req.params.id);
    const b = req.body as Record<string, unknown>;
    const name = typeof b.name === 'string' ? b.name.trim() : '';
    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }
    const unitPrice = typeof b.unitPrice === 'number' ? b.unitPrice : Number.NaN;
    if (Number.isNaN(unitPrice) || unitPrice < 0) {
      return res.status(400).json({ error: 'unitPrice must be a number >= 0' });
    }
    const sku = b.sku === undefined || b.sku === null ? null : String(b.sku).trim() || null;
    const description =
      b.description === undefined || b.description === null ? null : String(b.description);
    const category =
      b.category === undefined || b.category === null ? null : String(b.category);
    const unit =
      typeof b.unit === 'string' && b.unit.trim() ? String(b.unit).trim() : 'each';
    const currency =
      typeof b.currency === 'string' && b.currency.trim() ? String(b.currency).trim() : 'CAD';
    const stockQuantity =
      b.stockQuantity === undefined || b.stockQuantity === null
        ? null
        : typeof b.stockQuantity === 'number' && !Number.isNaN(b.stockQuantity)
          ? b.stockQuantity
          : Number(b.stockQuantity);

    const maxRow = await prisma.product.aggregate({
      where: { workspaceId: req.params.id },
      _max: { sortOrder: true },
    });
    const sortOrder = (maxRow._max.sortOrder ?? -1) + 1;

    try {
      const created = await prisma.product.create({
        data: {
          workspaceId: req.params.id,
          name,
          sku: sku ?? undefined,
          description: description ?? undefined,
          category: category ?? undefined,
          unit,
          unitPrice,
          currency,
          stockQuantity: stockQuantity != null && !Number.isNaN(stockQuantity as number) ? (stockQuantity as number) : undefined,
          sortOrder,
        },
        include: { _count: { select: { bomLines: true } } },
      });
      return res.status(201).json(created);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        return res.status(409).json({ error: 'Duplicate SKU in this workspace' });
      }
      throw e;
    }
  } catch (err: unknown) {
    if (isWorkspaceAccessError(err)) {
      return res
        .status(err.statusCode)
        .json(err.body ?? { error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id/products/:productId', async (req: AuthRequest, res: Response) => {
  try {
    await assertWorkspaceMember(req.user!.userId, req.params.id);
    const existing = await prisma.product.findFirst({
      where: { id: req.params.productId, workspaceId: req.params.id },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Product not found' });
    }
    const b = req.body as Record<string, unknown>;
    const name = typeof b.name === 'string' ? b.name.trim() : existing.name;
    const unitPrice =
      typeof b.unitPrice === 'number' && !Number.isNaN(b.unitPrice) ? b.unitPrice : existing.unitPrice;
    if (unitPrice < 0) {
      return res.status(400).json({ error: 'unitPrice must be >= 0' });
    }
    const sku =
      b.sku === undefined
        ? existing.sku
        : b.sku === null
          ? null
          : String(b.sku).trim() || null;
    const description =
      b.description === undefined
        ? existing.description
        : b.description === null
          ? null
          : String(b.description);
    const category =
      b.category === undefined
        ? existing.category
        : b.category === null
          ? null
          : String(b.category);
    const unit = typeof b.unit === 'string' && b.unit.trim() ? String(b.unit).trim() : existing.unit;
    const currency =
      typeof b.currency === 'string' && b.currency.trim() ? String(b.currency).trim() : existing.currency;
    const stockQuantity =
      b.stockQuantity === undefined
        ? existing.stockQuantity
        : b.stockQuantity === null
          ? null
          : typeof b.stockQuantity === 'number' && !Number.isNaN(b.stockQuantity)
            ? b.stockQuantity
            : Number(b.stockQuantity);
    const isActive =
      typeof b.isActive === 'boolean' ? b.isActive : existing.isActive;

    try {
      const updated = await prisma.product.update({
        where: { id: existing.id },
        data: {
          name,
          sku: sku === null ? null : sku ?? undefined,
          description: description ?? undefined,
          category: category ?? undefined,
          unit,
          unitPrice,
          currency,
          stockQuantity: stockQuantity === null ? null : (stockQuantity ?? undefined),
          isActive,
        },
        include: { _count: { select: { bomLines: true } } },
      });
      return res.json(updated);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        return res.status(409).json({ error: 'Duplicate SKU in this workspace' });
      }
      throw e;
    }
  } catch (err: unknown) {
    if (isWorkspaceAccessError(err)) {
      return res
        .status(err.statusCode)
        .json(err.body ?? { error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/products/:productId/archive', async (req: AuthRequest, res: Response) => {
  try {
    await assertWorkspaceMember(req.user!.userId, req.params.id);
    const row = await prisma.product.findFirst({
      where: { id: req.params.productId, workspaceId: req.params.id },
    });
    if (!row) {
      return res.status(404).json({ error: 'Product not found' });
    }
    const updated = await prisma.product.update({
      where: { id: row.id },
      data: { archivedAt: new Date(), isActive: false },
      include: { _count: { select: { bomLines: true } } },
    });
    res.json(updated);
  } catch (err: unknown) {
    if (isWorkspaceAccessError(err)) {
      return res
        .status(err.statusCode)
        .json(err.body ?? { error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/products/:productId/unarchive', async (req: AuthRequest, res: Response) => {
  try {
    await assertWorkspaceMember(req.user!.userId, req.params.id);
    const row = await prisma.product.findFirst({
      where: { id: req.params.productId, workspaceId: req.params.id },
    });
    if (!row) {
      return res.status(404).json({ error: 'Product not found' });
    }
    const updated = await prisma.product.update({
      where: { id: row.id },
      data: { archivedAt: null, isActive: true },
      include: { _count: { select: { bomLines: true } } },
    });
    res.json(updated);
  } catch (err: unknown) {
    if (isWorkspaceAccessError(err)) {
      return res
        .status(err.statusCode)
        .json(err.body ?? { error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id/products/:productId', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const userRole = req.user!.role;
    const company = await prisma.company.findUnique({ where: { id: req.params.id } });
    if (!company) {
      return res.status(404).json({ error: 'Workspace not found' });
    }
    if (!canActAsCompanyOrPlatform(userId, userRole, company.ownerId)) {
      return res.status(403).json({ error: 'Only the company owner or a platform admin can delete products' });
    }
    if (!['owner', 'platform_admin'].includes(userRole)) {
      await assertWorkspaceMember(userId, req.params.id);
    }
    const row = await prisma.product.findFirst({
      where: { id: req.params.productId, workspaceId: req.params.id },
    });
    if (!row) {
      return res.status(404).json({ error: 'Product not found' });
    }
    const refs = await prisma.productInPackage.findMany({
      where: { productId: row.id },
      select: { packageId: true },
    });
    if (refs.length > 0) {
      return res.status(409).json({
        error: 'Product is referenced by one or more package BOM lines; cannot delete',
        referenceCount: refs.length,
        packageIds: [...new Set(refs.map((r) => r.packageId))],
      });
    }
    await prisma.product.delete({ where: { id: row.id } });
    res.json({ success: true });
  } catch (err: unknown) {
    if (isWorkspaceAccessError(err)) {
      return res
        .status(err.statusCode)
        .json(err.body ?? { error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- Package BOM ---

router.get('/:id/service-packages', async (req: AuthRequest, res: Response) => {
  try {
    await assertWorkspaceMember(req.user!.userId, req.params.id);
    const serviceCatalogId =
      typeof req.query.serviceCatalogId === 'string' && req.query.serviceCatalogId
        ? req.query.serviceCatalogId
        : undefined;
    const includeArchived = req.query.includeArchived === 'true';
    const where: Prisma.ProviderServicePackageWhereInput = {
      workspaceId: req.params.id,
      ...(includeArchived ? {} : { archivedAt: null }),
      ...(serviceCatalogId ? { serviceCatalogId } : {}),
    };
    const items = await prisma.providerServicePackage.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: {
        serviceCatalog: { select: { id: true, name: true, category: true, archivedAt: true, lockedBookingMode: true } },
        provider: { select: { id: true, displayName: true, email: true } },
        _count: { select: { bom: true } },
        bom: {
          select: { quantity: true, snapshotUnitPrice: true, snapshotCurrency: true },
        },
      },
    });
    res.json(
      items.map(({ bom, ...pkg }) => ({
        ...pkg,
        margin: marginForPackageRow({ ...pkg, bom }),
      })),
    );
  } catch (err: unknown) {
    if (isWorkspaceAccessError(err)) {
      return res
        .status(err.statusCode)
        .json(err.body ?? { error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id/service-packages/:pkgId', async (req: AuthRequest, res: Response) => {
  try {
    await assertWorkspaceMember(req.user!.userId, req.params.id);
    const row = await prisma.providerServicePackage.findFirst({
      where: { id: req.params.pkgId, workspaceId: req.params.id },
      include: {
        serviceCatalog: { select: { id: true, name: true, category: true, archivedAt: true, lockedBookingMode: true } },
        provider: { select: { id: true, displayName: true, email: true } },
        _count: { select: { bom: true } },
        bom: {
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          include: {
            product: { select: { id: true, name: true, sku: true, archivedAt: true, unitPrice: true, currency: true } },
          },
        },
      },
    });
    if (!row) {
      return res.status(404).json({ error: 'Package not found' });
    }
    const margin = marginForPackageRow(row);
    const { bom: bomLines, ...pkg } = row;
    res.json({
      ...pkg,
      bom: bomLines,
      margin,
    });
  } catch (err: unknown) {
    if (isWorkspaceAccessError(err)) {
      return res
        .status(err.statusCode)
        .json(err.body ?? { error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/service-packages/reorder', async (req: AuthRequest, res: Response) => {
  try {
    await assertWorkspaceMember(req.user!.userId, req.params.id);
    const orderedIds = (req.body as { orderedIds?: unknown })?.orderedIds;
    if (!Array.isArray(orderedIds) || !orderedIds.every((x): x is string => typeof x === 'string')) {
      return res.status(400).json({ error: 'orderedIds: string[] required' });
    }
    const inWorkspace = await prisma.providerServicePackage.findMany({
      where: { workspaceId: req.params.id },
      select: { id: true },
    });
    const allIds = new Set(inWorkspace.map((p) => p.id));
    if (orderedIds.length !== allIds.size || !orderedIds.every((id) => allIds.has(id))) {
      return res.status(400).json({
        error: 'orderedIds must list every service package in this workspace exactly once',
      });
    }
    await prisma.$transaction(
      orderedIds.map((id, index) =>
        prisma.providerServicePackage.update({
          where: { id },
          data: { sortOrder: index },
        }),
      ),
    );
    res.json({ success: true });
  } catch (err: unknown) {
    if (isWorkspaceAccessError(err)) {
      return res
        .status(err.statusCode)
        .json(err.body ?? { error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/service-packages', async (req: AuthRequest, res: Response) => {
  try {
    await assertWorkspaceMember(req.user!.userId, req.params.id);
    const b = req.body as Record<string, unknown>;
    const serviceCatalogId = typeof b.serviceCatalogId === 'string' ? b.serviceCatalogId : '';
    const name = typeof b.name === 'string' ? b.name.trim() : '';
    const finalPrice = typeof b.finalPrice === 'number' ? b.finalPrice : Number.NaN;
    const bookingMode = parseBookingMode(b.bookingMode);
    const description =
      b.description === undefined || b.description === null
        ? null
        : String(b.description);
    const durationMinutes =
      b.durationMinutes === undefined || b.durationMinutes === null
        ? null
        : Number(b.durationMinutes);

    if (!serviceCatalogId) {
      return res.status(400).json({ error: 'serviceCatalogId is required' });
    }
    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }
    if (Number.isNaN(finalPrice) || finalPrice < 0) {
      return res.status(400).json({ error: 'finalPrice must be a number >= 0' });
    }
    if (!bookingMode) {
      return res.status(400).json({ error: 'valid bookingMode is required' });
    }
    if (durationMinutes != null) {
      if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 1440) {
        return res.status(400).json({ error: 'durationMinutes must be 1..1440 when set' });
      }
    }

    const catalog = await prisma.serviceCatalog.findUnique({ where: { id: serviceCatalogId } });
    if (!catalog) {
      return res.status(400).json({ error: 'service catalog not found' });
    }
    if (catalog.archivedAt != null) {
      return res.status(400).json({ error: 'service catalog is archived' });
    }
    try {
      assertBookingModeAllowedForCatalog(catalog.lockedBookingMode, bookingMode);
    } catch (e) {
      if (isWorkspaceAccessError(e)) {
        return res.status(e.statusCode).json(e.body ?? { error: e.message });
      }
      throw e;
    }

    const maxRow = await prisma.providerServicePackage.aggregate({
      where: { workspaceId: req.params.id },
      _max: { sortOrder: true },
    });
    const sortOrder = (maxRow._max.sortOrder ?? -1) + 1;

    try {
      const created = await prisma.providerServicePackage.create({
        data: {
          providerId: req.user!.userId,
          workspaceId: req.params.id,
          serviceCatalogId,
          name,
          description: description ?? undefined,
          finalPrice,
          currency: typeof b.currency === 'string' && b.currency ? String(b.currency) : 'CAD',
          bookingMode,
          durationMinutes: durationMinutes ?? undefined,
          sortOrder,
        },
        include: {
          serviceCatalog: { select: { id: true, name: true, category: true, archivedAt: true, lockedBookingMode: true } },
          provider: { select: { id: true, displayName: true, email: true } },
        },
      });
      return res.status(201).json(created);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        return res.status(409).json({
          error: 'A package with this name already exists for this service in this workspace',
        });
      }
      throw e;
    }
  } catch (err: unknown) {
    if (isWorkspaceAccessError(err)) {
      return res
        .status(err.statusCode)
        .json(err.body ?? { error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id/service-packages/:pkgId', async (req: AuthRequest, res: Response) => {
  try {
    await assertWorkspaceMember(req.user!.userId, req.params.id);
    const existing = await prisma.providerServicePackage.findFirst({
      where: { id: req.params.pkgId, workspaceId: req.params.id },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Package not found' });
    }
    if (
      (req.body as { serviceCatalogId?: unknown })?.serviceCatalogId != null &&
      String((req.body as { serviceCatalogId?: unknown }).serviceCatalogId) !== existing.serviceCatalogId
    ) {
      return res.status(400).json({ error: 'Cannot change serviceCatalogId for a package' });
    }
    const b = req.body as Record<string, unknown>;
    const name = typeof b.name === 'string' ? b.name.trim() : existing.name;
    const finalPrice =
      typeof b.finalPrice === 'number' && !Number.isNaN(b.finalPrice) ? b.finalPrice : existing.finalPrice;
    const bookingMode = parseBookingMode(b.bookingMode) ?? existing.bookingMode;
    const description =
      b.description === undefined
        ? existing.description
        : b.description === null
          ? null
          : String(b.description);
    const durationMinutes =
      b.durationMinutes === undefined
        ? existing.durationMinutes
        : b.durationMinutes === null
          ? null
          : Number(b.durationMinutes);

    if (finalPrice < 0) {
      return res.status(400).json({ error: 'finalPrice must be >= 0' });
    }
    if (durationMinutes != null) {
      if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 1440) {
        return res.status(400).json({ error: 'durationMinutes must be 1..1440 when set' });
      }
    }
    const catalog = await prisma.serviceCatalog.findUnique({ where: { id: existing.serviceCatalogId } });
    if (!catalog) {
      return res.status(400).json({ error: 'service catalog not found' });
    }
    if (catalog.archivedAt != null) {
      return res.status(400).json({ error: 'service catalog is archived' });
    }
    try {
      assertBookingModeAllowedForCatalog(catalog.lockedBookingMode, bookingMode);
    } catch (e) {
      if (isWorkspaceAccessError(e)) {
        return res.status(e.statusCode).json(e.body ?? { error: e.message });
      }
      throw e;
    }

    try {
      const updated = await prisma.providerServicePackage.update({
        where: { id: existing.id },
        data: {
          name,
          description: description ?? undefined,
          finalPrice,
          currency: typeof b.currency === 'string' && b.currency ? String(b.currency) : undefined,
          bookingMode,
          durationMinutes: durationMinutes === null ? null : (durationMinutes ?? undefined),
        },
        include: {
          serviceCatalog: { select: { id: true, name: true, category: true, archivedAt: true, lockedBookingMode: true } },
          provider: { select: { id: true, displayName: true, email: true } },
        },
      });
      return res.json(updated);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        return res.status(409).json({
          error: 'A package with this name already exists for this service in this workspace',
        });
      }
      throw e;
    }
  } catch (err: unknown) {
    if (isWorkspaceAccessError(err)) {
      return res
        .status(err.statusCode)
        .json(err.body ?? { error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/service-packages/:pkgId/archive', async (req: AuthRequest, res: Response) => {
  try {
    await assertWorkspaceMember(req.user!.userId, req.params.id);
    const row = await prisma.providerServicePackage.findFirst({
      where: { id: req.params.pkgId, workspaceId: req.params.id },
    });
    if (!row) {
      return res.status(404).json({ error: 'Package not found' });
    }
    const updated = await prisma.providerServicePackage.update({
      where: { id: row.id },
      data: { archivedAt: new Date(), isActive: false },
      include: {
        serviceCatalog: { select: { id: true, name: true, category: true, archivedAt: true, lockedBookingMode: true } },
        provider: { select: { id: true, displayName: true, email: true } },
      },
    });
    res.json(updated);
  } catch (err: unknown) {
    if (isWorkspaceAccessError(err)) {
      return res
        .status(err.statusCode)
        .json(err.body ?? { error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/service-packages/:pkgId/unarchive', async (req: AuthRequest, res: Response) => {
  try {
    await assertWorkspaceMember(req.user!.userId, req.params.id);
    const row = await prisma.providerServicePackage.findFirst({
      where: { id: req.params.pkgId, workspaceId: req.params.id },
    });
    if (!row) {
      return res.status(404).json({ error: 'Package not found' });
    }
    const updated = await prisma.providerServicePackage.update({
      where: { id: row.id },
      data: { archivedAt: null, isActive: true },
      include: {
        serviceCatalog: { select: { id: true, name: true, category: true, archivedAt: true, lockedBookingMode: true } },
        provider: { select: { id: true, displayName: true, email: true } },
      },
    });
    res.json(updated);
  } catch (err: unknown) {
    if (isWorkspaceAccessError(err)) {
      return res
        .status(err.statusCode)
        .json(err.body ?? { error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id/service-packages/:pkgId', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const userRole = req.user!.role;
    const company = await prisma.company.findUnique({ where: { id: req.params.id } });
    if (!company) {
      return res.status(404).json({ error: 'Workspace not found' });
    }
    if (!canActAsCompanyOrPlatform(userId, userRole, company.ownerId)) {
      return res.status(403).json({ error: 'Only the company owner or a platform admin can delete packages' });
    }
    if (!['owner', 'platform_admin'].includes(userRole)) {
      await assertWorkspaceMember(userId, req.params.id);
    }
    const row = await prisma.providerServicePackage.findFirst({
      where: { id: req.params.pkgId, workspaceId: req.params.id },
    });
    if (!row) {
      return res.status(404).json({ error: 'Package not found' });
    }
    const blocking = await countOrdersReferencingPackage(row.id);
    if (blocking > 0) {
      return res.status(409).json({
        error: 'Package is referenced by orders; cannot delete',
        orderCount: blocking,
      });
    }
    await prisma.providerServicePackage.delete({ where: { id: row.id } });
    res.json({ success: true });
  } catch (err: unknown) {
    if (isWorkspaceAccessError(err)) {
      return res
        .status(err.statusCode)
        .json(err.body ?? { error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

async function assertPackageInWorkspace(workspaceId: string, pkgId: string) {
  const pkg = await prisma.providerServicePackage.findFirst({
    where: { id: pkgId, workspaceId },
  });
  if (!pkg) {
    return null;
  }
  return pkg;
}

router.get('/:id/service-packages/:pkgId/bom', async (req: AuthRequest, res: Response) => {
  try {
    await assertWorkspaceMember(req.user!.userId, req.params.id);
    const pkg = await assertPackageInWorkspace(req.params.id, req.params.pkgId);
    if (!pkg) {
      return res.status(404).json({ error: 'Package not found' });
    }
    const lines = await prisma.productInPackage.findMany({
      where: { packageId: pkg.id },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: {
        product: { select: { id: true, name: true, sku: true, archivedAt: true, unitPrice: true, currency: true } },
      },
    });
    const margin = computePackageMargin(
      { finalPrice: pkg.finalPrice, currency: pkg.currency },
      lines,
    );
    res.json({ lines, margin });
  } catch (err: unknown) {
    if (isWorkspaceAccessError(err)) {
      return res
        .status(err.statusCode)
        .json(err.body ?? { error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/service-packages/:pkgId/bom/refresh-all', async (req: AuthRequest, res: Response) => {
  try {
    await assertWorkspaceMember(req.user!.userId, req.params.id);
    const pkg = await assertPackageInWorkspace(req.params.id, req.params.pkgId);
    if (!pkg) {
      return res.status(404).json({ error: 'Package not found' });
    }
    const lines = await prisma.$transaction(async (tx) => {
      const existing = await tx.productInPackage.findMany({
        where: { packageId: pkg.id },
        include: { product: true },
      });
      for (const line of existing) {
        const p = line.product;
        await tx.productInPackage.update({
          where: { id: line.id },
          data: {
            snapshotUnitPrice: p.unitPrice,
            snapshotCurrency: p.currency,
            snapshotProductName: p.name,
            snapshotUnit: p.unit,
          },
        });
      }
      return tx.productInPackage.findMany({
        where: { packageId: pkg.id },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        include: {
          product: { select: { id: true, name: true, sku: true, archivedAt: true, unitPrice: true, currency: true } },
        },
      });
    });
    const margin = computePackageMargin(
      { finalPrice: pkg.finalPrice, currency: pkg.currency },
      lines,
    );
    res.json({ lines, margin });
  } catch (err: unknown) {
    if (isWorkspaceAccessError(err)) {
      return res
        .status(err.statusCode)
        .json(err.body ?? { error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/service-packages/:pkgId/bom/reorder', async (req: AuthRequest, res: Response) => {
  try {
    await assertWorkspaceMember(req.user!.userId, req.params.id);
    const pkg = await assertPackageInWorkspace(req.params.id, req.params.pkgId);
    if (!pkg) {
      return res.status(404).json({ error: 'Package not found' });
    }
    const orderedIds = (req.body as { orderedIds?: unknown })?.orderedIds;
    if (!Array.isArray(orderedIds) || !orderedIds.every((x): x is string => typeof x === 'string')) {
      return res.status(400).json({ error: 'orderedIds: string[] required' });
    }
    const inPkg = await prisma.productInPackage.findMany({
      where: { packageId: pkg.id },
      select: { id: true },
    });
    const allIds = new Set(inPkg.map((p) => p.id));
    if (orderedIds.length !== allIds.size || !orderedIds.every((id) => allIds.has(id))) {
      return res.status(400).json({
        error: 'orderedIds must list every BOM line in this package exactly once',
      });
    }
    await prisma.$transaction(
      orderedIds.map((id, index) =>
        prisma.productInPackage.update({
          where: { id },
          data: { sortOrder: index },
        }),
      ),
    );
    res.json({ success: true });
  } catch (err: unknown) {
    if (isWorkspaceAccessError(err)) {
      return res
        .status(err.statusCode)
        .json(err.body ?? { error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/service-packages/:pkgId/bom', async (req: AuthRequest, res: Response) => {
  try {
    await assertWorkspaceMember(req.user!.userId, req.params.id);
    const pkg = await assertPackageInWorkspace(req.params.id, req.params.pkgId);
    if (!pkg) {
      return res.status(404).json({ error: 'Package not found' });
    }
    const b = req.body as Record<string, unknown>;
    const productId = typeof b.productId === 'string' ? b.productId : '';
    const quantity = typeof b.quantity === 'number' ? b.quantity : Number(b.quantity);
    const notes = b.notes === undefined || b.notes === null ? null : String(b.notes);
    if (!productId) {
      return res.status(400).json({ error: 'productId is required' });
    }
    if (Number.isNaN(quantity) || quantity <= 0) {
      return res.status(400).json({ error: 'quantity must be a number > 0' });
    }
    const product = await prisma.product.findFirst({
      where: { id: productId, workspaceId: req.params.id },
    });
    if (!product) {
      return res.status(404).json({ error: 'Product not found in this workspace' });
    }
    if (product.archivedAt != null) {
      return res.status(400).json({
        error: 'Cannot add an archived product to a BOM; unarchive the product or use a different line item',
      });
    }
    const maxRow = await prisma.productInPackage.aggregate({
      where: { packageId: pkg.id },
      _max: { sortOrder: true },
    });
    const sortOrder = (maxRow._max.sortOrder ?? -1) + 1;
    const line = await prisma.productInPackage.create({
      data: {
        packageId: pkg.id,
        productId: product.id,
        quantity,
        notes: notes ?? undefined,
        sortOrder,
        snapshotUnitPrice: product.unitPrice,
        snapshotCurrency: product.currency,
        snapshotProductName: product.name,
        snapshotUnit: product.unit,
      },
      include: {
        product: { select: { id: true, name: true, sku: true, archivedAt: true, unitPrice: true, currency: true } },
      },
    });
    res.status(201).json(line);
  } catch (err: unknown) {
    if (isWorkspaceAccessError(err)) {
      return res
        .status(err.statusCode)
        .json(err.body ?? { error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id/service-packages/:pkgId/bom/:lineId', async (req: AuthRequest, res: Response) => {
  try {
    await assertWorkspaceMember(req.user!.userId, req.params.id);
    const pkg = await assertPackageInWorkspace(req.params.id, req.params.pkgId);
    if (!pkg) {
      return res.status(404).json({ error: 'Package not found' });
    }
    const line = await prisma.productInPackage.findFirst({
      where: { id: req.params.lineId, packageId: pkg.id },
    });
    if (!line) {
      return res.status(404).json({ error: 'BOM line not found' });
    }
    const b = req.body as Record<string, unknown>;
    const quantity =
      b.quantity === undefined
        ? line.quantity
        : typeof b.quantity === 'number' && !Number.isNaN(b.quantity)
          ? b.quantity
          : Number(b.quantity);
    const notes =
      b.notes === undefined ? line.notes : b.notes === null ? null : String(b.notes);
    if (Number.isNaN(quantity) || quantity <= 0) {
      return res.status(400).json({ error: 'quantity must be a number > 0' });
    }
    const updated = await prisma.productInPackage.update({
      where: { id: line.id },
      data: { quantity, notes: notes ?? undefined },
      include: {
        product: { select: { id: true, name: true, sku: true, archivedAt: true, unitPrice: true, currency: true } },
      },
    });
    res.json(updated);
  } catch (err: unknown) {
    if (isWorkspaceAccessError(err)) {
      return res
        .status(err.statusCode)
        .json(err.body ?? { error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/service-packages/:pkgId/bom/:lineId/refresh-snapshot', async (req: AuthRequest, res: Response) => {
  try {
    await assertWorkspaceMember(req.user!.userId, req.params.id);
    const pkg = await assertPackageInWorkspace(req.params.id, req.params.pkgId);
    if (!pkg) {
      return res.status(404).json({ error: 'Package not found' });
    }
    const line = await prisma.productInPackage.findFirst({
      where: { id: req.params.lineId, packageId: pkg.id },
      include: { product: true },
    });
    if (!line) {
      return res.status(404).json({ error: 'BOM line not found' });
    }
    const p = line.product;
    const updated = await prisma.productInPackage.update({
      where: { id: line.id },
      data: {
        snapshotUnitPrice: p.unitPrice,
        snapshotCurrency: p.currency,
        snapshotProductName: p.name,
        snapshotUnit: p.unit,
      },
      include: {
        product: { select: { id: true, name: true, sku: true, archivedAt: true, unitPrice: true, currency: true } },
      },
    });
    res.json(updated);
  } catch (err: unknown) {
    if (isWorkspaceAccessError(err)) {
      return res
        .status(err.statusCode)
        .json(err.body ?? { error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id/service-packages/:pkgId/bom/:lineId', async (req: AuthRequest, res: Response) => {
  try {
    await assertWorkspaceMember(req.user!.userId, req.params.id);
    const pkg = await assertPackageInWorkspace(req.params.id, req.params.pkgId);
    if (!pkg) {
      return res.status(404).json({ error: 'Package not found' });
    }
    const line = await prisma.productInPackage.findFirst({
      where: { id: req.params.lineId, packageId: pkg.id },
    });
    if (!line) {
      return res.status(404).json({ error: 'BOM line not found' });
    }
    await prisma.productInPackage.delete({ where: { id: line.id } });
    res.json({ success: true });
  } catch (err: unknown) {
    if (isWorkspaceAccessError(err)) {
      return res
        .status(err.statusCode)
        .json(err.body ?? { error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Business CRM: Clients ────────────────────────────────────────────────

// GET /:id/crm/clients — list customers who have ordered from this workspace
router.get('/:id/crm/clients', async (req: AuthRequest, res: Response) => {
  try {
    await assertWorkspaceMember(req.user!.userId, req.params.id);
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize ?? '20'), 10) || 20));
    const search = req.query.search as string | undefined;

    const customerWhere: Record<string, unknown> = {};
    if (search) {
      customerWhere.OR = [
        { displayName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Get distinct customers who have orders in this workspace
    const orders = await prisma.order.findMany({
      where: {
        matchedWorkspaceId: req.params.id,
        customerId: { not: null },
      },
      select: { customerId: true },
      distinct: ['customerId'],
    });

    const customerIds = orders.map((o) => o.customerId).filter(Boolean) as string[];

    // Paginate customers
    const total = customerIds.length;
    const paginatedIds = customerIds.slice((page - 1) * pageSize, page * pageSize);

    const customers = await prisma.user.findMany({
      where: {
        id: { in: paginatedIds },
        ...customerWhere,
      },
      select: {
        id: true,
        displayName: true,
        email: true,
        avatarUrl: true,
        createdAt: true,
      },
      orderBy: { displayName: 'asc' },
    });

    // Enrich with order count & total spent
    const enriched = await Promise.all(
      customers.map(async (c) => {
        const [orderCount, spentAgg] = await Promise.all([
          prisma.order.count({
            where: { matchedWorkspaceId: req.params.id, customerId: c.id },
          }),
          prisma.invoice.aggregate({
            where: { workspaceId: req.params.id, customerId: c.id, status: 'PAID', archivedAt: null },
            _sum: { total: true },
          }),
        ]);
        return {
          ...c,
          orderCount,
          totalSpent: spentAgg._sum.total ?? 0,
        };
      }),
    );

    res.json({ data: enriched, total, page, pageSize });
  } catch (err: unknown) {
    if (isWorkspaceAccessError(err)) {
      return res.status(err.statusCode).json(err.body ?? { error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch CRM clients' });
  }
});

// GET /:id/crm/clients/:customerId — single client detail with order history
router.get('/:id/crm/clients/:customerId', async (req: AuthRequest, res: Response) => {
  try {
    await assertWorkspaceMember(req.user!.userId, req.params.id);

    const customer = await prisma.user.findUnique({
      where: { id: req.params.customerId },
      select: { id: true, displayName: true, email: true, avatarUrl: true, phone: true, createdAt: true },
    });

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const orders = await prisma.order.findMany({
      where: { matchedWorkspaceId: req.params.id, customerId: req.params.customerId },
      include: {
        serviceCatalog: { select: { id: true, name: true } },
        invoice: { select: { id: true, status: true, total: true, createdAt: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Use invoice totals for spent calculation since Order has no totalAmount
    const totalSpent = orders.reduce((sum, o) => sum + (o.invoice?.total ?? 0), 0);

    res.json({ data: { ...customer, orders, totalSpent } });
  } catch (err: unknown) {
    if (isWorkspaceAccessError(err)) {
      return res.status(err.statusCode).json(err.body ?? { error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch client detail' });
  }
});

// ─── Business CRM: Invoices ───────────────────────────────────────────────

// GET /:id/crm/invoices — list invoices for this workspace
router.get('/:id/crm/invoices', async (req: AuthRequest, res: Response) => {
  try {
    await assertWorkspaceMember(req.user!.userId, req.params.id);
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize ?? '20'), 10) || 20));
    const status = req.query.status as string | undefined;

    const where: Record<string, unknown> = { workspaceId: req.params.id, archivedAt: null };
    if (status) where.status = status;

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        include: {
          customer: { select: { id: true, displayName: true, email: true } },
          order: { select: { id: true, status: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.invoice.count({ where }),
    ]);

    res.json({ data: invoices, total, page, pageSize });
  } catch (err: unknown) {
    if (isWorkspaceAccessError(err)) {
      return res.status(err.statusCode).json(err.body ?? { error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

// POST /:id/crm/invoices — create a manual invoice
router.post('/:id/crm/invoices', async (req: AuthRequest, res: Response) => {
  try {
    await assertWorkspaceMember(req.user!.userId, req.params.id);
    const { customerId, orderId, lineItems, subtotal, tax, total, dueDate, notes } = req.body as {
      customerId?: string;
      orderId?: string;
      lineItems?: unknown;
      subtotal?: number;
      tax?: number;
      total?: number;
      dueDate?: string;
      notes?: string;
    };

    if (!customerId || !lineItems || subtotal === undefined || total === undefined) {
      return res.status(400).json({ error: 'customerId, lineItems, subtotal, and total are required' });
    }

    const invoice = await prisma.invoice.create({
      data: {
        workspaceId: req.params.id,
        customerId,
        orderId: orderId ?? null,
        lineItems: lineItems as any,
        subtotal,
        tax: tax ?? 0,
        total,
        dueDate: dueDate ? new Date(dueDate) : null,
        notes: notes ?? null,
        status: 'DRAFT',
      },
    });

    res.status(201).json(invoice);
  } catch (err: unknown) {
    if (isWorkspaceAccessError(err)) {
      return res.status(err.statusCode).json(err.body ?? { error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to create invoice' });
  }
});

// PUT /:id/crm/invoices/:invoiceId — update invoice (only if DRAFT)
router.put('/:id/crm/invoices/:invoiceId', async (req: AuthRequest, res: Response) => {
  try {
    await assertWorkspaceMember(req.user!.userId, req.params.id);

    const existing = await prisma.invoice.findUnique({ where: { id: req.params.invoiceId } });
    if (!existing || existing.workspaceId !== req.params.id) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    if (existing.status !== 'DRAFT') {
      return res.status(400).json({ error: 'Only DRAFT invoices can be edited' });
    }

    const { lineItems, subtotal, tax, total, dueDate, notes } = req.body as {
      lineItems?: unknown;
      subtotal?: number;
      tax?: number;
      total?: number;
      dueDate?: string;
      notes?: string;
    };

    const invoice = await prisma.invoice.update({
      where: { id: req.params.invoiceId },
      data: {
        ...(lineItems !== undefined && { lineItems: lineItems as any }),
        ...(subtotal !== undefined && { subtotal }),
        ...(tax !== undefined && { tax }),
        ...(total !== undefined && { total }),
        ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
        ...(notes !== undefined && { notes }),
      },
    });

    res.json(invoice);
  } catch (err: unknown) {
    if (isWorkspaceAccessError(err)) {
      return res.status(err.statusCode).json(err.body ?? { error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to update invoice' });
  }
});

// POST /:id/crm/invoices/:invoiceId/send — mark invoice as sent
router.post('/:id/crm/invoices/:invoiceId/send', async (req: AuthRequest, res: Response) => {
  try {
    await assertWorkspaceMember(req.user!.userId, req.params.id);

    const existing = await prisma.invoice.findUnique({ where: { id: req.params.invoiceId } });
    if (!existing || existing.workspaceId !== req.params.id) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    if (existing.status !== 'DRAFT') {
      return res.status(400).json({ error: 'Invoice has already been sent' });
    }

    const invoice = await prisma.invoice.update({
      where: { id: req.params.invoiceId },
      data: { status: 'SENT', sentAt: new Date() },
    });

    res.json(invoice);
  } catch (err: unknown) {
    if (isWorkspaceAccessError(err)) {
      return res.status(err.statusCode).json(err.body ?? { error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to send invoice' });
  }
});

// POST /:id/crm/invoices/:invoiceId/pay — mark invoice as paid
router.post('/:id/crm/invoices/:invoiceId/pay', async (req: AuthRequest, res: Response) => {
  try {
    await assertWorkspaceMember(req.user!.userId, req.params.id);

    const existing = await prisma.invoice.findUnique({ where: { id: req.params.invoiceId } });
    if (!existing || existing.workspaceId !== req.params.id) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    if (existing.status === 'PAID') {
      return res.status(400).json({ error: 'Invoice is already paid' });
    }

    const invoice = await prisma.invoice.update({
      where: { id: req.params.invoiceId },
      data: { status: 'PAID', paidAt: new Date() },
    });

    res.json(invoice);
  } catch (err: unknown) {
    if (isWorkspaceAccessError(err)) {
      return res.status(err.statusCode).json(err.body ?? { error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to mark invoice as paid' });
  }
});

// POST /:id/crm/invoices/:invoiceId/archive — soft-delete invoice
router.post('/:id/crm/invoices/:invoiceId/archive', async (req: AuthRequest, res: Response) => {
  try {
    await assertWorkspaceMember(req.user!.userId, req.params.id);

    const existing = await prisma.invoice.findUnique({ where: { id: req.params.invoiceId } });
    if (!existing || existing.workspaceId !== req.params.id) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    await prisma.invoice.update({
      where: { id: req.params.invoiceId },
      data: { archivedAt: new Date() },
    });

    res.json({ success: true });
  } catch (err: unknown) {
    if (isWorkspaceAccessError(err)) {
      return res.status(err.statusCode).json(err.body ?? { error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to archive invoice' });
  }
});

export default router;
