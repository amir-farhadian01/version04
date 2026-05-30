import { MatchAttemptStatus, OrderStatus, Prisma } from '@prisma/client';
import prisma from '../db.js';
import { publish } from '../bus.js';
import { phaseFromStatus } from '../orderPhase.js';
import {
  findEligibleNegotiationPackagesForOffer,
  type ScoreWeightMultipliers,
} from './eligibility.js';

export const POOL_SIZE = parseInt(process.env.ROUND_ROBIN_POOL_SIZE ?? '5', 10);
export const WINDOW_MS =
  parseInt(process.env.ROUND_ROBIN_WINDOW_HOURS ?? '24', 10) * 3600 * 1000;

export class RoundRobinValidationError extends Error {
  readonly statusCode = 400;
  constructor(message: string) {
    super(message);
    this.name = 'RoundRobinValidationError';
  }
}

export function parseOrderPriorityWeights(
  json: Prisma.JsonValue | null | undefined,
): ScoreWeightMultipliers | null {
  if (json == null || typeof json !== 'object' || Array.isArray(json)) return null;
  const weights = (json as Record<string, unknown>).weights;
  if (weights == null || typeof weights !== 'object' || Array.isArray(weights)) return null;
  const w = weights as Record<string, unknown>;
  const num = (k: string): number | undefined => {
    const v = w[k];
    return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
  };
  const out: ScoreWeightMultipliers = {};
  const d = num('distance');
  const r = num('rating');
  const p = num('price');
  const rr = num('responseRate');
  if (d !== undefined) out.distance = d;
  if (r !== undefined) out.rating = r;
  if (p !== undefined) out.price = p;
  if (rr !== undefined) out.responseRate = rr;
  return Object.keys(out).length ? out : null;
}

/**
 * Sprint J: invite top negotiation-eligible providers into a matching pool.
 */
export async function roundRobinInviteOffer(
  orderId: string,
): Promise<{ invitedCount: number; attemptIds: string[] }> {
  const now = new Date();
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      serviceCatalog: true,
      customer: { select: { orderPriorities: true } },
    },
  });
  if (!order?.serviceCatalog) {
    throw new RoundRobinValidationError('Order or catalog not found');
  }

  const lock = order.serviceCatalog.lockedBookingMode?.trim();
  if (lock === 'booking' || lock === 'direct_booking') {
    throw new RoundRobinValidationError(
      'Round-robin matching requires a negotiation-capable catalog (not locked to booking or direct_booking only)',
    );
  }

  const weightMultipliers = parseOrderPriorityWeights(order.customer?.orderPriorities ?? null);

  const attemptedRows = await prisma.offerMatchAttempt.findMany({
    where: { offerId: orderId },
    select: { packageId: true },
  });
  const attempted = [...new Set(attemptedRows.map((r) => r.packageId))];
  const eligible = await findEligibleNegotiationPackagesForOffer(orderId, attempted, weightMultipliers);
  const pool = Number.isFinite(POOL_SIZE) && POOL_SIZE > 0 ? POOL_SIZE : 5;
  const picked = eligible.slice(0, pool);

  if (picked.length === 0) {
    await prisma.order.update({
      where: { id: orderId },
      data: {
        autoMatchExhausted: true,
        status: OrderStatus.submitted,
        phase: phaseFromStatus(OrderStatus.submitted),
        matchingExpiresAt: null,
      },
    });
    return { invitedCount: 0, attemptIds: [] };
  }

  const expiresAt = new Date(now.getTime() + (Number.isFinite(WINDOW_MS) && WINDOW_MS > 0 ? WINDOW_MS : 86400000));
  const created = await prisma.$transaction(async (tx) => {
    const attempts = await Promise.all(
      picked.map((row) =>
        tx.offerMatchAttempt.create({
          data: {
            offerId: orderId,
            packageId: row.package.id,
            providerId: row.package.providerId,
            workspaceId: row.package.workspaceId,
            status: MatchAttemptStatus.invited,
            score: row.score,
            distanceKm: row.distanceKm,
            invitedAt: now,
            expiresAt,
            metadata: row.breakdown as Prisma.InputJsonValue,
          },
        }),
      ),
    );

    await tx.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.matching,
        phase: phaseFromStatus(OrderStatus.matching),
        autoMatchExhausted: false,
        matchingExpiresAt: expiresAt,
        matchedPackageId: null,
        matchedProviderId: null,
        matchedWorkspaceId: null,
      },
    });

    await tx.auditLog.create({
      data: {
        action: 'ORDER_ROUND_ROBIN_STARTED',
        resourceType: 'order',
        resourceId: orderId,
        metadata: {
          invitedCount: attempts.length,
          attemptIds: attempts.map((a) => a.id),
          expiresAt: expiresAt.toISOString(),
        } as Prisma.InputJsonValue,
      },
    });
    return attempts;
  });

  try {
    await publish('orders.round_robin_started', {
      orderId,
      attemptIds: created.map((a) => a.id),
      expiresAt: expiresAt.toISOString(),
    });
  } catch {
    /* NATS optional */
  }

  return {
    invitedCount: created.length,
    attemptIds: created.map((a) => a.id),
  };
}

