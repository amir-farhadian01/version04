import { Router, Response } from 'express';
import { ContractVersionStatus, MatchAttemptStatus, OrderEntryPoint, OrderPhase, OrderStatus, OrderUrgency, Prisma } from '@prisma/client';
import prisma from '../lib/db.js';
import { publish } from '../lib/bus.js';
import { isWorkspaceOpenForWalkIn } from '../lib/businessHours.js';
import { recalculateWorkspaceTrustScore } from '../lib/trustScore.js';
import { authenticate, AuthRequest } from '../lib/auth.middleware.js';
import { setOrderLocation, invalidateOrderLocation } from '../lib/locationCache.js';
import { categoryBreadcrumbs } from '../lib/categoryBreadcrumbs.js';
import { snapshotSchemaForOrder, withOrderTraceIds } from '../lib/orderSnapshot.js';
import { photosJsonToUploadRows } from '../lib/orderPhotosForValidate.js';
import { isServiceQuestionnaireV1 } from '../lib/serviceDefinitionTypes.js';
import { validateServiceAnswers } from '../lib/serviceQuestionnaireValidate.js';
import { phaseFromStatus, phaseListWhere } from '../lib/orderPhase.js';
import {
  estimateRemainingTime,
  formatRemainingTime,
  getPhaseLabel,
} from '../lib/orderTimeEstimate.js';
import { countOrderPhaseFacets } from '../lib/orderPhaseFacets.js';
import {
  findEligiblePackagesForOffer,
  findEligibleNegotiationPackagesForOffer,
} from '../lib/matching/eligibility.js';
import { autoMatchOffer } from '../lib/matching/orchestrator.js';
import {
  expireStaleAttempts,
  roundRobinInviteOffer,
  RoundRobinValidationError,
} from '../lib/matching/roundRobin.js';
import {
  assertWorkspaceMember,
  listMyWorkspaces,
  WorkspaceAccessError,
} from '../lib/workspaceAccess.js';
import {
  getOrderPaymentSummary,
  releaseEscrowPayment,
  refundEscrowPayment,
} from '../lib/orderPayments.js';
import {
  notifyEscrowReleased,
  notifyPaymentRefunded,
} from '../lib/orderLifecycleNotifications.js';
import {
  deductBomInventory,
  restoreBomInventory,
} from '../lib/orderBom.js';
import {
  checkPackageCapacity,
  reserveProviderSlot,
  releaseProviderSlot,
} from '../lib/orderCapacity.js';

import { generateInvoicePdf, getInvoiceFilename } from '../lib/invoiceGenerator.js';
import { z } from 'zod';

const budgetSchema = z
  .object({
    budget: z.number().int().positive().optional(),
    budgetMin: z.number().int().positive().optional(),
    budgetMax: z.number().int().positive().optional(),
  })
  .refine(
    (data) => {
      if (data.budgetMin != null && data.budgetMax != null) {
        return data.budgetMin < data.budgetMax;
      }
      return true;
    },
    { message: 'budgetMin must be less than budgetMax' },
  );

const walkInOrderSchema = z.object({
  providerId: z.string().uuid(),
  serviceCatalogId: z.string().uuid(),
  packageId: z.string().uuid().optional(),
  description: z.string().min(20, 'description must be at least 20 characters').max(2000, 'description must be at most 2000 characters'),
  addressId: z.string().uuid(),
  urgency: z.nativeEnum(OrderUrgency).optional().default(OrderUrgency.standard),
});

const reorderSchema = z.object({
  description: z.string().min(20).max(2000).optional(),
  scheduledAt: z.string().datetime().optional(),
  addressId: z.string().uuid().optional(),
  urgency: z.nativeEnum(OrderUrgency).optional(),
});

const router = Router();

const DEFAULT_PHASES: OrderPhase[] = [OrderPhase.offer, OrderPhase.order, OrderPhase.job];

const SCHEDULE_FLEX = new Set(['asap', 'this_week', 'specific']);

function canViewOrderAsStaff(role: string): boolean {
  return ['owner', 'platform_admin', 'support', 'finance'].includes(role);
}

async function canViewOrderAsMatchedParty(
  userId: string,
  order: { matchedProviderId: string | null; matchedWorkspaceId: string | null },
): Promise<boolean> {
  if (order.matchedProviderId && order.matchedProviderId === userId) return true;
  if (!order.matchedWorkspaceId) return false;
  try {
    await assertWorkspaceMember(userId, order.matchedWorkspaceId);
    return true;
  } catch (e) {
    if (e instanceof WorkspaceAccessError) return false;
    throw e;
  }
}

function pickStr(v: unknown): string | undefined {
  if (typeof v === 'string' && v.trim()) return v.trim();
  return undefined;
}

function pickQueryStr(q: AuthRequest['query'], key: string): string | undefined {
  const v = q[key];
  if (typeof v === 'string' && v.trim()) return v.trim();
  if (Array.isArray(v) && typeof v[0] === 'string' && v[0].trim()) return v[0].trim();
  return undefined;
}

function toStrArray(x: unknown): string[] {
  if (x == null) return [];
  if (Array.isArray(x)) return x.filter((a): a is string => typeof a === 'string' && a.length > 0);
  if (typeof x === 'string' && x.length) return [x];
  return [];
}

const ORDER_PHASES = new Set<string>(['offer', 'order', 'job']);

function parsePhaseArray(q: AuthRequest['query']): OrderPhase[] {
  const raw = [
    ...toStrArray((q as Record<string, unknown>)['phase']),
    ...toStrArray((q as Record<string, unknown>)['phase[]']),
  ].filter((s) => ORDER_PHASES.has(s));
  return raw.map((p) => p as OrderPhase);
}

function parseIncludeDraftsCustomer(q: AuthRequest['query']): boolean {
  if (pickQueryStr(q, 'includeDrafts') === 'false') return false;
  return true;
}

function parseStatusArray(q: AuthRequest['query']): OrderStatus[] {
  const raw = [
    ...(Array.isArray(q.status) ? q.status : q.status != null ? [q.status] : []),
    ...(Array.isArray((q as Record<string, unknown>)['status[]'])
      ? ((q as Record<string, unknown>)['status[]'] as string[])
      : []),
  ];
  const allowed = new Set<string>(Object.values(OrderStatus));
  return raw
    .flatMap((x) => (typeof x === 'string' ? [x] : []))
    .filter((s) => allowed.has(s)) as OrderStatus[];
}

function parseIntDefault(s: string | undefined, def: number, min: number, max: number): number {
  const n = s != null && s !== '' ? Number.parseInt(s, 10) : def;
  if (Number.isNaN(n)) return def;
  return Math.max(min, Math.min(max, n));
}

function parseEntryPoint(raw: unknown): OrderEntryPoint | null {
  if (raw === OrderEntryPoint.explorer) return OrderEntryPoint.explorer;
  if (raw === OrderEntryPoint.ai_suggestion) return OrderEntryPoint.ai_suggestion;
  if (raw === OrderEntryPoint.direct) return OrderEntryPoint.direct;
  if (raw === OrderEntryPoint.wizard) return OrderEntryPoint.wizard;
  if (raw === OrderEntryPoint.reorder) return OrderEntryPoint.reorder;
  if (raw === OrderEntryPoint.guest) return OrderEntryPoint.guest;
  if (typeof raw === 'string') {
    if (raw === 'explorer') return OrderEntryPoint.explorer;
    if (raw === 'ai_suggestion') return OrderEntryPoint.ai_suggestion;
    if (raw === 'direct') return OrderEntryPoint.direct;
    if (raw === 'wizard') return OrderEntryPoint.wizard;
    if (raw === 'reorder') return OrderEntryPoint.reorder;
    if (raw === 'guest') return OrderEntryPoint.guest;
  }
  return null;
}

function asAnswersRecord(v: unknown): Record<string, unknown> {
  if (v && typeof v === 'object' && !Array.isArray(v)) return { ...(v as Record<string, unknown>) };
  return {};
}

/** Prisma.Json field write: plain objects need a round-trip for `InputJsonValue`. */
function answersToJson(answers: Record<string, unknown>): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(answers)) as Prisma.InputJsonValue;
}

function normalizePhotosJson(v: unknown): Prisma.InputJsonValue {
  if (!Array.isArray(v)) return [];
  const out: Prisma.InputJsonValue[] = [];
  for (const p of v) {
    if (!p || typeof p !== 'object') continue;
    const o = p as Record<string, unknown>;
    out.push({
      url: typeof o.url === 'string' ? o.url : '',
      fileName: typeof o.fileName === 'string' ? o.fileName : '',
      mimeType: typeof o.mimeType === 'string' ? o.mimeType : 'application/octet-stream',
      sizeBytes: typeof o.sizeBytes === 'number' && Number.isFinite(o.sizeBytes) ? o.sizeBytes : 0,
      ...(typeof o.fieldId === 'string' ? { fieldId: o.fieldId } : {}),
    });
  }
  return out;
}

async function orderToCustomerJson(order: {
  id: string;
  customerId: string;
  serviceCatalogId: string;
  schemaSnapshot: Prisma.JsonValue;
  answers: Prisma.JsonValue;
  photos: Prisma.JsonValue;
  description: string;
  descriptionAiAssisted: boolean;
  scheduledAt: Date | null;
  scheduleFlexibility: string;
  address: string;
  locationLat: number | null;
  locationLng: number | null;
  entryPoint: OrderEntryPoint;
  urgency: OrderUrgency | null;
  status: OrderStatus;
  phase: OrderPhase | null;
  matchedPackageId?: string | null;
  matchedProviderId?: string | null;
  matchedWorkspaceId?: string | null;
  assignedStaffId?: string | null;
  autoMatchExhausted?: boolean | null;
  matchingExpiresAt?: Date | null;
  customerPicks?: Prisma.JsonValue | null;
  budget?: number | null;
  budgetMin?: number | null;
  budgetMax?: number | null;
  cancelReason: string | null;
  cancelledAt: Date | null;
  submittedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  jobRecord?: { id: string } | null;
  assignedStaff?: { id: string; displayName: string | null; firstName: string | null; lastName: string | null; avatarUrl: string | null } | null;
}) {
  return {
    id: order.id,
    offerId: order.id,
    orderId: order.id,
    jobId: order.jobRecord?.id ?? null,
    customerId: order.customerId,
    serviceCatalogId: order.serviceCatalogId,
    schemaSnapshot: order.schemaSnapshot,
    answers: order.answers,
    photos: order.photos,
    description: order.description,
    descriptionAiAssisted: order.descriptionAiAssisted,
    scheduledAt: order.scheduledAt?.toISOString() ?? null,
    scheduleFlexibility: order.scheduleFlexibility,
    address: order.address,
    locationLat: order.locationLat,
    locationLng: order.locationLng,
    entryPoint: order.entryPoint,
    urgency: order.urgency ?? 'standard',
    status: order.status,
    phase: order.phase,
    matchedPackageId: order.matchedPackageId ?? null,
    matchedProviderId: order.matchedProviderId ?? null,
    matchedWorkspaceId: order.matchedWorkspaceId ?? null,
    assignedStaffId: order.assignedStaffId ?? null,
    assignedStaff: order.assignedStaff
      ? {
          id: order.assignedStaff.id,
          displayName: order.assignedStaff.displayName,
          firstName: order.assignedStaff.firstName,
          lastName: order.assignedStaff.lastName,
          avatarUrl: order.assignedStaff.avatarUrl,
        }
      : null,
    autoMatchExhausted: order.autoMatchExhausted ?? false,
    matchingExpiresAt: order.matchingExpiresAt?.toISOString() ?? null,
    customerPicks: order.customerPicks ?? null,
    budget: order.budget ?? null,
    budgetMin: order.budgetMin ?? null,
    budgetMax: order.budgetMax ?? null,
    cancelReason: order.cancelReason,
    cancelledAt: order.cancelledAt?.toISOString() ?? null,
    submittedAt: order.submittedAt?.toISOString() ?? null,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  };
}

