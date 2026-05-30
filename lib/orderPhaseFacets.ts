import type { Prisma } from '@prisma/client';
import { OrderPhase, OrderStatus } from '@prisma/client';
import prisma from './db.js';

export type OrderPhaseFacetCounts = {
  offer: number;
  order: number;
  job: number;
  cancelledOffer: number;
  cancelledOrder: number;
  cancelledJob: number;
};

function andWhere(
  base: Prisma.OrderWhereInput,
  extra: Prisma.OrderWhereInput,
): Prisma.OrderWhereInput {
  if (base && Object.keys(base).length > 0) {
    return { AND: [base, extra] };
  }
  return extra;
}

export async function countOrderPhaseFacets(
  baseWhere: Prisma.OrderWhereInput,
): Promise<OrderPhaseFacetCounts> {
  const cx = OrderStatus.cancelled;
  const [offer, order_, job, cancelledOffer, cancelledOrder, cancelledJob] = await Promise.all([
    prisma.order.count({
      where: andWhere(baseWhere, {
        phase: OrderPhase.offer,
        NOT: { status: cx },
      }),
    }),
    prisma.order.count({
      where: andWhere(baseWhere, {
        phase: OrderPhase.order,
        NOT: { status: cx },
      }),
    }),
    prisma.order.count({
      where: andWhere(baseWhere, {
        phase: OrderPhase.job,
        NOT: { status: cx },
      }),
    }),
    prisma.order.count({
      where: andWhere(baseWhere, { phase: OrderPhase.offer, status: cx }),
    }),
    prisma.order.count({
      where: andWhere(baseWhere, { phase: OrderPhase.order, status: cx }),
    }),
    prisma.order.count({
      where: andWhere(baseWhere, { phase: OrderPhase.job, status: cx }),
    }),
  ]);
  return {
    offer,
    order: order_,
    job,
    cancelledOffer,
    cancelledOrder,
    cancelledJob,
  };
}
