import { z } from 'zod';

const cents = z.number().int().positive();

export const compensationComponentSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('hourly'), amountCents: cents }).strict(),
  z.object({ type: z.literal('per_delivery'), amountCents: cents }).strict(),
  z.object({
    type: z.literal('commission'),
    rateBasisPoints: z.number().int().min(1).max(10_000),
    basisDescription: z.string().trim().min(1).max(240),
  }).strict(),
  z.object({
    type: z.literal('fixed_salary'),
    amountCents: cents,
    frequency: z.enum(['weekly', 'biweekly', 'monthly', 'annual']),
  }).strict(),
]);

export const compensationTermsSchema = z.object({
  currency: z.string().regex(/^[A-Z]{3}$/),
  schemaVersion: z.literal(1).default(1),
  components: z.array(compensationComponentSchema).min(1).max(4),
}).strict().superRefine((value, ctx) => {
  const seen = new Set<string>();
  value.components.forEach((component, index) => {
    if (seen.has(component.type)) {
      ctx.addIssue({
        code: 'custom',
        path: ['components', index, 'type'],
        message: `Only one ${component.type} component is allowed`,
      });
    }
    seen.add(component.type);
  });
});

const containsContact = (value: string): boolean => {
  if (/\b[^\s@]+@[^\s@]+\.[^\s@]+\b/.test(value)) return true;
  const digits = value.replace(/\D/g, '');
  return digits.length >= 7 && /(?:\+?\d[\d\s().-]{5,}\d)/.test(value);
};

export const addressSnapshotSchema = z.object({
  line1: z.string().trim().min(1).max(200),
  line2: z.string().trim().max(120).nullable().optional(),
  city: z.string().trim().min(1).max(100),
  province: z.string().trim().min(1).max(100),
  postalCode: z.string().trim().min(1).max(24),
  country: z.string().trim().length(2).transform((value) => value.toUpperCase()),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
}).strict().superRefine((value, ctx) => {
  for (const key of ['line1', 'line2', 'city', 'province', 'postalCode'] as const) {
    const candidate = value[key];
    if (candidate && containsContact(candidate)) {
      ctx.addIssue({ code: 'custom', path: [key], message: 'Contact information is not allowed in delivery addresses' });
    }
  }
});

export const createDriverSchema = z.object({
  userId: z.string().min(1),
  engagementType: z.enum(['hourly', 'long_term']),
  availabilityMode: z.enum(['on_demand', 'scheduled']).default('on_demand'),
}).strict();

export const driverLifecycleSchema = z.object({
  action: z.enum(['pause', 'resume', 'end', 'reinvite']),
  expectedVersion: z.number().int().positive(),
}).strict();

export const relationshipResponseSchema = z.object({
  action: z.enum(['accept', 'decline']),
  expectedVersion: z.number().int().positive(),
}).strict();

export const termResponseSchema = z.object({
  action: z.enum(['accept', 'reject']),
  expectedDriverVersion: z.number().int().positive(),
}).strict();

export const presenceSchema = z.object({
  presence: z.enum(['available', 'offline']),
  expectedVersion: z.number().int().positive(),
}).strict();

const availabilityObjectSchema = z.object({
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
}).strict();

export const availabilitySchema = availabilityObjectSchema.refine((value) => new Date(value.startTime) < new Date(value.endTime), {
  message: 'startTime must be before endTime',
  path: ['endTime'],
});

export const updateAvailabilitySchema = availabilityObjectSchema.partial().refine((value) => {
  if (!value.startTime || !value.endTime) return true;
  return new Date(value.startTime) < new Date(value.endTime);
}, { message: 'startTime must be before endTime', path: ['endTime'] });

export const createFulfillmentSchema = z.object({
  orderId: z.string().min(1),
  providerKey: z.string().min(1).default('internal'),
  pickupAddress: addressSnapshotSchema,
  dropoffAddress: addressSnapshotSchema,
}).strict();

export const offerAssignmentSchema = z.object({
  businessDriverId: z.string().min(1),
  expectedVersion: z.number().int().positive(),
  plannedStartAt: z.string().datetime().nullable().optional(),
  plannedEndAt: z.string().datetime().nullable().optional(),
  replaceReason: z.enum(['driver_unavailable', 'schedule_change', 'operational_change', 'other']).optional(),
  notes: z.string().trim().max(500).optional(),
}).strict().superRefine((value, ctx) => {
  const hasStart = value.plannedStartAt != null;
  const hasEnd = value.plannedEndAt != null;
  if (hasStart !== hasEnd) {
    ctx.addIssue({ code: 'custom', path: ['plannedEndAt'], message: 'Planned start and end must be provided together' });
  } else if (value.plannedStartAt && value.plannedEndAt && new Date(value.plannedStartAt) >= new Date(value.plannedEndAt)) {
    ctx.addIssue({ code: 'custom', path: ['plannedEndAt'], message: 'plannedStartAt must be before plannedEndAt' });
  }
});

export const assignmentResponseSchema = z.object({
  action: z.enum(['accept', 'reject']),
  expectedAssignmentVersion: z.number().int().positive(),
  expectedFulfillmentVersion: z.number().int().positive(),
  reasonCode: z.enum(['schedule_conflict', 'unavailable', 'terms_not_accepted', 'other']).optional(),
  notes: z.string().trim().max(500).optional(),
}).strict();

export const assignmentTransitionSchema = z.object({
  action: z.enum(['pick_up', 'start_transit', 'deliver', 'fail', 'unable_to_deliver']),
  expectedAssignmentVersion: z.number().int().positive(),
  expectedFulfillmentVersion: z.number().int().positive(),
  reasonCode: z.enum(['recipient_unavailable', 'unsafe_location', 'damaged_item', 'vehicle_issue', 'other']).optional(),
  notes: z.string().trim().max(500).optional(),
}).strict();

export const cancelFulfillmentSchema = z.object({
  expectedVersion: z.number().int().positive(),
  reasonCode: z.enum(['customer_request', 'order_cancelled', 'operational_change', 'other']),
  notes: z.string().trim().max(500).optional(),
}).strict();

export const adminCapabilitySchema = z.object({ enabled: z.boolean() }).strict();

export const idParamSchema = z.string().min(1).max(128);