async function resolveWizardSchema(order: {
  schemaSnapshot: Prisma.JsonValue;
  serviceCatalogId: string;
}): Promise<{ schema: unknown; staleSnapshot: boolean }> {
  const snap = order.schemaSnapshot;
  if (snap != null && isServiceQuestionnaireV1(snap)) {
    return { schema: snap, staleSnapshot: false };
  }
  const cat = await prisma.serviceCatalog.findUnique({
    where: { id: order.serviceCatalogId },
    select: { dynamicFieldsSchema: true },
  });
  const raw = cat?.dynamicFieldsSchema;
  if (raw != null && isServiceQuestionnaireV1(raw)) {
    return { schema: raw, staleSnapshot: true };
  }
  return { schema: null, staleSnapshot: true };
}

/**
 * Shared draft → submitted transition (questionnaire validation, audit, NATS, matching).
 * Caller must not send a response after this returns (all paths call `res.*`).
 */
async function runSubmitDraftOrderFlow(
  res: Response,
  userId: string,
  id: string,
  body: Record<string, unknown>,
): Promise<void> {
  try {
    const order = await prisma.order.findFirst({ where: { id, customerId: userId } });
    if (!order) {
      res.status(404).json({ error: 'Draft not found' });
      return;
    }
    if (order.status !== OrderStatus.draft) {
      if (order.status === OrderStatus.submitted) {
        res.status(409).json({
          error: 'Already submitted',
          order: await orderToCustomerJson(order),
        });
        return;
      }
      res.status(400).json({ error: 'Order is not a draft' });
      return;
    }

    let answers = asAnswersRecord(order.answers);
    let photosRaw: unknown = order.photos;
    let description = order.description;
    let descriptionAiAssisted = order.descriptionAiAssisted;
    let scheduledAt = order.scheduledAt;
    let scheduleFlexibility = order.scheduleFlexibility;
    let address = order.address;
    let locationLat = order.locationLat;
    let locationLng = order.locationLng;
    let budget = order.budget;
    let budgetMin = order.budgetMin;
    let budgetMax = order.budgetMax;

    if ('answers' in body && body.answers !== undefined) {
      answers = { ...answers, ...asAnswersRecord(body.answers) };
    }
    if ('photos' in body) photosRaw = body.photos;
    if (typeof body.description === 'string') description = body.description;
    if (typeof body.descriptionAiAssisted === 'boolean') {
      descriptionAiAssisted = body.descriptionAiAssisted;
    }
    if (body.scheduledAt !== undefined) {
      const d = body.scheduledAt != null ? new Date(String(body.scheduledAt)) : null;
      scheduledAt = d && !Number.isNaN(d.getTime()) ? d : null;
    }
    if (typeof body.scheduleFlexibility === 'string' && SCHEDULE_FLEX.has(body.scheduleFlexibility)) {
      scheduleFlexibility = body.scheduleFlexibility;
    }
    if (typeof body.address === 'string') address = body.address;
    if (body.locationLat !== undefined) {
      locationLat =
        typeof body.locationLat === 'number' && Number.isFinite(body.locationLat)
          ? body.locationLat
          : null;
    }
    if (body.locationLng !== undefined) {
      locationLng =
        typeof body.locationLng === 'number' && Number.isFinite(body.locationLng)
          ? body.locationLng
          : null;
    }

    // Budget fields from body
    const budgetPayload: Record<string, unknown> = {};
    if ('budget' in body) budgetPayload.budget = body.budget;
    if ('budgetMin' in body) budgetPayload.budgetMin = body.budgetMin;
    if ('budgetMax' in body) budgetPayload.budgetMax = body.budgetMax;
    if (Object.keys(budgetPayload).length > 0) {
      const budgetResult = budgetSchema.safeParse(budgetPayload);
      if (!budgetResult.success) {
        res.status(400).json({
          error: 'Invalid budget fields',
          errors: budgetResult.error.flatten().fieldErrors,
        });
        return;
      }
      if (budgetResult.data.budget !== undefined) budget = budgetResult.data.budget;
      if (budgetResult.data.budgetMin !== undefined) budgetMin = budgetResult.data.budgetMin;
      if (budgetResult.data.budgetMax !== undefined) budgetMax = budgetResult.data.budgetMax;
    }

    // Parse urgency from body, default to 'standard'
    let urgency: OrderUrgency = OrderUrgency.standard;
    if (typeof body.urgency === 'string') {
      const u = body.urgency.toLowerCase();
      if (u === 'urgent') urgency = OrderUrgency.urgent;
      else if (u === 'emergency') urgency = OrderUrgency.emergency;
    }

    const photosJson = normalizePhotosJson(photosRaw);

    let schema;
    try {
      schema = await snapshotSchemaForOrder(order.serviceCatalogId);
    } catch {
      res.status(400).json({
        error:
          'This service type is unavailable or inactive. Please pick another service from the catalog or try again later.',
      });
      return;
    }

    const filesResult = photosJsonToUploadRows(photosJson, schema);
    if (filesResult.ok === false) {
      res.status(400).json({ error: filesResult.error });
      return;
    }

    const validation = validateServiceAnswers(schema, answers, filesResult.rows);
    if (!validation.valid) {
      res.status(400).json({ error: 'Validation failed', errors: validation.errors });
      return;
    }

    if (description.trim().length < 20) {
      res.status(400).json({ error: 'description must be at least 20 characters' });
      return;
    }
    if (description.length > 2000) {
      res.status(400).json({ error: 'description must be at most 2000 characters' });
      return;
    }
    if (!address.trim()) {
      res.status(400).json({ error: 'address is required' });
      return;
    }
    if (!SCHEDULE_FLEX.has(scheduleFlexibility)) {
      res.status(400).json({ error: 'Invalid scheduleFlexibility' });
      return;
    }
    if (scheduleFlexibility === 'specific') {
      if (!scheduledAt) {
        res.status(400).json({ error: 'scheduledAt is required when scheduleFlexibility is specific' });
        return;
      }
      if (scheduledAt.getTime() <= Date.now()) {
        res.status(400).json({ error: 'scheduledAt must be in the future' });
        return;
      }
    }

    // Staff photo validation: if assignedStaffId is set, verify staff has avatarUrl
    if (order.assignedStaffId) {
      const staff = await prisma.user.findUnique({
        where: { id: order.assignedStaffId },
        select: { avatarUrl: true },
      });
      if (!staff?.avatarUrl) {
        res.status(400).json({
          error: 'Assigned staff member must have a profile photo before booking.',
          code: 'STAFF_PHOTO_REQUIRED',
        });
        return;
      }
    }

    const snapshot = withOrderTraceIds(schema as Record<string, unknown>, {
      id: order.id,
      jobRecord: null,
    }) as unknown as Prisma.InputJsonValue;

    // Cache order location in Redis before submitting
    if (locationLat != null && locationLng != null) {
      await setOrderLocation(id, locationLat, locationLng, address);
    }

    // Set matchingExpiresAt based on urgency
    const now = new Date();
    let matchingExpiresAt: Date | null = null;
    if (urgency === OrderUrgency.emergency) {
      matchingExpiresAt = new Date(now.getTime() + 30 * 60 * 1000); // 30 minutes
    } else if (urgency === OrderUrgency.urgent) {
      matchingExpiresAt = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours
    } else {
      matchingExpiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours (default)
    }

    const submitted = await prisma.$transaction(async (tx) => {
      const o = await tx.order.update({
        where: { id },
        data: {
          answers: answersToJson(answers),
          photos: photosJson,
          description,
          descriptionAiAssisted,
          scheduledAt,
          scheduleFlexibility,
          address,
          locationLat,
          locationLng,
          schemaSnapshot: snapshot,
          status: OrderStatus.submitted,
          phase: phaseFromStatus(OrderStatus.submitted),
          submittedAt: new Date(),
          urgency,
          matchingExpiresAt,
          ...(budget !== undefined ? { budget } : {}),
          ...(budgetMin !== undefined ? { budgetMin } : {}),
          ...(budgetMax !== undefined ? { budgetMax } : {}),
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: 'ORDER_SUBMITTED',
          resourceType: 'order',
          resourceId: id,
        },
      });
      return o;
    });

    await publish('orders.submitted', {
      orderId: submitted.id,
      customerId: submitted.customerId,
      serviceCatalogId: submitted.serviceCatalogId,
    });

    type SubmitMatchOutcome =
      | {
          mode: 'auto_matched';
          attemptId?: string;
          windowExpiresAt?: string | null;
          reason?: string;
        }
      | {
          mode: 'round_robin_invited';
          invitedCount: number;
          attemptIds: string[];
          windowExpiresAt?: string | null;
          reason?: string;
        }
      | {
          mode: 'no_eligible_providers';
          reason?: string;
          windowExpiresAt?: string | null;
        };

    let matchOutcome: SubmitMatchOutcome = { mode: 'no_eligible_providers', reason: 'not_evaluated' };

    try {
      const pre = await findEligiblePackagesForOffer(submitted.id);
      if (pre.length > 0) {
        // ── Capacity validation (G1/G15) ──────────────────────────────
        const capacityResult = await checkPackageCapacity(pre, submitted.scheduledAt);
        if (capacityResult.allOverCapacity) {
          res.status(409).json({
            code: 'CAPACITY_EXCEEDED',
            message: 'All eligible providers have reached their maximum daily bookings for this date.',
          });
          return;
        }

        // Filter eligible packages to only those under capacity
        const underCapacityIds = new Set(capacityResult.underCapacity.map((p) => p.packageId));
        const filteredPre = pre.filter((ep) => underCapacityIds.has(ep.package.id));

        if (filteredPre.length === 0) {
          // All packages were filtered out — treat as no eligible providers
          matchOutcome = {
            mode: 'no_eligible_providers',
            reason: 'all_eligible_packages_over_capacity',
            windowExpiresAt: null,
          };
        } else {
          const mo = await autoMatchOffer(submitted.id, { depth: 0 });
          if (mo.matched) {
            const snap = await prisma.order.findUnique({
              where: { id: submitted.id },
              select: { matchingExpiresAt: true, matchedPackageId: true },
            });

            // Reserve the slot atomically for the matched provider
            if (snap?.matchedPackageId && submitted.scheduledAt) {
              const matchedPkg = capacityResult.underCapacity.find(
                (p) => p.packageId === snap.matchedPackageId,
              );
              if (matchedPkg) {
                await reserveProviderSlot(
                  matchedPkg.providerId,
                  submitted.scheduledAt,
                  urgency,
                  matchedPkg.maxDailyBookings,
                );
              }
            }

            matchOutcome = {
              mode: 'auto_matched',
              ...(mo.attemptId != null ? { attemptId: mo.attemptId } : {}),
              ...(mo.reason != null ? { reason: mo.reason } : {}),
              windowExpiresAt: snap?.matchingExpiresAt?.toISOString() ?? null,
            };
          } else {
            const rr = await roundRobinInviteOffer(submitted.id);
            const snap = await prisma.order.findUnique({
              where: { id: submitted.id },
              select: { matchingExpiresAt: true },
            });
            if (rr.invitedCount > 0) {
              matchOutcome = {
                mode: 'round_robin_invited',
                invitedCount: rr.invitedCount,
                attemptIds: rr.attemptIds,
                windowExpiresAt: snap?.matchingExpiresAt?.toISOString() ?? null,
              };
            } else {
              matchOutcome = {
                mode: 'no_eligible_providers',
                reason: 'no_negotiation_eligible_packages',
                windowExpiresAt: null,
              };
            }
          }
        }
      } else {
        const rr = await roundRobinInviteOffer(submitted.id);
        const snap = await prisma.order.findUnique({
          where: { id: submitted.id },
          select: { matchingExpiresAt: true },
        });
        if (rr.invitedCount > 0) {
          matchOutcome = {
            mode: 'round_robin_invited',
            invitedCount: rr.invitedCount,
            attemptIds: rr.attemptIds,
            windowExpiresAt: snap?.matchingExpiresAt?.toISOString() ?? null,
          };
        } else {
          matchOutcome = {
            mode: 'no_eligible_providers',
            reason: 'no_negotiation_eligible_packages',
            windowExpiresAt: null,
          };
        }
      }
    } catch (matchErr: unknown) {
      if (matchErr instanceof RoundRobinValidationError) {
        const o = await prisma.order.findUnique({ where: { id: submitted.id } });
        res.status(400).json({
          error: matchErr.message,
          ...(o ? { order: await orderToCustomerJson(o) } : {}),
        });
        return;
      }
      console.error(matchErr);
      matchOutcome = { mode: 'no_eligible_providers', reason: 'match_error' };
    }

    const finalOrder = await prisma.order.findUnique({
      where: { id: submitted.id },
      include: {
        matchedProvider: {
          select: { id: true, displayName: true, firstName: true, lastName: true, avatarUrl: true },
        },
        matchedWorkspace: { select: { id: true, name: true } },
        matchedPackage: {
          select: { id: true, name: true, finalPrice: true, currency: true, durationMinutes: true },
        },
      },
    });
    if (!finalOrder) {
      res.status(500).json({ error: 'Order not found after submit' });
      return;
    }
    res.json({
      ...(await orderToCustomerJson(finalOrder)),
      matchOutcome,
      matchedSummary:
        finalOrder.matchedProvider && finalOrder.matchedWorkspace && finalOrder.matchedPackage
          ? {
              provider: finalOrder.matchedProvider,
              workspace: finalOrder.matchedWorkspace,
              package: finalOrder.matchedPackage,
            }
          : null,
    });
  } catch (err: unknown) {
    console.error(err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
  }
}

router.use(authenticate);

// POST /orders/walk-in — Walk-in booking (Mode 5): immediate service, skip matching
router.post('/walk-in', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const parsed = walkInOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Validation failed',
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const { providerId, serviceCatalogId, packageId, description, addressId, urgency } = parsed.data;

    // Verify provider exists and is active
    const provider = await prisma.user.findUnique({
      where: { id: providerId },
      select: { id: true, status: true },
    });
    if (!provider) {
      return res.status(404).json({ error: 'Provider not found' });
    }
    if (provider.status !== 'active') {
      return res.status(400).json({ error: 'Provider is not active' });
    }

    // Verify service catalog exists and is active
    const catalog = await prisma.serviceCatalog.findUnique({
      where: { id: serviceCatalogId },
      select: { id: true, isActive: true },
    });
    if (!catalog) {
      return res.status(404).json({ error: 'Service catalog not found' });
    }
    if (!catalog.isActive) {
      return res.status(400).json({ error: 'Service catalog is not active' });
    }

    // Verify provider offers the requested service via ProviderServicePackage
    const packageWhere: {
      providerId: string;
      serviceCatalogId: string;
      isActive: boolean;
      id?: string;
    } = {
      providerId,
      serviceCatalogId,
      isActive: true,
    };
    if (packageId) {
      packageWhere.id = packageId;
    }

    const providerPackage = await prisma.providerServicePackage.findFirst({
      where: packageWhere,
      select: {
        id: true,
        providerId: true,
        maxDailyBookings: true,
        slotDurationMinutes: true,
        workspaceId: true,
      },
    });
    if (!providerPackage) {
      return res.status(400).json({
        error: packageId
          ? 'Provider does not offer the specified package for this service'
          : 'Provider does not offer any active package for this service',
      });
    }

    // Check business hours for walk-in (ADR-0065)
    const { isOpen, reason } = await isWorkspaceOpenForWalkIn(providerPackage.workspaceId);
    if (!isOpen) {
      return res.status(400).json({
        code: 'BUSINESS_CLOSED',
        message: reason ?? 'Business is currently closed for walk-in bookings',
      });
    }

    // Check provider capacity
    const scheduledAt = new Date();
    const capacityResult = await checkPackageCapacity(
      [{ package: providerPackage }],
      scheduledAt,
    );
    if (capacityResult.allOverCapacity) {
      return res.status(409).json({
        code: 'CAPACITY_EXCEEDED',
        message: 'Provider has reached their maximum daily bookings for today.',
      });
    }

    // Create the order in a transaction: order + contract + audit log + NATS events
    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          customerId: userId,
          serviceCatalogId,
          schemaSnapshot: {},
          answers: {},
          photos: [],
          description,
          descriptionAiAssisted: false,
          scheduledAt,
          scheduleFlexibility: 'asap',
          address: addressId,
          entryPoint: 'direct',
          urgency,
          status: OrderStatus.contracted,
          phase: phaseFromStatus(OrderStatus.contracted),
          submittedAt: new Date(),
          matchedProviderId: providerId,
          matchedPackageId: providerPackage.id,
          matchedWorkspaceId: providerPackage.workspaceId,
        },
      });

      // Create contract (since order goes directly to contracted)
      const contract = await tx.orderContract.create({
        data: {
          orderId: order.id,
        },
      });

      const contractVersion = await tx.contractVersion.create({
        data: {
          contractId: contract.id,
          versionNumber: 1,
          status: 'draft',
          title: `Walk-in service — ${serviceCatalogId}`,
          termsMarkdown: '',
        },
      });

      await tx.orderContract.update({
        where: { id: contract.id },
        data: { currentVersionId: contractVersion.id },
      });

      await tx.contractEvent.create({
        data: {
          contractId: contract.id,
          versionId: contractVersion.id,
          actorId: userId,
          actorRole: 'customer',
          actionType: 'admin_internal_note',
          note: 'Walk-in order — contract auto-created',
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: 'ORDER_CREATED_WALK_IN',
          resourceType: 'order',
          resourceId: order.id,
        },
      });

      return order;
    });

    // Publish NATS events (outside transaction — NATS is optional)
    await publish('order.created', {
      orderId: result.id,
      customerId: userId,
      providerId,
      serviceCatalogId,
      bookingMode: 'walk_in',
    });

    await publish('order.contracted', {
      orderId: result.id,
      customerId: userId,
      providerId,
      serviceCatalogId,
    });

    const created = await prisma.order.findUnique({
      where: { id: result.id },
      include: {
        matchedProvider: {
          select: { id: true, displayName: true, firstName: true, lastName: true, avatarUrl: true },
        },
        matchedWorkspace: { select: { id: true, name: true } },
        matchedPackage: {
          select: { id: true, name: true, finalPrice: true, currency: true, durationMinutes: true },
        },
      },
    });

    res.status(201).json({ data: created ? await orderToCustomerJson(created) : result });
  } catch (err: unknown) {
    console.error(err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
  }
});