/**
 * After decline or expiry: add one replacement invite without extending the matching window.
 */
export async function replaceAttempt(
  orderId: string,
  failedPackageId: string,
  keepExpiresAt: Date,
): Promise<{ reMatched: boolean; newAttemptId?: string }> {
  const attemptedRows = await prisma.offerMatchAttempt.findMany({
    where: { offerId: orderId },
    select: { packageId: true },
  });
  const attempted = [...new Set(attemptedRows.map((r) => r.packageId))];
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { customer: { select: { orderPriorities: true } } },
  });
  const weightMultipliers = parseOrderPriorityWeights(order?.customer?.orderPriorities ?? null);
  const [eligible] = await findEligibleNegotiationPackagesForOffer(orderId, attempted, weightMultipliers);
  if (!eligible) {
    await prisma.order.update({
      where: { id: orderId },
      data: { autoMatchExhausted: true },
    });
    return { reMatched: false };
  }

  const created = await prisma.offerMatchAttempt.create({
    data: {
      offerId: orderId,
      packageId: eligible.package.id,
      providerId: eligible.package.providerId,
      workspaceId: eligible.package.workspaceId,
      status: MatchAttemptStatus.invited,
      score: eligible.score,
      distanceKm: eligible.distanceKm,
      invitedAt: new Date(),
      expiresAt: keepExpiresAt,
      metadata: eligible.breakdown as Prisma.InputJsonValue,
    },
    select: { id: true },
  });
  return { reMatched: true, newAttemptId: created.id };
}

/**
 * Lazy expiry: mark stale invited attempts expired and try one replacement each (same window end).
 */
export async function expireStaleAttempts(
  orderId: string,
): Promise<{ expiredCount: number; replaced: number }> {
  const now = new Date();
  const stale = await prisma.offerMatchAttempt.findMany({
    where: {
      offerId: orderId,
      status: MatchAttemptStatus.invited,
      expiresAt: { lt: now },
    },
    select: { id: true, packageId: true, expiresAt: true },
  });

  if (stale.length === 0) return { expiredCount: 0, replaced: 0 };

  let replaced = 0;
  for (const row of stale) {
    await prisma.offerMatchAttempt.update({
      where: { id: row.id },
      data: { status: MatchAttemptStatus.expired, respondedAt: now },
    });
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { matchingExpiresAt: true },
    });
    const basis = row.expiresAt ?? order?.matchingExpiresAt ?? new Date(now.getTime());
    const rep = await replaceAttempt(orderId, row.packageId, basis);
    if (rep.reMatched) replaced++;
    try {
      await publish('attempts.expired', {
        attemptId: row.id,
        orderId,
        ...(rep.newAttemptId != null ? { replacedBy: rep.newAttemptId } : {}),
      });
    } catch {
      /* optional */
    }
  }

  return { expiredCount: stale.length, replaced };
}
