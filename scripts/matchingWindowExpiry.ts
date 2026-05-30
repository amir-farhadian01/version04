import prisma from '../lib/db.js';
import { OrderStatus } from '@prisma/client';

/**
 * Expire orders whose matching window has passed.
 *
 * Queries all Order records where:
 * - status is 'matching' (still in matching phase)
 * - matchingExpiresAt <= now (window has expired)
 * - matchingExpiresAt IS NOT NULL
 *
 * For each expired order, transitions status to 'expired'.
 *
 * Uses prisma.$transaction for atomicity.
 */
export async function expireMatchingWindows(): Promise<{ expired: number; errors: number }> {
  const now = new Date();

  const expiredOrders = await prisma.order.findMany({
    where: {
      status: OrderStatus.matching,
      matchingExpiresAt: {
        lte: now,
        not: null,
      },
    },
  });

  let expired = 0;
  let errors = 0;

  for (const order of expiredOrders) {
    try {
      await prisma.$transaction(async (tx) => {
        // Re-read within transaction to avoid race conditions
        const current = await tx.order.findUnique({
          where: { id: order.id },
          select: { status: true, matchingExpiresAt: true },
        });

        if (!current || current.status !== OrderStatus.matching) {
          // Already transitioned or status changed — skip
          return;
        }

        if (!current.matchingExpiresAt || current.matchingExpiresAt > now) {
          // Window no longer expired — skip
          return;
        }

        await tx.order.update({
          where: { id: order.id },
          data: { status: OrderStatus.expired },
        });
      });

      console.log(
        `[MatchingExpiry] Expired order ${order.id} (matching window passed)`,
      );
      expired++;
    } catch (error) {
      console.error(
        `[MatchingExpiry] Error expiring order ${order.id}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
      errors++;
    }
  }

  if (expired > 0 || errors > 0) {
    console.log(
      `[MatchingExpiry] Completed: ${expired} expired, ${errors} errors`,
    );
  }

  return { expired, errors };
}