router.post('/draft', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const body = req.body as Record<string, unknown>;
    const serviceCatalogId = pickStr(body.serviceCatalogId);
    const ep = parseEntryPoint(body.entryPoint);
    if (!serviceCatalogId) {
      return res.status(400).json({ error: 'serviceCatalogId required' });
    }
    if (!ep) {
      return res.status(400).json({ error: 'entryPoint must be explorer | ai_suggestion | direct | wizard | reorder | guest' });
    }
    const catalog = await prisma.serviceCatalog.findUnique({ where: { id: serviceCatalogId } });
    if (!catalog?.isActive) {
      return res.status(404).json({ error: 'Service type not found or inactive' });
    }

    const prefill = body.prefill && typeof body.prefill === 'object' && !Array.isArray(body.prefill)
      ? (body.prefill as Record<string, unknown>)
      : {};

    // Validate budget fields if provided
    const budgetResult = budgetSchema.safeParse({
      budget: prefill.budget,
      budgetMin: prefill.budgetMin,
      budgetMax: prefill.budgetMax,
    });
    if (!budgetResult.success) {
      return res.status(400).json({
        error: 'Invalid budget fields',
        errors: budgetResult.error.flatten().fieldErrors,
      });
    }

    const existing = await prisma.order.findFirst({
      where: { customerId: userId, serviceCatalogId, status: OrderStatus.draft },
    });

    const preAnswers = asAnswersRecord(prefill.answers);
    const preAddr = typeof prefill.address === 'string' ? prefill.address : undefined;
    const preDesc = typeof prefill.description === 'string' ? prefill.description : undefined;
    const preFlex =
      typeof prefill.scheduleFlexibility === 'string' ? prefill.scheduleFlexibility : undefined;
    const preScheduled =
      prefill.scheduledAt != null ? new Date(String(prefill.scheduledAt)) : undefined;
    const prePhotos = prefill.photos !== undefined ? normalizePhotosJson(prefill.photos) : undefined;
    const preLat = prefill.locationLat;
    const preLng = prefill.locationLng;
    const preAi =
      typeof prefill.descriptionAiAssisted === 'boolean' ? prefill.descriptionAiAssisted : undefined;
    const preBudget = budgetResult.data.budget;
    const preBudgetMin = budgetResult.data.budgetMin;
    const preBudgetMax = budgetResult.data.budgetMax;

    if (existing) {
      const updated = await prisma.order.update({
        where: { id: existing.id },
        data: {
          entryPoint: ep,
          ...(Object.keys(preAnswers).length
            ? {
                answers: answersToJson({
                  ...asAnswersRecord(existing.answers),
                  ...preAnswers,
                }),
              }
            : {}),
          ...(preAddr !== undefined ? { address: preAddr } : {}),
          ...(preDesc !== undefined ? { description: preDesc } : {}),
          ...(preFlex !== undefined && SCHEDULE_FLEX.has(preFlex) ? { scheduleFlexibility: preFlex } : {}),
          ...(preScheduled && !Number.isNaN(preScheduled.getTime()) ? { scheduledAt: preScheduled } : {}),
          ...(prePhotos !== undefined ? { photos: prePhotos } : {}),
          ...(typeof preLat === 'number' && Number.isFinite(preLat) ? { locationLat: preLat } : {}),
          ...(typeof preLng === 'number' && Number.isFinite(preLng) ? { locationLng: preLng } : {}),
          ...(preAi !== undefined ? { descriptionAiAssisted: preAi } : {}),
          ...(preBudget !== undefined ? { budget: preBudget } : {}),
          ...(preBudgetMin !== undefined ? { budgetMin: preBudgetMin } : {}),
          ...(preBudgetMax !== undefined ? { budgetMax: preBudgetMax } : {}),
        },
      });
      return res.status(201).json(await orderToCustomerJson(updated));
    }

    const created = await prisma.order.create({
      data: {
        customerId: userId,
        serviceCatalogId,
        entryPoint: ep,
        schemaSnapshot: {},
        answers: answersToJson(Object.keys(preAnswers).length ? preAnswers : {}),
        photos: prePhotos ?? [],
        description: preDesc ?? '',
        descriptionAiAssisted: preAi ?? false,
        scheduledAt:
          preScheduled && !Number.isNaN(preScheduled.getTime()) ? preScheduled : null,
        scheduleFlexibility:
          preFlex && SCHEDULE_FLEX.has(preFlex) ? preFlex : 'asap',
        address: preAddr ?? '',
        locationLat: typeof preLat === 'number' && Number.isFinite(preLat) ? preLat : null,
        locationLng: typeof preLng === 'number' && Number.isFinite(preLng) ? preLng : null,
        budget: preBudget ?? undefined,
        budgetMin: preBudgetMin ?? undefined,
        budgetMax: preBudgetMax ?? undefined,
        status: OrderStatus.draft,
      },
    });
    return res.status(201).json(await orderToCustomerJson(created));
  } catch (err: unknown) {
    console.error(err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
  }
});

