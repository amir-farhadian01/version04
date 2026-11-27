export type DeliveryErrorCode =
  | 'NOT_FOUND'
  | 'FORBIDDEN'
  | 'FEATURE_DISABLED'
  | 'PROVIDER_NOT_SUPPORTED'
  | 'INVALID_STATE'
  | 'VERSION_CONFLICT'
  | 'DRIVER_NOT_ELIGIBLE'
  | 'SLOT_CONFLICT'
  | 'INVALID_COMPENSATION'
  | 'ACTIVE_FULFILLMENTS_EXIST';

export class DeliveryError extends Error {
  constructor(
    public readonly code: DeliveryErrorCode,
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'DeliveryError';
  }
}

export function notFound(message = 'Resource not found'): DeliveryError {
  return new DeliveryError('NOT_FOUND', 404, message);
}

export function versionConflict(): DeliveryError {
  return new DeliveryError('VERSION_CONFLICT', 409, 'The resource changed; refresh and retry');
}
