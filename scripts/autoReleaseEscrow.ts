import prisma from '../lib/db.js';
import { PaymentStatus } from '@prisma/client';
import { getNats } from '../lib/bus.js';

/**
 * Auto-release escrow payments whose 48-hour timer has expired.
 *
 * Queries all Payment records where:
 * - status is 'captured' (escrow held, release timer started)
 * - escrowReleaseAt <= now (timer has expired)
 * - escrowReleaseAt IS NOT NULL
 *
 * For each expired payment, transitions status to 'releaseScheduled'
 * and publishes an escrow.released NATS event.
 *
 * Uses prisma.$transaction for atomicity.
 */
export async function autoReleaseEscrow(): Promise<{ released: number; errors: number }> {
  const now = new Date();

  const expiredPayments = await prisma.payment.findMany({
    where: {
      status: PaymentStatus.captured,
      escrowReleaseAt: {
        lte: now,
        not: null,
      },
    },
  });

  let released = 0;
  let errors = 0;

  for (const payment of expiredPayments) {
    try {
      await prisma.$transaction(async (tx) => {
        // Re-read within transaction to avoid race conditions
        const current = await tx.payment.findUnique({
          where: { id: payment.id },
          select: { status: true, escrowReleaseAt: true },
        });

        if (!current || current.status !== PaymentStatus.captured) {
          // Already released or status changed — skip
          return;
        }

        if (!current.escrowReleaseAt || current.escrowReleaseAt > now) {
          // Timer no longer expired — skip
          return;
        }

        await tx.payment.update({
          where: { id: payment.id },
          data: { status: PaymentStatus.releaseScheduled },
        });
      });

      // Publish NATS event for escrow release
      try {
        const nats = await getNats();
        nats.publish('escrow.released', JSON.stringify({
          paymentId: payment.id,
          orderId: payment.orderId,
          amount: payment.amount,
          releasedAt: new Date().toISOString(),
        }));
      } catch (natsErr) {
        console.warn('[AutoRelease] NATS not available, skipping event publish:', natsErr);
      }

      console.log(
        `[AutoRelease] Releasing escrow for order ${payment.orderId} (${payment.amount} cents)`,
      );
      released++;
    } catch (error) {
      console.error(
        `[AutoRelease] Error releasing escrow for order ${payment.orderId}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
      errors++;
    }
  }

  if (released > 0 || errors > 0) {
    console.log(
      `[AutoRelease] Completed: ${released} released, ${errors} errors`,
    );
  }

  return { released, errors };
}