router.put('/draft/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;
    const body = req.body as Record<string, unknown>;
    const order = await prisma.order.findFirst({ where: { id, customerId: userId } });
    if (!order) {
      return res.status(404).json({ error: 'Draft not found' });
    }
    if (order.status !== OrderStatus.draft) {
      return res.status(400).json({ error: 'Only draft orders can be updated here' });
    }

    const data: Prisma.OrderUpdateInput = {};
    if ('answers' in body && body.answers !== undefined) {
      data.answers = answersToJson({
        ...asAnswersRecord(order.answers),
        ...asAnswersRecord(body.answers),
      });
    }
    if ('photos' in body) data.photos = normalizePhotosJson(body.photos);
    if (typeof body.description === 'string') data.description = body.description;
    if (typeof body.descriptionAiAssisted === 'boolean') {
      data.descriptionAiAssisted = body.descriptionAiAssisted;
    }
    if (body.scheduledAt !== undefined) {
      const d = body.scheduledAt != null ? new Date(String(body.scheduledAt)) : null;
      data.scheduledAt = d && !Number.isNaN(d.getTime()) ? d : null;
    }
    if (typeof body.scheduleFlexibility === 'string' && SCHEDULE_FLEX.has(body.scheduleFlexibility)) {
      data.scheduleFlexibility = body.scheduleFlexibility;
    }
    if (typeof body.address === 'string') data.address = body.address;
    if (body.locationLat !== undefined) {
      data.locationLat =
        typeof body.locationLat === 'number' && Number.isFinite(body.locationLat)
          ? body.locationLat
          : null;
    }
    if (body.locationLng !== undefined) {
      data.locationLng =
        typeof body.locationLng === 'number' && Number.isFinite(body.locationLng)
          ? body.locationLng
          : null;
    }
    if ('customerPicks' in body && body.customerPicks != null && typeof body.customerPicks === 'object') {
      const prev = asAnswersRecord(order.customerPicks);
      const next = { ...prev, ...(body.customerPicks as Record<string, unknown>) };
      data.customerPicks = answersToJson(next);
    }

    // Budget fields
    const budgetPayload: Record<string, unknown> = {};
    if ('budget' in body) budgetPayload.budget = body.budget;
    if ('budgetMin' in body) budgetPayload.budgetMin = body.budgetMin;
    if ('budgetMax' in body) budgetPayload.budgetMax = body.budgetMax;
    if (Object.keys(budgetPayload).length > 0) {
      const budgetResult = budgetSchema.safeParse(budgetPayload);
      if (!budgetResult.success) {
        return res.status(400).json({
          error: 'Invalid budget fields',
          errors: budgetResult.error.flatten().fieldErrors,
        });
      }
      if (budgetResult.data.budget !== undefined) data.budget = budgetResult.data.budget;
      if (budgetResult.data.budgetMin !== undefined) data.budgetMin = budgetResult.data.budgetMin;
      if (budgetResult.data.budgetMax !== undefined) data.budgetMax = budgetResult.data.budgetMax;
    }

    const updated = await prisma.order.update({ where: { id }, data });

    // Update Redis cache if location changed
    // Extract raw numeric values: data.locationLat/lng may be Prisma update objects
    const rawLat = body.locationLat;
    const rawLng = body.locationLng;
    const finalLat = typeof rawLat === 'number' ? rawLat : updated.locationLat;
    const finalLng = typeof rawLng === 'number' ? rawLng : updated.locationLng;
    if (finalLat != null && finalLng != null) {
      const addr = typeof body.address === 'string' ? body.address : updated.address ?? undefined;
      await setOrderLocation(id, finalLat, finalLng, addr);
    }

    return res.json(await orderToCustomerJson(updated));
  } catch (err: unknown) {
    console.error(err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
  }
});

router.post('/draft/:id/submit', async (req: AuthRequest, res: Response) => {
  await runSubmitDraftOrderFlow(res, req.user!.userId, req.params.id, req.body as Record<string, unknown>);
});

/** F5 wizard final submit (same lifecycle as `/draft/:id/submit` with extra validation + body merge). */
router.post('/:id/submit', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;
    const body = req.body as Record<string, unknown>;

    if (body.agreedToTerms !== true) {
      return res.status(400).json({
        error: 'Terms must be accepted',
        errors: { agreedToTerms: 'You must agree to the Neighborly Terms of Service.' },
      });
    }

    const scope = pickStr(body.scope);
    if (!scope || scope.length < 20) {
      return res.status(400).json({
        error: 'scope must be at least 20 characters',
        errors: { scope: 'Please describe your job (at least 20 characters).' },
      });
    }

    const order = await prisma.order.findFirst({ where: { id, customerId: userId } });
    if (!order) {
      return res.status(404).json({ error: 'Draft not found' });
    }
    if (order.status !== OrderStatus.draft) {
      return res.status(400).json({ error: 'Order is not a draft' });
    }

    const pkgCount = await prisma.providerServicePackage.count({
      where: { serviceCatalogId: order.serviceCatalogId, isActive: true, archivedAt: null },
    });
    const packageId = pickStr(body.packageId);
    if (pkgCount > 0 && !packageId) {
      return res.status(400).json({
        error: 'packageId required',
        errors: { packageId: 'Please select a package for this service.' },
      });
    }
    if (packageId) {
      const pkgOk = await prisma.providerServicePackage.findFirst({
        where: {
          id: packageId,
          serviceCatalogId: order.serviceCatalogId,
          isActive: true,
          archivedAt: null,
        },
      });
      if (!pkgOk) {
        return res.status(400).json({
          error: 'Invalid package',
          errors: { packageId: 'Package does not belong to this service.' },
        });
      }
    }

    const address = pickStr(body.address) ?? order.address;
    const accessNotes = pickStr(body.accessNotes);
    let desc = scope.slice(0, 1000);
    if (accessNotes) {
      desc = `${desc}\n\n--- Access ---\n${accessNotes}`.slice(0, 1000);
    }

    const scheduledRaw = body.scheduledFor;
    let scheduledAt: Date | null = order.scheduledAt;
    if (scheduledRaw != null && String(scheduledRaw).trim() !== '') {
      const d = new Date(String(scheduledRaw));
      scheduledAt = !Number.isNaN(d.getTime()) ? d : order.scheduledAt;
    }

    let scheduleFlex = order.scheduleFlexibility;
    if (typeof body.scheduleFlexibility === 'string' && SCHEDULE_FLEX.has(body.scheduleFlexibility)) {
      scheduleFlex = body.scheduleFlexibility;
    } else {
      const tp = pickStr(body.timePreference);
      if (tp === 'AS_SOON_AS_POSSIBLE') scheduleFlex = 'asap';
      else if (tp === 'THIS_WEEK' || tp === 'NEXT_WEEK') scheduleFlex = 'this_week';
      else if (tp === 'FLEXIBLE') scheduleFlex = 'asap';
    }

    const prevPicks = asAnswersRecord(order.customerPicks);
    const categoryId = pickStr(body.categoryId);
    const serviceId = pickStr(body.serviceId) ?? order.serviceCatalogId;
    const selectedProviderId = pickStr(body.selectedProviderId);
    const customerPicks = {
      ...prevPicks,
      wizardSubmitAt: new Date().toISOString(),
      packageId: packageId ?? null,
      categoryId: categoryId ?? null,
      serviceId,
      agreedToTerms: true,
      timePreference: pickStr(body.timePreference) ?? prevPicks.timePreference,
      ...(selectedProviderId ? { selectedProviderId } : {}),
    };

    let photosJson = normalizePhotosJson(order.photos);
    if (Array.isArray(body.photoIds) && body.photoIds.length > 0) {
      const want = new Set(
        body.photoIds.filter((x): x is string => typeof x === 'string' && x.trim().length > 0),
      );
      const arr = (photosJson as unknown as Record<string, unknown>[]).filter(
        (p) => typeof p.url === 'string' && want.has(p.url),
      );
      photosJson = arr as unknown as Prisma.InputJsonValue;
    }

    // Budget fields from body
    const budgetPayload: Record<string, unknown> = {};
    if ('budget' in body) budgetPayload.budget = body.budget;
    if ('budgetMin' in body) budgetPayload.budgetMin = body.budgetMin;
    if ('budgetMax' in body) budgetPayload.budgetMax = body.budgetMax;
    if (Object.keys(budgetPayload).length > 0) {
      const budgetResult = budgetSchema.safeParse(budgetPayload);
      if (!budgetResult.success) {
        return res.status(400).json({
          error: 'Invalid budget fields',
          errors: budgetResult.error.flatten().fieldErrors,
        });
      }
    }

    await prisma.order.update({
      where: { id },
      data: {
        description: desc,
        address,
        scheduledAt,
        scheduleFlexibility: scheduleFlex,
        photos: photosJson,
        customerPicks: answersToJson(customerPicks),
        ...(budgetPayload.budget !== undefined ? { budget: budgetPayload.budget as number } : {}),
        ...(budgetPayload.budgetMin !== undefined ? { budgetMin: budgetPayload.budgetMin as number } : {}),
        ...(budgetPayload.budgetMax !== undefined ? { budgetMax: budgetPayload.budgetMax as number } : {}),
      },
    });

    await runSubmitDraftOrderFlow(res, userId, id, budgetPayload);
  } catch (err: unknown) {
    console.error(err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
  }
});

