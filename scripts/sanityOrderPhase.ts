import { OrderStatus } from '@prisma/client';
import prisma from '../lib/db.js';
import { phaseFromStatus } from '../lib/orderPhase.js';

function ok(msg: string) {
  console.log(`OK: ${msg}`);
}

function fail(msg: string): never {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

try {
  const total = await prisma.order.count();
  if (total === 0) {
    ok('no orders in DB; skip checks');
    process.exit(0);
  }
  const take = Math.min(5, total);
  const skip = total > take ? Math.floor(Math.random() * (total - take + 1)) : 0;
  const rows = await prisma.order.findMany({
    take,
    skip,
    orderBy: { id: 'asc' },
    select: { id: true, status: true, phase: true },
  });

  for (const r of rows) {
    console.log(JSON.stringify({ id: r.id, status: r.status, phase: r.phase }));
  }

  const all = await prisma.order.findMany({
    select: { id: true, status: true, phase: true },
  });
  for (const r of all) {
    if (r.status === OrderStatus.draft) {
      if (r.phase != null) {
        fail(`draft ${r.id} expected phase null, got ${r.phase}`);
      }
      continue;
    }
    if (r.status === OrderStatus.cancelled) {
      const expected = phaseFromStatus(OrderStatus.cancelled, r.phase);
      if (r.phase !== expected) {
        fail(`cancelled ${r.id} phase ${r.phase} !== phaseFromStatus(cancelled, self)=${expected}`);
      }
      continue;
    }
    const expected = phaseFromStatus(r.status);
    if (r.phase !== expected) {
      fail(`order ${r.id} status=${r.status} phase=${r.phase} expected ${String(expected)}`);
    }
  }
  ok('phase derivation consistent');
  process.exit(0);
} catch (e) {
  console.error(e);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
