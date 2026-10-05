import type { DeliveryAssignmentStatus } from '@prisma/client';
import { addressSnapshotSchema } from './validation.js';

type AddressSnapshot = ReturnType<typeof addressSnapshotSchema.parse>;

const acceptedStatuses = new Set<DeliveryAssignmentStatus>([
  'accepted', 'completed', 'failed', 'unable_to_deliver',
]);

export function redactAddress(snapshot: unknown): Pick<AddressSnapshot, 'city' | 'province'> {
  const address = addressSnapshotSchema.parse(snapshot);
  return { city: address.city, province: address.province };
}

export function serializeAddresses(
  pickup: unknown,
  dropoff: unknown,
  assignmentStatus: DeliveryAssignmentStatus | null,
  managerView: boolean,
  wasAccepted = false,
) {
  const canSeePrecise = managerView
    || (assignmentStatus != null && acceptedStatuses.has(assignmentStatus))
    || (wasAccepted && (assignmentStatus === 'revoked' || assignmentStatus === 'cancelled'));
  if (canSeePrecise) {
    return {
      pickupAddress: addressSnapshotSchema.parse(pickup),
      dropoffAddress: addressSnapshotSchema.parse(dropoff),
      addressPrecision: 'precise' as const,
    };
  }
  return {
    pickupAddress: redactAddress(pickup),
    dropoffAddress: redactAddress(dropoff),
    addressPrecision: 'city_province' as const,
  };
}