router.get('/me', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const statusFilter = parseStatusArray(req.query);
    const phases = parsePhaseArray(req.query);
    const effectivePhases = phases.length ? phases : DEFAULT_PHASES;
    const includeDrafts = parseIncludeDraftsCustomer(req.query);
    const page = parseIntDefault(pickQueryStr(req.query, 'page'), 1, 1, 1_000_000);
    const pageSize = parseIntDefault(pickQueryStr(req.query, 'pageSize'), 20, 1, 100);
    const andList: Prisma.OrderWhereInput[] = [{ customerId: userId }, phaseListWhere(effectivePhases, includeDrafts)];
    if (statusFilter.length) {
      andList.push({ status: { in: statusFilter } });
    }
    const where: Prisma.OrderWhereInput = andList.length > 1 ? { AND: andList } : andList[0]!;
    /** Phase facets for the whole customer pipeline (ignore list status/phase filters). */
    const whereFacetBase: Prisma.OrderWhereInput = { customerId: userId };
    const skip = (page - 1) * pageSize;
    const [total, rows, facetsPhase] = await Promise.all([
      prisma.order.count({ where }),
      prisma.order.findMany({
        where,
        include: {
          serviceCatalog: { select: { id: true, name: true, categoryId: true } },
          jobRecord: true,
          matchedProvider: {
            select: { id: true, displayName: true, firstName: true, lastName: true, avatarUrl: true },
          },
          matchedWorkspace: { select: { id: true, name: true } },
          matchedPackage: {
            select: { id: true, name: true, finalPrice: true, currency: true, durationMinutes: true },
          },
          assignedStaff: {
            select: { id: true, displayName: true, firstName: true, lastName: true, avatarUrl: true },
          },
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: pageSize,
      }),
      countOrderPhaseFacets(whereFacetBase),
    ]);

    const providerIdsForRatings = [...new Set(rows.map((r) => r.matchedProviderId).filter(Boolean))] as string[];
    const ratingGroups =
      providerIdsForRatings.length > 0
        ? await prisma.service.groupBy({
            by: ['providerId'],
            where: { providerId: { in: providerIdsForRatings } },
            _avg: { rating: true },
          })
        : [];
    const ratingByProvider = new Map(
      ratingGroups.map((g) => [g.providerId, g._avg.rating ?? null] as const),
    );

    const uniqueCategoryIds = [
      ...new Set(rows.map((r) => r.serviceCatalog.categoryId).filter(Boolean)),
    ] as string[];
    const crumbCache = new Map<string, Awaited<ReturnType<typeof categoryBreadcrumbs>>>();
    await Promise.all(
      uniqueCategoryIds.map(async (cid) => {
        crumbCache.set(cid, await categoryBreadcrumbs(cid, 5));
      }),
    );

    const items = await Promise.all(
      rows.map(async (r) => {
        const base = await orderToCustomerJson(r);
        const cid = r.serviceCatalog.categoryId;
        const breadcrumb = cid ? crumbCache.get(cid) ?? [] : [];
        return {
          ...base,
          jobId: r.jobRecord?.id ?? null,
          serviceCatalog: {
            id: r.serviceCatalog.id,
            name: r.serviceCatalog.name,
            breadcrumb,
          },
          matchedSummary:
            r.matchedProvider && r.matchedWorkspace && r.matchedPackage
              ? {
                  provider: r.matchedProvider,
                  workspace: r.matchedWorkspace,
                  package: r.matchedPackage,
                }
              : null,
          matchedProviderRating: r.matchedProviderId ? ratingByProvider.get(r.matchedProviderId) ?? null : null,
        };
      }),
    );

    res.json({
      items,
      total,
      page,
      pageSize,
      facets: { phase: facetsPhase },
    });
  } catch (err: unknown) {
    console.error(err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
  }
});

/**
 * Maps a Prisma OrderStatus to the time estimation OrderPhase type.
 * The time estimation module uses finer-grained phases than Prisma's
 * `offer | order | job`.
 */
function statusToTimeEstimatePhase(status: OrderStatus): import('../lib/orderTimeEstimate.js').OrderPhase {
  switch (status) {
    case OrderStatus.draft:
    case OrderStatus.submitted:
      return 'quoting';
    case OrderStatus.matching:
      return 'matching';
    case OrderStatus.matched:
      return 'negotiation';
    case OrderStatus.contracted:
      return 'contracted';
    case OrderStatus.paid:
      return 'paid';
    case OrderStatus.in_progress:
      return 'in_progress';
    case OrderStatus.completed:
      return 'completed';
    case OrderStatus.cancelled:
      return 'cancelled';
    case OrderStatus.disputed:
    case OrderStatus.closed:
      return 'disputed';
    case OrderStatus.expired:
      return 'cancelled';
    default:
      return 'quoting';
  }
}

/**
 * GET /orders/:id/status — Lightweight status endpoint for live polling (F1).
 *
 * Returns only essential status fields, time estimation, payment info, and provider info.
 * The order must belong to the authenticated user.
 */
router.get('/:id/status', async (req: AuthRequest, res: Response, next) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        payment: {
          select: { amount: true, status: true, escrowReleaseAt: true },
        },
        matchedProvider: {
          select: { id: true, phone: true },
        },
        matchedWorkspace: {
          select: { name: true },
        },
        jobRecord: {
          select: { completedAt: true },
        },
      },
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.customerId !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const timeEstimatePhase = statusToTimeEstimatePhase(order.status);
    const urgency = order.urgency ?? 'standard';

    const timeResult = estimateRemainingTime({
      phase: timeEstimatePhase,
      urgency,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    });

    const label = getPhaseLabel(timeEstimatePhase);
    const remainingText = formatRemainingTime(timeResult.remainingMs);

    res.json({
      data: {
        id: order.id,
        status: order.status,
        phase: order.phase,
        urgency: order.urgency ?? 'standard',
        createdAt: order.createdAt.toISOString(),
        updatedAt: order.updatedAt.toISOString(),
        scheduledAt: order.scheduledAt?.toISOString() ?? null,
        completedAt: order.jobRecord?.completedAt?.toISOString() ?? null,
        cancelledAt: order.cancelledAt?.toISOString() ?? null,
        budget: order.budget ?? null,
        timeEstimate: {
          remainingMs: timeResult.remainingMs,
          totalMs: timeResult.totalMs,
          elapsedMs: timeResult.elapsedMs,
          percentage: timeResult.percentage,
          label,
          remainingText,
        },
        payment: order.payment
          ? {
              amount: order.payment.amount,
              status: order.payment.status,
              escrowReleaseAt: order.payment.escrowReleaseAt?.toISOString() ?? null,
            }
          : null,
        provider: order.matchedProvider
          ? {
              id: order.matchedProvider.id,
              businessName: order.matchedWorkspace?.name ?? null,
              phone: order.matchedProvider.phone ?? null,
            }
          : null,
      },
    });
  } catch (err: unknown) {
    next(err);
  }
});

/**
 * GET /orders/:id/invoice — Returns the invoice PDF for a completed order.
 *
 * The order must belong to the authenticated user and have a payment record.
 */
router.get('/:id/invoice', async (req: AuthRequest, res: Response, next) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    const order = await prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        customerId: true,
        payment: { select: { id: true } },
      },
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.customerId !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (!order.payment) {
      return res.status(404).json({ error: 'Order has no payment record' });
    }

    const pdfBuffer = await generateInvoicePdf(id);
    const filename = getInvoiceFilename(id);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (err: unknown) {
    next(err);
  }
});

/** Provider / workspace pipeline: matched party, workspace-linked orders, or active inbox attempts. */
router.get('/provider/me', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const statusFilter = parseStatusArray(req.query);
    const phases = parsePhaseArray(req.query);
    const effectivePhases = phases.length ? phases : DEFAULT_PHASES;
    const page = parseIntDefault(pickQueryStr(req.query, 'page'), 1, 1, 1_000_000);
    const pageSize = parseIntDefault(pickQueryStr(req.query, 'pageSize'), 20, 1, 100);

    const workspaces = await listMyWorkspaces(userId);
    const workspaceIds = workspaces.map((w) => w.id);

    const attemptScope: Prisma.OrderWhereInput =
      workspaceIds.length > 0
        ? {
            matchAttempts: {
              some: {
                workspaceId: { in: workspaceIds },
                status: {
                  in: [MatchAttemptStatus.invited, MatchAttemptStatus.accepted, MatchAttemptStatus.matched],
                },
              },
            },
          }
        : { id: '__no_match__' };

    const providerParty: Prisma.OrderWhereInput = {
      OR: [
        { matchedProviderId: userId },
        ...(workspaceIds.length ? [{ matchedWorkspaceId: { in: workspaceIds } } as const] : []),
        attemptScope,
      ],
    };

    const andList: Prisma.OrderWhereInput[] = [providerParty, phaseListWhere(effectivePhases, false)];
    if (statusFilter.length) {
      andList.push({ status: { in: statusFilter } });
    }
    const where: Prisma.OrderWhereInput = andList.length > 1 ? { AND: andList } : andList[0]!;
    const whereFacetBase: Prisma.OrderWhereInput = providerParty;

    const skip = (page - 1) * pageSize;
    const [total, rows, facetsPhase] = await Promise.all([
      prisma.order.count({ where }),
      prisma.order.findMany({
        where,
        include: {
          serviceCatalog: { select: { id: true, name: true, categoryId: true } },
          matchedProvider: {
            select: { id: true, displayName: true, firstName: true, lastName: true, avatarUrl: true },
          },
          matchedWorkspace: { select: { id: true, name: true } },
          matchedPackage: {
            select: { id: true, name: true, finalPrice: true, currency: true, durationMinutes: true },
          },
          assignedStaff: {
            select: { id: true, displayName: true, firstName: true, lastName: true, avatarUrl: true },
          },
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: pageSize,
      }),
      countOrderPhaseFacets(whereFacetBase),
    ]);

    const uniqueCategoryIds = [...new Set(rows.map((r) => r.serviceCatalog.categoryId).filter(Boolean))] as string[];
    const crumbCache = new Map<string, Awaited<ReturnType<typeof categoryBreadcrumbs>>>();
    await Promise.all(
      uniqueCategoryIds.map(async (cid) => {
        crumbCache.set(cid, await categoryBreadcrumbs(cid, 5));
      }),
    );

    const items = await Promise.all(
      rows.map(async (r) => {
        const base = await orderToCustomerJson(r);
        const cid = r.serviceCatalog.categoryId;
        const breadcrumb = cid ? crumbCache.get(cid) ?? [] : [];
        return {
          ...base,
          serviceCatalog: {
            id: r.serviceCatalog.id,
            name: r.serviceCatalog.name,
            breadcrumb,
          },
          matchedSummary:
            r.matchedProvider && r.matchedWorkspace && r.matchedPackage
              ? {
                  provider: r.matchedProvider,
                  workspace: r.matchedWorkspace,
                  package: r.matchedPackage,
                }
              : null,
        };
      }),
    );

    res.json({
      items,
      total,
      page,
      pageSize,
      facets: { phase: facetsPhase },
    });
  } catch (err: unknown) {
    console.error(err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
  }
});

