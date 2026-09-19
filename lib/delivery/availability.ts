import type { BusinessDriverStatus, DriverAvailabilityMode, DriverPresence, FulfillmentStatus } from '@prisma/client';

export type EffectiveAvailability = 'available' | 'offline' | 'busy';

export function effectiveAvailability(input: {
  relationshipStatus: BusinessDriverStatus;
  mode: DriverAvailabilityMode;
  presence: DriverPresence;
  now: Date;
  insideScheduledWindow: boolean;
  assignments: Array<{
    fulfillmentStatus: FulfillmentStatus;
    plannedStartAt: Date | null;
    plannedEndAt: Date | null;
  }>;
}): EffectiveAvailability {
  if (input.relationshipStatus !== 'active' || input.presence === 'offline') return 'offline';

  const busy = input.assignments.some((assignment) => {
    if (assignment.fulfillmentStatus === 'picked_up' || assignment.fulfillmentStatus === 'in_transit') return true;
    if (assignment.fulfillmentStatus !== 'accepted') return false;
    if (!assignment.plannedStartAt || !assignment.plannedEndAt) return input.mode === 'on_demand';
    return assignment.plannedStartAt <= input.now && assignment.plannedEndAt > input.now;
  });
  if (busy) return 'busy';
  if (input.mode === 'scheduled' && !input.insideScheduledWindow) return 'offline';
  return 'available';
}
