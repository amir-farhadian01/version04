import { OrderStatus, type OrderPhase, type Prisma } from '@prisma/client';

export function phaseFromStatus(
  status: OrderStatus,
  prevPhase: OrderPhase | null = null,
): OrderPhase | null {
  switch (status) {
    case 'draft':
      return 'draft';
    case 'submitted':
      return 'offer';
    case 'matching':
    case 'matched':
      return 'order';
    case 'contracted':
    case 'paid':
    case 'in_progress':
    case 'completed':
    case 'disputed':
    case 'closed':
      return 'job';
    case 'cancelled':
      return prevPhase ?? 'offer';
    default:
      return null;
  }
}

export const PHASE_ORDER: OrderPhase[] = ['draft', 'offer', 'order', 'job'];

export function nextPhase(current: OrderPhase): OrderPhase | null {
  const i = PHASE_ORDER.indexOf(current);
  return PHASE_ORDER[i + 1] ?? null;
}

/** List filter: rows in one of `phases`, optionally including drafts (phase 'draft'). */
export function phaseListWhere(phases: OrderPhase[], includeDrafts: boolean): Prisma.OrderWhereInput {
  const inPhases: Prisma.OrderWhereInput = { phase: { in: phases } };
  if (includeDrafts) {
    const withDraft = [...phases, 'draft' as OrderPhase];
    return { phase: { in: withDraft } };
  }
  return inPhases;
}