/** Matched provider / workspace staff marks the job complete. Only allowed from `in_progress` → `completed`. */
router.post('/:id/complete', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;
    const order = await prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        matchedWorkspaceId: true,
        matchedProviderId: true,
      },
    });
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    if (order.status !== OrderStatus.in_progress) {
      return res.status(400).json({
        error: 'Order must be in_progress before it can be marked complete',
      });
    }
    if (!order.matchedWorkspaceId) {
      return res.status(400).json({ error: 'Order has no matched workspace' });
    }
    let allowed = false;
    try {
      await assertWorkspaceMember(userId, order.matchedWorkspaceId);
      allowed = true;
    } catch (e) {
      if (!(e instanceof WorkspaceAccessError)) throw e;
    }
    if (!allowed && order.matchedProviderId !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await prisma.$transaction(async (tx) => {
      const completedAt = new Date();
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.completed,
          phase: phaseFromStatus(OrderStatus.completed),
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: 'ORDER_MARKED_COMPLETED',
          resourceType: 'order',
          resourceId: order.id,
          metadata: {} as Prisma.InputJsonValue,
        },
      });
      await tx.jobRecord.upsert({
        where: { orderId: order.id },
        create: {
          orderId: order.id,
          status: 'completed',
          completedAt,
        },
        update: {
          status: 'completed',
          completedAt,
        },
      });
    });

    // Release escrow payment (set 48h release timer) — non-fatal
    try {
      await releaseEscrowPayment(order.id);
    } catch (escrowErr) {
      console.error('Failed to release escrow payment:', escrowErr);
      // non-fatal — order is already marked completed
    }

    // Notify provider that escrow funds are released (non-fatal)
    try {
      const payment = await prisma.payment.findUnique({ where: { orderId: order.id } });
      if (payment) {
        await notifyEscrowReleased(order.id, payment.amount);
      }
    } catch (notifyErr) {
      console.error('Failed to notify escrow released:', notifyErr);
      // non-fatal
    }

    try {
      await publish('orders.completed', { orderId: order.id });
    } catch {
      /* NATS optional */
    }
    const updated = await prisma.order.findUnique({ where: { id: order.id } });
    if (!updated) {
      return res.status(500).json({ error: 'Order not found after update' });
    }
    res.json({ success: true, order: await orderToCustomerJson(updated) });
  } catch (err: unknown) {
    console.error(err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
  }
});

/** Assigned provider marks the job as started. Transitions `paid` → `in_progress`. */
router.post('/:id/start-job', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;
    const order = await prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        matchedWorkspaceId: true,
        matchedProviderId: true,
      },
    });
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    if (order.status !== OrderStatus.paid) {
      return res.status(400).json({
        error: 'Order must be paid before the job can be started',
      });
    }
    if (!order.matchedWorkspaceId) {
      return res.status(400).json({ error: 'Order has no matched workspace' });
    }
    let allowed = false;
    try {
      await assertWorkspaceMember(userId, order.matchedWorkspaceId);
      allowed = true;
    } catch (e) {
      if (!(e instanceof WorkspaceAccessError)) throw e;
    }
    if (!allowed && order.matchedProviderId !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // G8: Deduct BOM inventory before transitioning to in_progress
    const bomResult = await deductBomInventory(order.id);
    if (bomResult.errors.length > 0) {
      return res.status(409).json({
        error: 'Cannot start job — insufficient inventory for one or more BOM items',
        bomErrors: bomResult.errors,
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.in_progress,
          phase: phaseFromStatus(OrderStatus.in_progress),
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: 'ORDER_JOB_STARTED',
          resourceType: 'order',
          resourceId: order.id,
          metadata: {} as Prisma.InputJsonValue,
        },
      });
      await tx.jobRecord.upsert({
        where: { orderId: order.id },
        create: {
          orderId: order.id,
          status: 'in_progress',
          actualStartAt: new Date(),
        },
        update: {
          status: 'in_progress',
          actualStartAt: new Date(),
        },
      });
    });
    try {
      await publish('order.status.changed', { orderId: order.id, from: 'paid', to: 'in_progress' });
    } catch {
      /* NATS optional */
    }
    const updated = await prisma.order.findUnique({ where: { id: order.id } });
    if (!updated) {
      return res.status(500).json({ error: 'Order not found after update' });
    }
    res.json({ success: true, order: await orderToCustomerJson(updated) });
  } catch (err: unknown) {
    console.error(err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
  }
});

const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  review: z.string().max(500).optional(),
});

/** Customer submits rating + optional review; closes the order and emits `orders.reviewed`. */
router.post('/:id/review', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;
    const parsed = reviewSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Validation failed',
        errors: parsed.error.flatten().fieldErrors,
      });
    }
    const { rating, review: reviewInput } = parsed.data;
    let reviewText = (reviewInput ?? '').trim();
    if (reviewText.length === 0) reviewText = '';

    const order = await prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        customerId: true,
        status: true,
        phase: true,
        matchedWorkspaceId: true,
      },
    });
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    if (order.customerId !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (order.status !== OrderStatus.completed) {
      return res.status(400).json({
        error: 'Order must be in completed status (provider marked done) before you can submit a review',
      });
    }

    const existing = await prisma.orderReview.findUnique({ where: { orderId: id } });
    if (existing) {
      return res.status(409).json({ error: 'A review has already been submitted for this order' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.orderReview.create({
        data: {
          orderId: order.id,
          customerId: userId,
          rating,
          reviewText: reviewText.length ? reviewText : null,
        },
      });
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.closed,
          phase: phaseFromStatus(OrderStatus.closed, order.phase),
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: 'ORDER_CUSTOMER_REVIEWED',
          resourceType: 'order',
          resourceId: order.id,
          metadata: { rating } as Prisma.InputJsonValue,
        },
      });
    });

    // Recalculate trust score for the matched workspace (ADR-0069)
    if (order.matchedWorkspaceId) {
      try {
        await recalculateWorkspaceTrustScore(order.matchedWorkspaceId);
      } catch {
        // non-fatal
      }
    }

    try {
      await publish('orders.reviewed', { orderId: order.id, customerId: userId, rating });
    } catch {
      /* NATS optional */
    }

    const updated = await prisma.order.findUnique({
      where: { id: order.id },
      include: {
        matchedProvider: {
          select: { id: true, displayName: true, firstName: true, lastName: true, avatarUrl: true },
        },
        matchedWorkspace: { select: { id: true, name: true } },
        matchedPackage: {
          select: { id: true, name: true, finalPrice: true, currency: true, durationMinutes: true },
        },
        customerReview: true,
      },
    });
    if (!updated) {
      return res.status(500).json({ error: 'Order not found after update' });
    }
    const resolved = await resolveWizardSchema(updated);
    const payment = await getOrderPaymentSummary(updated.id);
    const base = await orderToCustomerJson(updated);
    res.json({
      ...base,
      schema: resolved.schema,
      staleSnapshot: resolved.staleSnapshot,
      payment,
      matchedSummary:
        updated.matchedProvider && updated.matchedWorkspace && updated.matchedPackage
          ? {
              provider: updated.matchedProvider,
              workspace: updated.matchedWorkspace,
              package: updated.matchedPackage,
            }
          : null,
      customerReview: updated.customerReview
        ? {
            rating: updated.customerReview.rating,
            reviewText: updated.customerReview.reviewText,
            createdAt: updated.customerReview.createdAt.toISOString(),
          }
        : null,
    });
  } catch (err: unknown) {
    console.error(err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
  }
});

/** Provider submits rating + optional review for customer; emits `orders.providerReviewed`. */
router.post('/:id/review-customer', async (req: AuthRequest, res: Response) => {
  try {
    const reviewerId = req.user!.userId;
    const { id } = req.params;
    const body = req.body as { rating?: unknown; review?: unknown };
    const ratingRaw = body.rating;
    const rating =
      typeof ratingRaw === 'number' && Number.isInteger(ratingRaw)
        ? ratingRaw
        : typeof ratingRaw === 'string' && ratingRaw.trim() !== ''
          ? Number.parseInt(ratingRaw, 10)
          : NaN;
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'rating must be an integer from 1 to 5' });
    }
    let reviewText = typeof body.review === 'string' ? body.review.trim() : '';
    if (reviewText.length > 500) {
      return res.status(400).json({ error: 'review must be at most 500 characters' });
    }
    if (reviewText.length === 0) reviewText = '';

    const order = await prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        customerId: true,
        matchedProviderId: true,
        matchedWorkspaceId: true,
        status: true,
        phase: true,
      },
    });
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    if (order.matchedProviderId !== reviewerId) {
      return res.status(403).json({ error: 'Only the matched provider can review the customer' });
    }
    if (order.status !== OrderStatus.completed) {
      return res.status(400).json({
        error: 'Order must be in completed status before you can submit a review',
      });
    }

    const existing = await prisma.orderReview.findFirst({
      where: { orderId: id, reviewType: 'provider' },
    });
    if (existing) {
      return res.status(409).json({ error: 'A provider review has already been submitted for this order' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.orderReview.create({
        data: {
          orderId: order.id,
          customerId: order.customerId,
          reviewerId,
          reviewType: 'provider',
          rating,
          reviewText: reviewText.length ? reviewText : null,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: reviewerId,
          action: 'ORDER_PROVIDER_REVIEWED',
          resourceType: 'order',
          resourceId: order.id,
          metadata: { rating, reviewedCustomerId: order.customerId } as Prisma.InputJsonValue,
        },
      });
    });

    // Recalculate trust score for the matched workspace (ADR-0069)
    if (order.matchedWorkspaceId) {
      try {
        await recalculateWorkspaceTrustScore(order.matchedWorkspaceId);
      } catch {
        // non-fatal
      }
    }

    try {
      await publish('orders.providerReviewed', { orderId: order.id, providerId: reviewerId, customerId: order.customerId, rating });
    } catch {
      /* NATS optional */
    }

    const review = await prisma.orderReview.findFirst({
      where: { orderId: id, reviewType: 'provider' },
    });

    res.json({
      data: review
        ? {
            id: review.id,
            orderId: review.orderId,
            customerId: review.customerId,
            rating: review.rating,
            reviewText: review.reviewText,
            reviewType: review.reviewType,
            createdAt: review.createdAt.toISOString(),
          }
        : null,
    });
  } catch (err: unknown) {
    console.error(err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
  }
});

