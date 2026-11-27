import type { FulfillmentStatus } from '@prisma/client';
import { DeliveryError } from './errors.js';

export type DriverTransitionAction =
  | 'pick_up'
  | 'start_transit'
  | 'deliver'
  | 'fail'
  | 'unable_to_deliver';

const transitions: Record<DriverTransitionAction, Partial<Record<FulfillmentStatus, FulfillmentStatus>>> = {
  pick_up: { accepted: 'picked_up' },
  start_transit: { picked_up: 'in_transit' },
  deliver: { in_transit: 'delivered' },
  fail: { accepted: 'failed', picked_up: 'failed', in_transit: 'failed' },
  unable_to_deliver: { accepted: 'unable_to_deliver', picked_up: 'unable_to_deliver', in_transit: 'unable_to_deliver' },
};

export const terminalFulfillmentStatuses = new Set<FulfillmentStatus>([
  'delivered',
  'failed',
  'cancelled',
  'unable_to_deliver',
]);

export function transitionFulfillment(status: FulfillmentStatus, action: DriverTransitionAction): FulfillmentStatus {
  const next = transitions[action][status];
  if (!next) {
    throw new DeliveryError('INVALID_STATE', 409, `Action ${action} is not valid from ${status}`);
  }
  return next;
}

export function assignmentStatusForFulfillment(status: FulfillmentStatus) {
  if (status === 'delivered') return 'completed' as const;
  if (status === 'failed') return 'failed' as const;
  if (status === 'unable_to_deliver') return 'unable_to_deliver' as const;
  return 'accepted' as const;
}

export function lifecycleTimestampFor(status: FulfillmentStatus, now: Date): Record<string, Date> {
  switch (status) {
    case 'picked_up': return { pickedUpAt: now };
    case 'in_transit': return { inTransitAt: now };
    case 'delivered': return { deliveredAt: now, terminalAt: now };
    case 'failed':
    case 'unable_to_deliver':
    case 'cancelled': return { terminalAt: now };
    default: return {};
  }
}
