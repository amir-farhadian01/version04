import { DeliveryError } from './errors.js';

export const INTERNAL_DELIVERY_PROVIDER = Object.freeze({
  key: 'internal',
  kind: 'internal_driver' as const,
});

export function resolveDeliveryProvider(key: string) {
  if (key !== INTERNAL_DELIVERY_PROVIDER.key) {
    throw new DeliveryError('PROVIDER_NOT_SUPPORTED', 400, 'Delivery provider is not supported in Phase 1');
  }
  return INTERNAL_DELIVERY_PROVIDER;
}