/** F5 wizard Step 5: preview eligible providers before submit (draft orders only). */
router.get('/:id/matched-providers', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;
    const order = await prisma.order.findFirst({ where: { id, customerId: userId } });
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    if (order.status !== OrderStatus.draft) {
      return res.status(400).json({ error: 'Matched providers preview is only available for draft orders' });
    }
    const cat = await prisma.serviceCatalog.findUnique({
      where: { id: order.serviceCatalogId },
      select: { defaultMatchingMode: true },
    });
    const autoMatchEnabled = cat?.defaultMatchingMode === 'auto_book';
    const [autoList, negList] = await Promise.all([
      findEligiblePackagesForOffer(id),
      findEligibleNegotiationPackagesForOffer(id),
    ]);
    const bestByProvider = new Map<
      string,
      (typeof autoList)[number]
    >();
    for (const row of [...autoList, ...negList]) {
      const pid = row.package.providerId;
      const prev = bestByProvider.get(pid);
      if (!prev || row.score < prev.score) {
        bestByProvider.set(pid, row);
      }
    }
    const providerIds = [...bestByProvider.keys()];
    const stats =
      providerIds.length > 0
        ? await prisma.service.groupBy({
            by: ['providerId'],
            where: { providerId: { in: providerIds } },
            _avg: { rating: true },
            _sum: { reviewsCount: true },
          })
        : [];
    const statMap = new Map(
      stats.map((s) => [
        s.providerId,
        {
          rating: s._avg.rating ?? null,
          reviewsCount: s._sum.reviewsCount ?? 0,
        },
      ]),
    );
    function providerDisplayName(p: {
      displayName: string | null;
      firstName: string | null;
      lastName: string | null;
    }): string {
      if (p.displayName?.trim()) return p.displayName.trim();
      const n = `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim();
      return n || 'Provider';
    }
    const providers = [...bestByProvider.values()].map((row) => {
      const p = row.package.provider;
      const st = statMap.get(p.id);
      return {
        providerId: p.id,
        name: providerDisplayName(p),
        avatarUrl: p.avatarUrl ?? null,
        rating: st?.rating ?? null,
        reviewsCount: typeof st?.reviewsCount === 'number' ? st.reviewsCount : 0,
        distanceKm: row.distanceKm,
        packageId: row.package.id,
        packageName: row.package.name,
        workspaceName: row.package.workspace.name,
      };
    });
    providers.sort((a, b) => (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9));
    return res.json({
      autoMatchEnabled,
      manualSelectionAvailable: !autoMatchEnabled && providers.length > 0,
      providers,
    });
  } catch (err: unknown) {
    console.error(err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
  }
});

router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const role = req.user!.role;
    const { id } = req.params;
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        jobRecord: true,
        matchedProvider: {
          select: { id: true, displayName: true, firstName: true, lastName: true, avatarUrl: true },
        },
        matchedWorkspace: { select: { id: true, name: true } },
        matchedPackage: {
          select: { id: true, name: true, finalPrice: true, currency: true, durationMinutes: true },
        },
        assignedStaff: {
          select: { id: true, displayName: true, firstName: true, lastName: true, avatarUrl: true },
        },
        customerReview: true,
        orderContract: {
          select: {
            id: true,
            currentVersion: { select: { id: true, status: true } },
          },
        },
      },
    });
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    if (order.customerId !== userId && !canViewOrderAsStaff(role)) {
      const matchedParty = await canViewOrderAsMatchedParty(userId, order);
      if (!matchedParty) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }
    const resolved = await resolveWizardSchema(order);
    const payment = await getOrderPaymentSummary(order.id);
    const base = await orderToCustomerJson(order);
    res.json({
      ...withOrderTraceIds(base, order),
      schema: resolved.schema,
      staleSnapshot: resolved.staleSnapshot,
      payment,
      matchedSummary:
        order.matchedProvider && order.matchedWorkspace && order.matchedPackage
          ? {
              provider: order.matchedProvider,
              workspace: order.matchedWorkspace,
              package: order.matchedPackage,
            }
          : null,
      customerReview: order.customerReview
        ? {
            rating: order.customerReview.rating,
            reviewText: order.customerReview.reviewText,
            createdAt: order.customerReview.createdAt.toISOString(),
          }
        : null,
      customerContract: order.orderContract
        ? {
            id: order.orderContract.id,
            currentVersion: order.orderContract.currentVersion
              ? {
                  id: order.orderContract.currentVersion.id,
                  status: order.orderContract.currentVersion.status,
                }
              : null,
          }
        : null,
    });
  } catch (err: unknown) {
    console.error(err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
  }
});

router.get('/:id/candidates', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;
    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.customerId !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    await expireStaleAttempts(id);

    const fresh = await prisma.order.findUnique({ where: { id } });
    if (!fresh) return res.status(404).json({ error: 'Order not found' });
    const nowMs = Date.now();
    const windowMs = fresh.matchingExpiresAt?.getTime() ?? null;
    const secondsRemaining = windowMs == null ? null : Math.max(0, Math.floor((windowMs - nowMs) / 1000));

    if (fresh.status === OrderStatus.draft || fresh.status !== OrderStatus.matching) {
      return res.json({
        windowExpiresAt: fresh.matchingExpiresAt?.toISOString() ?? null,
        secondsRemaining,
        candidates: [],
      });
    }

    const rows = await prisma.offerMatchAttempt.findMany({
      where: { offerId: id, status: MatchAttemptStatus.accepted },
      orderBy: [{ score: 'asc' }, { respondedAt: 'asc' }],
      include: {
        provider: { select: { id: true, displayName: true, firstName: true, lastName: true, avatarUrl: true } },
        workspace: { select: { id: true, name: true, logoUrl: true } },
        package: {
          select: {
            id: true,
            name: true,
            finalPrice: true,
            currency: true,
            durationMinutes: true,
            serviceCatalog: { select: { id: true, name: true } },
          },
        },
      },
    });
    const providerIds = [...new Set(rows.map((r) => r.providerId))];
    const ratingGroups =
      providerIds.length > 0
        ? await prisma.service.groupBy({
            by: ['providerId'],
            where: { providerId: { in: providerIds } },
            _avg: { rating: true },
          })
        : [];
    const ratingByProvider = new Map(ratingGroups.map((g) => [g.providerId, g._avg.rating ?? 0]));

    function providerDisplayName(p: {
      displayName: string | null;
      firstName: string | null;
      lastName: string | null;
    }): string {
      if (p.displayName?.trim()) return p.displayName.trim();
      const n = `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim();
      return n || 'Provider';
    }

    return res.json({
      windowExpiresAt: fresh.matchingExpiresAt?.toISOString() ?? null,
      secondsRemaining,
      candidates: rows.map((a) => ({
        attemptId: a.id,
        providerId: a.providerId,
        providerName: providerDisplayName(a.provider),
        providerAvatarUrl: a.provider.avatarUrl ?? null,
        providerRating: ratingByProvider.get(a.providerId) ?? null,
        workspaceId: a.workspaceId,
        workspaceName: a.workspace.name,
        workspaceLogoUrl: a.workspace.logoUrl ?? null,
        packageId: a.packageId,
        packageName: a.package.name,
        packageFinalPrice: a.package.finalPrice,
        packageCurrency: a.package.currency,
        packageDuration: a.package.durationMinutes,
        distanceKm: a.distanceKm,
        score: a.score,
        respondedAt: a.respondedAt?.toISOString() ?? null,
      })),
    });
  } catch (err: unknown) {
    console.error(err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
  }
});

router.post('/:id/select-provider', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;
    const body = req.body as Record<string, unknown>;
    const attemptId = typeof body.attemptId === 'string' ? body.attemptId : '';
    const savePriorityTemplate = body.savePriorityTemplate === true;
    const priorityTemplate =
      body.priorityTemplate && typeof body.priorityTemplate === 'object'
        ? (body.priorityTemplate as Record<string, unknown>)
        : null;
    if (!attemptId) return res.status(400).json({ error: 'attemptId is required' });

    await expireStaleAttempts(id);
    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.customerId !== userId) return res.status(403).json({ error: 'Forbidden' });
    if (order.status !== OrderStatus.matching) {
      return res.status(400).json({ error: 'Order is not in matching status' });
    }
    const chosen = await prisma.offerMatchAttempt.findUnique({ where: { id: attemptId } });
    if (!chosen || chosen.offerId !== id || chosen.status !== MatchAttemptStatus.accepted) {
      return res.status(400).json({ error: 'Chosen attempt must be an accepted candidate for this order' });
    }

    const now = new Date();
    const supersededAttemptIds = await prisma.$transaction(async (tx) => {
      const toSupersede = await tx.offerMatchAttempt.findMany({
        where: {
          offerId: id,
          id: { not: chosen.id },
          status: { in: [MatchAttemptStatus.accepted, MatchAttemptStatus.invited] },
        },
        select: { id: true },
      });
      const ids = toSupersede.map((r) => r.id);
      await tx.offerMatchAttempt.update({
        where: { id: chosen.id },
        data: { status: MatchAttemptStatus.matched, matchedAt: now },
      });
      await tx.offerMatchAttempt.updateMany({
        where: {
          offerId: id,
          id: { not: chosen.id },
          status: { in: [MatchAttemptStatus.accepted, MatchAttemptStatus.invited] },
        },
        data: { status: MatchAttemptStatus.superseded, supersededAt: now },
      });
      await tx.order.update({
        where: { id },
        data: {
          matchedPackageId: chosen.packageId,
          matchedProviderId: chosen.providerId,
          matchedWorkspaceId: chosen.workspaceId,
          status: OrderStatus.contracted,
          phase: phaseFromStatus(OrderStatus.contracted),
          matchingExpiresAt: null,
        },
      });
      await tx.jobRecord.upsert({
        where: { orderId: id },
        create: {
          orderId: id,
          status: 'scheduled',
          scheduledStartAt: order.scheduledAt ?? null,
        },
        update: {
          status: 'scheduled',
          scheduledStartAt: order.scheduledAt ?? null,
        },
      });
      if (savePriorityTemplate && priorityTemplate) {
        await tx.user.update({
          where: { id: userId },
          data: {
            orderPriorities: {
              ...(priorityTemplate as Prisma.InputJsonValue as object),
              savedAt: now.toISOString(),
            } as Prisma.InputJsonValue,
          },
        });
      }
      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: 'ORDER_CUSTOMER_SELECTED_PROVIDER',
          resourceType: 'order',
          resourceId: id,
          metadata: {
            attemptId: chosen.id,
            packageId: chosen.packageId,
            providerId: chosen.providerId,
            workspaceId: chosen.workspaceId,
            supersededAttemptIds: ids,
          } as Prisma.InputJsonValue,
        },
      });
      return ids;
    });
    await publish('orders.customer_selected_provider', {
      orderId: id,
      attemptId: chosen.id,
      supersededAttemptIds,
    });
    const updatedOrder = await prisma.order.findUnique({ where: { id } });
    if (!updatedOrder) {
      return res.status(500).json({ error: 'Order not found after selection' });
    }
    res.json({
      order: await orderToCustomerJson(updatedOrder),
      supersededCount: supersededAttemptIds.length,
    });
  } catch (err: unknown) {
    console.error(err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
  }
});


/** Provider accepts or declines a round-robin invitation for an order in matching status. */
router.post('/:id/accept-invite', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const body = req.body as Record<string, unknown>;
    const userId = req.user!.userId;
    const accepted = body.accepted === true;
    const declineReason = typeof body.declineReason === 'string' ? body.declineReason : undefined;

    if (!accepted && !declineReason) {
      return res.status(400).json({ error: 'declineReason is required when declining an invitation' });
    }
    if (declineReason && declineReason.length < 5) {
      return res.status(400).json({ error: 'declineReason must be at least 5 characters' });
    }

    const order = await prisma.order.findUnique({
      where: { id },
      select: { id: true, status: true, customerId: true },
    });
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    if (order.status !== OrderStatus.matching) {
      return res.status(400).json({ error: 'Order is not in matching status' });
    }

    await expireStaleAttempts(id);

    const attempt = await prisma.offerMatchAttempt.findFirst({
      where: {
        offerId: id,
        providerId: userId,
        status: MatchAttemptStatus.invited,
      },
      include: {
        package: {
          select: { providerId: true },
        },
      },
    });
    if (!attempt) {
      return res.status(404).json({ error: 'No active invitation found for this provider on this order' });
    }

    const now = new Date();

    if (accepted) {
      await prisma.$transaction(async (tx) => {
        await tx.offerMatchAttempt.update({
          where: { id: attempt.id },
          data: {
            status: MatchAttemptStatus.accepted,
            respondedAt: now,
          },
        });

        await tx.auditLog.create({
          data: {
            actorId: userId,
            action: 'ORDER_PROVIDER_ACCEPTED_INVITE',
            resourceType: 'order',
            resourceId: id,
            metadata: { attemptId: attempt.id, packageId: attempt.packageId } as Prisma.InputJsonValue,
          },
        });
      });

      try {
        await publish('orders.invite_accepted', {
          orderId: id,
          providerId: userId,
          attemptId: attempt.id,
          customerId: order.customerId,
        });
      } catch {
        /* NATS optional */
      }

      res.json({
        success: true,
        message: 'Invitation accepted. Your offer is now visible to the customer.',
        attemptId: attempt.id,
      });
    } else {
      await prisma.$transaction(async (tx) => {
        await tx.offerMatchAttempt.update({
          where: { id: attempt.id },
          data: {
            status: MatchAttemptStatus.declined,
            respondedAt: now,
            declineReason: declineReason ?? null,
          },
        });

        await tx.auditLog.create({
          data: {
            actorId: userId,
            action: 'ORDER_PROVIDER_DECLINED_INVITE',
            resourceType: 'order',
            resourceId: id,
            metadata: {
              attemptId: attempt.id,
              packageId: attempt.packageId,
              declineReason: declineReason ?? null,
            } as Prisma.InputJsonValue,
          },
        });
      });

      try {
        await expireStaleAttempts(id);
      } catch {
        /* best-effort */
      }

      try {
        await publish('orders.invite_declined', {
          orderId: id,
          providerId: userId,
          attemptId: attempt.id,
          declineReason: declineReason ?? null,
        });
      } catch {
        /* NATS optional */
      }

      res.json({
        success: true,
        message: 'Invitation declined.',
        attemptId: attempt.id,
      });
    }
  } catch (err: unknown) {
    console.error(err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
  }
});

