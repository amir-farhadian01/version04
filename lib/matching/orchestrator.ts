import { MatchAttemptStatus, OrderStatus, Prisma } from '@prisma/client';
import prisma from '../db.js';
import { publish } from '../bus.js';
import { phaseFromStatus } from '../orderPhase.js';
import {
  findEligiblePackagesForOffer,
  scoreProviderPackageForOrder,
} from './eligibility.js';

async function markOrderAutoMatchExhausted(orderId: string, depth: number): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.submitted,
        phase: phaseFromStatus(OrderStatus.submitted),
        autoMatchExhausted: true,
        matchedPackageId: null,
        matchedProviderId: null,
        matchedWorkspaceId: null,
      },
    });
  });
  try {
    await publish('orders.auto_match_exhausted', { orderId, depth });
  } catch {
    /* publish is best-effort */
  }
}

export async function autoMatchOffer(
  orderId: string,
  options?: { excludePackageIds?: string[]; depth?: number },
): Promise<{ matched: boolean; attemptId?: string; reason?: string }> {
  try {
    const depth = options?.depth ?? 0;
    if (depth > 3) {
      await markOrderAutoMatchExhausted(orderId, depth);
      return { matched: false, reason: 'max_depth' };
    }

    const blocking = await prisma.offerMatchAttempt.findFirst({
      where: {
        offerId: orderId,
        status: { in: [MatchAttemptStatus.accepted, MatchAttemptStatus.matched] },
      },
    });
    if (blocking) {
      return { matched: false, reason: 'already_has_active_match' };
    }

    const eligible = await findEligiblePackagesForOffer(orderId, options?.excludePackageIds ?? []);
    if (eligible.length === 0) {
      await markOrderAutoMatchExhausted(orderId, depth);
      return { matched: false, reason: 'no_eligible' };
    }

    const best = eligible[0]!;
    const pkg = best.package;
    const now = new Date();
    const metadata = {
      ...best.breakdown,
      rematchDepth: depth,
    } as Prisma.InputJsonValue;

    const attempt = await prisma.$transaction(async (tx) => {
      await tx.offerMatchAttempt.updateMany({
        where: {
          offerId: orderId,
          status: { in: [MatchAttemptStatus.matched, MatchAttemptStatus.invited] },
        },
        data: { status: MatchAttemptStatus.superseded, supersededAt: now },
      });

      const att = await tx.offerMatchAttempt.create({
        data: {
          offerId: orderId,
          packageId: pkg.id,
          providerId: pkg.providerId,
          workspaceId: pkg.workspaceId,
          status: MatchAttemptStatus.matched,
          score: best.score,
          distanceKm: best.distanceKm,
          invitedAt: now,
          matchedAt: now,
          metadata,
        },
      });

      await tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.matched,
          phase: phaseFromStatus(OrderStatus.matched),
          matchedPackageId: pkg.id,
          matchedProviderId: pkg.providerId,
          matchedWorkspaceId: pkg.workspaceId,
          autoMatchExhausted: false,
        },
      });

      await tx.auditLog.create({
        data: {
          action: 'ORDER_AUTO_MATCHED',
          resourceType: 'order',
          resourceId: orderId,
          metadata: {
            attemptId: att.id,
            packageId: pkg.id,
            providerId: pkg.providerId,
            workspaceId: pkg.workspaceId,
            score: best.score,
            breakdown: best.breakdown,
            distanceKm: best.distanceKm,
          } as Prisma.InputJsonValue,
        },
      });

      return att;
    });

    const matchedPayload = {
      orderId,
      attemptId: attempt.id,
      packageId: pkg.id,
      providerId: pkg.providerId,
      workspaceId: pkg.workspaceId,
      score: best.score,
    };
    try {
      await publish('orders.auto_matched', matchedPayload);
      await publish('orders.matched', matchedPayload);
    } catch {
      /* optional NATS */
    }

    return { matched: true, attemptId: attempt.id };
  } catch (err) {
    console.error('autoMatchOffer', err);
    return { matched: false, reason: err instanceof Error ? err.message : 'error' };
  }
}

export async function manualMatchOffer(
  orderId: string,
  packageId: string,
  actorId: string,
): Promise<{ attemptId: string }> {
  try {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      throw new Error('Order not found');
    }

    const pkg = await prisma.providerServicePackage.findFirst({
      where: {
        id: packageId,
        serviceCatalogId: order.serviceCatalogId,
        isActive: true,
        archivedAt: null,
      },
      include: { workspace: true, provider: true, serviceCatalog: true },
    });
    if (!pkg) {
      throw new Error('Package not found or inactive for this order catalog');
    }

    const strict = await findEligiblePackagesForOffer(orderId, []);
    const pick = strict.find((e) => e.package.id === packageId) ?? null;
    const scored =
      pick ?? (await scoreProviderPackageForOrder(order, pkg));

    const now = new Date();
    const metadata = {
      ...scored.breakdown,
      rematchDepth: 0,
      manualOverride: true,
    } as Prisma.InputJsonValue;

    const attempt = await prisma.$transaction(async (tx) => {
      await tx.offerMatchAttempt.updateMany({
        where: {
          offerId: orderId,
          status: { in: [MatchAttemptStatus.matched, MatchAttemptStatus.invited] },
        },
        data: { status: MatchAttemptStatus.superseded, supersededAt: now },
      });

      const att = await tx.offerMatchAttempt.create({
        data: {
          offerId: orderId,
          packageId: pkg.id,
          providerId: pkg.providerId,
          workspaceId: pkg.workspaceId,
          status: MatchAttemptStatus.matched,
          score: scored.score,
          distanceKm: scored.distanceKm,
          invitedAt: now,
          matchedAt: now,
          metadata,
        },
      });

      await tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.matched,
          phase: phaseFromStatus(OrderStatus.matched),
          matchedPackageId: pkg.id,
          matchedProviderId: pkg.providerId,
          matchedWorkspaceId: pkg.workspaceId,
          autoMatchExhausted: false,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId,
          action: 'ORDER_MATCH_OVERRIDE',
          resourceType: 'order',
          resourceId: orderId,
          metadata: {
            attemptId: att.id,
            packageId: pkg.id,
            score: scored.score,
            breakdown: scored.breakdown,
          } as Prisma.InputJsonValue,
        },
      });

      return att;
    });

    const matchedPayload = {
      orderId,
      attemptId: attempt.id,
      packageId: pkg.id,
      providerId: pkg.providerId,
      workspaceId: pkg.workspaceId,
      score: scored.score,
    };
    try {
      await publish('orders.auto_matched', matchedPayload);
      await publish('orders.matched', matchedPayload);
    } catch {
      /* optional NATS */
    }

    return { attemptId: attempt.id };
  } catch (err) {
    console.error('manualMatchOffer', err);
    throw err;
  }
}
