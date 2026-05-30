/**
 * One-shot: set Order.phase for rows where phase IS NULL.
 * Cancelled rows: prefer prior status from AuditLog metadata (newest ORDER_* / ADMIN_*).
 */
import { OrderPhase, OrderStatus } from '@prisma/client';
import prisma from '../lib/db.js';
import { phaseFromStatus } from '../lib/orderPhase.js';

const BATCH = 200;

function priorStatusFromMetadata(meta: unknown): OrderStatus | null {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return null;
  const o = meta as Record<string, unknown>;
  for (const key of ['previousStatus', 'fromStatus', 'oldStatus', 'priorStatus']) {
    const v = o[key];
    if (typeof v === 'string' && (Object.values(OrderStatus) as string[]).includes(v)) {
      return v as OrderStatus;
    }
  }
  return null;
}

async function resolvePhaseForRow(id: string, status: OrderStatus): Promise<OrderPhase | null> {
  if (status !== OrderStatus.cancelled) {
    return phaseFromStatus(status);
  }
  const logs = await prisma.auditLog.findMany({
    where: {
      resourceType: 'order',
      resourceId: id,
      OR: [{ action: { startsWith: 'ORDER_' } }, { action: { startsWith: 'ADMIN_' } }],
    },
    orderBy: { timestamp: 'desc' },
    take: 40,
  });
  for (const log of logs) {
    const prior = priorStatusFromMetadata(log.metadata);
    if (prior && prior !== OrderStatus.cancelled) {
      return phaseFromStatus(OrderStatus.cancelled, phaseFromStatus(prior));
    }
  }
  return phaseFromStatus(OrderStatus.cancelled, null);
}

async function main() {
  let offer = 0;
  let order = 0;
  let job = 0;
  let nullPhase = 0;
  let n = 0;

  for (;;) {
    const batch = await prisma.order.findMany({
      where: { phase: null },
      take: BATCH,
      select: { id: true, status: true },
    });
    if (batch.length === 0) break;

    for (const row of batch) {
      const phase = await resolvePhaseForRow(row.id, row.status);
      await prisma.order.update({
        where: { id: row.id },
        data: { phase },
      });
      n += 1;
      if (phase === OrderPhase.offer) offer += 1;
      else if (phase === OrderPhase.order) order += 1;
      else if (phase === OrderPhase.job) job += 1;
      else nullPhase += 1;
    }
  }

  console.log(`Backfilled ${n} rows: offer=${offer}, order=${order}, job=${job}, phaseNull=${nullPhase}`);
}

try {
  await main();
} catch (e) {
  console.error(e);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