router.post('/:id/dispute', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;
    const reason = pickStr((req.body as Record<string, unknown>)?.reason);
    if (!reason || reason.length < 20) {
      return res.status(400).json({ error: 'reason must be at least 20 characters' });
    }
    const order = await prisma.order.findFirst({ where: { id, customerId: userId } });
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    if (order.status !== OrderStatus.completed) {
      return res.status(400).json({ error: 'Disputes can only be opened after the job is marked complete' });
    }
    const existing = await prisma.dispute.findUnique({ where: { orderId: id } });
    if (existing) {
      return res.status(409).json({ error: 'A dispute already exists for this order' });
    }
    const updated = await prisma.$transaction(async (tx) => {
      await tx.dispute.create({
        data: {
          orderId: id,
          customerId: userId,
          reason,
        },
      });
      const o = await tx.order.update({
        where: { id },
        data: {
          status: OrderStatus.disputed,
          phase: phaseFromStatus(OrderStatus.disputed, order.phase),
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: 'ORDER_DISPUTED',
          resourceType: 'order',
          resourceId: id,
          metadata: { reason } as Prisma.InputJsonValue,
        },
      });
      return o;
    });
    try {
      await publish('order.disputed', {
        orderId: id,
        customerId: userId,
        reason,
      });
    } catch {
      /* NATS optional */
    }
    res.json(await orderToCustomerJson(updated));
  } catch (err: unknown) {
    console.error(err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
  }
});

router.post('/:id/cancel', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;
    const reason = pickStr((req.body as Record<string, unknown>)?.reason);
    if (!reason || reason.length < 5) {
      return res.status(400).json({ error: 'reason must be at least 5 characters' });
    }
    const order = await prisma.order.findFirst({
      where: { id, customerId: userId },
      include: {
        matchedPackage: { select: { finalPrice: true, currency: true } },
        orderContract: {
          include: {
            currentVersion: { select: { id: true, status: true, amount: true, currency: true } },
          },
        },
      },
    });
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    if (
      order.status !== OrderStatus.draft &&
      order.status !== OrderStatus.submitted &&
      order.status !== OrderStatus.matching &&
      order.status !== OrderStatus.matched &&
      order.status !== OrderStatus.contracted &&
      order.status !== OrderStatus.paid
    ) {
      return res.status(400).json({ error: 'Order cannot be cancelled in its current state' });
    }
    const now = new Date();
    const updated = await prisma.$transaction(async (tx) => {
      // --- paid: create a refund transaction ---
      if (order.status === OrderStatus.paid) {
        const contractVersion = order.orderContract?.currentVersion;
        const refundAmount = contractVersion?.amount ?? order.matchedPackage?.finalPrice ?? 0;
        const refundCurrency = contractVersion?.currency ?? 'CAD';
        await tx.transaction.create({
          data: {
            customerId: userId,
            type: 'outcome',
            amount: refundAmount,
            category: 'order_payment_refund',
            description: `Refund for cancelled order:${id} currency:${refundCurrency}`,
            timestamp: now,
          },
        });

        // Refund escrow payment if captured (non-fatal)
        try {
          await refundEscrowPayment(id);
        } catch (escrowErr) {
          console.error('Failed to refund escrow payment:', escrowErr);
          // non-fatal — refund transaction is already created
        }

        // Notify customer of refund (non-fatal)
        try {
          await notifyPaymentRefunded(id, refundAmount, reason);
        } catch (notifyErr) {
          console.error('Failed to notify payment refunded:', notifyErr);
          // non-fatal
        }
      }

      // --- contracted: void the contract by superseding current version ---
      if (order.status === OrderStatus.contracted && order.orderContract?.currentVersion) {
        const shell = order.orderContract;
        const currentVersion = shell.currentVersion!;
        await tx.contractVersion.update({
          where: { id: currentVersion.id },
          data: { status: ContractVersionStatus.superseded },
        });
        await tx.orderContract.update({
          where: { id: shell.id },
          data: { currentVersionId: null },
        });
      }

      // --- matched: clear matched references ---
      let clearMatchedFields: Record<string, null> = {};
      if (order.status === OrderStatus.matched) {
        clearMatchedFields = {
          matchedPackageId: null,
          matchedProviderId: null,
          matchedWorkspaceId: null,
        };
      }

      const o = await tx.order.update({
        where: { id },
        data: {
          status: OrderStatus.cancelled,
          phase: phaseFromStatus(OrderStatus.cancelled, order.phase),
          cancelReason: reason,
          cancelledAt: now,
          ...clearMatchedFields,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: 'ORDER_CANCELLED',
          resourceType: 'order',
          resourceId: id,
          metadata: { reason, previousStatus: order.status } as Prisma.InputJsonValue,
        },
      });
      return o;
    });

    // G8: Restore BOM inventory after cancellation (best-effort, non-fatal)
    try {
      await restoreBomInventory(id);
    } catch (bomErr) {
      console.error('[OrderBom] Failed to restore inventory on cancel:', bomErr);
    }

    // Emit NATS event
    await publish('order.cancelled', { orderId: id, previousStatus: order.status, reason });

    // Release the reserved slot if the order had a matched provider (G1/G15)
    if (
      order.matchedProviderId &&
      order.scheduledAt &&
      (order.status === OrderStatus.matched ||
        order.status === OrderStatus.contracted ||
        order.status === OrderStatus.paid)
    ) {
      try {
        await releaseProviderSlot(order.matchedProviderId, order.scheduledAt);
      } catch {
        // non-fatal — slot release is best-effort
      }
    }

    // Notify via lifecycle notifications
    try {
      const { notifyCustomerOrderCancelled } = await import('../lib/orderLifecycleNotifications.js');
      await notifyCustomerOrderCancelled({ orderId: id, reason });
    } catch {
      // non-fatal
    }

    res.json(await orderToCustomerJson(updated));
  } catch (err: unknown) {
    console.error(err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
  }
});

// PUT /api/orders/:id/assign-staff — Assign staff to order (provider/workspace admin only)
router.put('/:id/assign-staff', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;
    const { staffId } = req.body as { staffId?: string };

    if (!staffId || typeof staffId !== 'string') {
      return res.status(400).json({ error: 'staffId is required' });
    }

    const order = await prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        matchedWorkspaceId: true,
        matchedProviderId: true,
        status: true,
      },
    });
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Only allow assignment on submitted/matching/matched/contracted orders
    const allowedStatuses: OrderStatus[] = [
      OrderStatus.submitted,
      OrderStatus.matching,
      OrderStatus.matched,
      OrderStatus.contracted,
    ];
    if (!allowedStatuses.includes(order.status)) {
      return res.status(400).json({ error: 'Staff can only be assigned to active orders' });
    }

    // Validate: user must be a member of the matched workspace
    if (!order.matchedWorkspaceId) {
      return res.status(400).json({ error: 'Order has no matched workspace' });
    }
    try {
      await assertWorkspaceMember(userId, order.matchedWorkspaceId);
    } catch (e) {
      if (e instanceof WorkspaceAccessError) {
        return res.status(403).json({ error: 'Forbidden: not a workspace member' });
      }
      throw e;
    }

    // Validate: staffId must be a member of the same workspace
    const staffMember = await prisma.companyUser.findUnique({
      where: {
        companyId_userId: { companyId: order.matchedWorkspaceId, userId: staffId },
      },
      include: {
        user: { select: { id: true, avatarUrl: true, displayName: true } },
      },
    });
    if (!staffMember) {
      return res.status(400).json({ error: 'Staff member not found in this workspace' });
    }

    // Validate: staff must have avatarUrl
    if (!staffMember.user.avatarUrl) {
      return res.status(400).json({
        error: 'Staff member must have a profile photo before being assigned.',
        code: 'STAFF_PHOTO_REQUIRED',
      });
    }

    const updated = await prisma.order.update({
      where: { id },
      data: { assignedStaffId: staffId },
    });

    res.json({
      success: true,
      assignedStaff: {
        id: staffMember.user.id,
        displayName: staffMember.user.displayName,
        avatarUrl: staffMember.user.avatarUrl,
      },
    });
  } catch (err: unknown) {
    console.error(err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
  }
});

// POST /orders/:id/reorder — Reorder a previous order (customer only)
router.post('/:id/reorder', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    // Validate optional request body
    const body = reorderSchema.parse(req.body ?? {});

    // Fetch original order
    const original = await prisma.order.findUnique({ where: { id } });
    if (!original) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Verify authenticated user is the customer of the original order
    if (original.customerId !== userId) {
      return res.status(403).json({ error: 'Forbidden: you are not the customer of this order' });
    }

    // Verify original order has a matched provider
    if (!original.matchedProviderId) {
      return res.status(400).json({ error: 'Original order was never matched with a provider' });
    }

    const order = await prisma.order.create({
      data: {
        customerId: userId,
        serviceCatalogId: original.serviceCatalogId,
        matchedProviderId: original.matchedProviderId,
        matchedWorkspaceId: original.matchedWorkspaceId,
        matchedPackageId: original.matchedPackageId,
        description: body.description ?? original.description,
        budget: original.budget,
        budgetMin: original.budgetMin,
        budgetMax: original.budgetMax,
        address: body.addressId ?? original.address,
        locationLat: original.locationLat,
        locationLng: original.locationLng,
        scheduleFlexibility: original.scheduleFlexibility,
        entryPoint: OrderEntryPoint.reorder,
        originalOrderId: original.id,
        status: OrderStatus.draft,
        scheduledAt: body.scheduledAt !== undefined ? new Date(body.scheduledAt) : undefined,
        urgency: body.urgency,
        schemaSnapshot: original.schemaSnapshot,
        answers: original.answers,
        photos: original.photos,
      },
    });

    res.status(201).json({ data: order });
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.issues });
    }
    console.error(err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
  }
});

export default router;
