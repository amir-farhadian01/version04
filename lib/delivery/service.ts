import {
  Prisma,
  type BusinessDriver,
  type DeliveryAssignmentStatus,
  type FulfillmentStatus,
  type PrismaClient,
} from '@prisma/client';
import { publish } from '../bus.js';
import { effectiveAvailability } from './availability.js';
import {
  assertActivePrincipal,
  assertDeliveryEnabled,
  assertDriverSelf,
  assertWorkspaceManager,
} from './authorization.js';
import { DeliveryError, notFound, versionConflict } from './errors.js';
import { serializeAddresses } from './privacy.js';
import { resolveDeliveryProvider } from './providerRegistry.js';
import {
  assignmentStatusForFulfillment,
  lifecycleTimestampFor,
  terminalFulfillmentStatuses,
  transitionFulfillment,
  type DriverTransitionAction,
} from './stateMachine.js';
import { withSerializableRetry } from './transactions.js';
import {
  addressSnapshotSchema,
  compensationTermsSchema,
  type availabilitySchema,
} from './validation.js';
import type { z } from 'zod';

type AvailabilityInput = z.infer<typeof availabilitySchema>;
type Tx = Prisma.TransactionClient;

const nonterminalStatuses: FulfillmentStatus[] = [
  'unassigned', 'assigned', 'accepted', 'picked_up', 'in_transit',
];

function transactionView(prisma: PrismaClient): Tx {
  return prisma as unknown as Tx;
}

async function writeAudit(
  tx: Tx,
  actorId: string,
  action: string,
  resourceType: string,
  resourceId: string,
  metadata: Record<string, unknown>,
) {
  await tx.auditLog.create({
    data: { actorId, action, resourceType, resourceId, metadata: metadata as Prisma.InputJsonValue },
  });
}

async function notify(tx: Tx, userId: string, title: string, message: string) {
  await tx.notification.create({
    data: { userId, title, message, type: 'delivery', link: '/driver/deliveries' },
  });
}

async function emit(subject: string, data: Record<string, unknown>) {
  await publish(subject, data);
}

const assignmentInclude = {
  businessDriver: {
    include: {
      user: { select: { id: true, displayName: true, firstName: true, lastName: true, avatarUrl: true } },
    },
  },
  compensationTerm: true,
} satisfies Prisma.DeliveryAssignmentInclude;

const fulfillmentInclude = {
  order: { select: { id: true, status: true, description: true, serviceCatalog: { select: { id: true, name: true, category: true } } } },
  currentAssignment: { include: assignmentInclude },
  assignments: { include: assignmentInclude, orderBy: { createdAt: 'asc' as const } },
} satisfies Prisma.FulfillmentInclude;

export class DeliveryService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async getCapability(userId: string, workspaceId: string) {
    const workspace = await assertWorkspaceManager(transactionView(this.prisma), userId, workspaceId);
    return { enabled: workspace.deliveryOperationsEnabled, canManage: true };
  }

  async listCandidates(userId: string, workspaceId: string) {
    const db = transactionView(this.prisma);
    const workspace = await assertWorkspaceManager(db, userId, workspaceId);
    assertDeliveryEnabled(workspace);
    const company = await db.company.findUnique({
      where: { id: workspaceId },
      select: {
        owner: { select: { id: true, displayName: true, firstName: true, lastName: true, avatarUrl: true, status: true } },
        members: {
          select: { user: { select: { id: true, displayName: true, firstName: true, lastName: true, avatarUrl: true, status: true } } },
        },
      },
    });
    if (!company) throw notFound('Workspace not found');
    const principals = new Map([company.owner, ...company.members.map((member) => member.user)].map((item) => [item.id, item]));
    const existing = await db.businessDriver.findMany({ where: { companyId: workspaceId }, select: { userId: true, id: true, status: true } });
    const driverByUser = new Map(existing.map((item) => [item.userId, item]));
    const approved = await db.kycPersonalSubmission.findMany({
      where: { userId: { in: [...principals.keys()] }, status: 'approved' },
      select: { userId: true },
      distinct: ['userId'],
    });
    const approvedIds = new Set(approved.map((item) => item.userId));
    return [...principals.values()].map((principal) => ({
      id: principal.id,
      displayName: principal.displayName,
      firstName: principal.firstName,
      lastName: principal.lastName,
      avatarUrl: principal.avatarUrl,
      active: principal.status === 'active',
      hasProfilePhoto: Boolean(principal.avatarUrl),
      personalKycApproved: approvedIds.has(principal.id),
      relationship: driverByUser.get(principal.id) ?? null,
    }));
  }

  async listDrivers(userId: string, workspaceId: string) {
    const db = transactionView(this.prisma);
    const workspace = await assertWorkspaceManager(db, userId, workspaceId);
    assertDeliveryEnabled(workspace);
    const drivers = await db.businessDriver.findMany({
      where: { companyId: workspaceId, archivedAt: null },
      include: {
        user: { select: { id: true, displayName: true, firstName: true, lastName: true, avatarUrl: true, status: true } },
        currentAcceptedTerm: true,
      },
      orderBy: { createdAt: 'asc' },
    });
    return Promise.all(drivers.map((driver) => this.withEffectiveAvailability(db, driver)));
  }

  async createDriver(userId: string, workspaceId: string, input: {
    userId: string;
    engagementType: 'hourly' | 'long_term';
    availabilityMode: 'on_demand' | 'scheduled';
  }) {
    const result = await withSerializableRetry(this.prisma, async (tx) => {
      const workspace = await assertWorkspaceManager(tx, userId, workspaceId);
      assertDeliveryEnabled(workspace);
      const [candidate, membership] = await Promise.all([
        tx.user.findUnique({ where: { id: input.userId }, select: { id: true } }),
        tx.companyUser.findUnique({ where: { companyId_userId: { companyId: workspaceId, userId: input.userId } }, select: { userId: true } }),
      ]);
      if (!candidate || (workspace.ownerId !== input.userId && !membership)) throw notFound('Driver candidate not found');

      const driver = await tx.businessDriver.create({
        data: {
          companyId: workspaceId,
          userId: input.userId,
          engagementType: input.engagementType,
          availabilityMode: input.availabilityMode,
        },
      });
      await notify(tx, input.userId, 'Driver invitation', `${workspace.name} invited you to its delivery operations.`);
      await writeAudit(tx, userId, 'driver.invited', 'BusinessDriver', driver.id, {
        workspaceId, driverUserId: input.userId, engagementType: input.engagementType, version: driver.version,
      });
      return driver;
    });
    await emit('driver.invited', { businessDriverId: result.id, workspaceId, actorId: userId, timestamp: this.clock().toISOString() });
    return result;
  }

  async changeDriverLifecycle(userId: string, workspaceId: string, driverId: string, input: {
    action: 'pause' | 'resume' | 'end' | 'reinvite'; expectedVersion: number;
  }) {
    const now = this.clock();
    const result = await withSerializableRetry(this.prisma, async (tx) => {
      const workspace = await assertWorkspaceManager(tx, userId, workspaceId);
      assertDeliveryEnabled(workspace);
      const driver = await tx.businessDriver.findFirst({ where: { id: driverId, companyId: workspaceId, archivedAt: null } });
      if (!driver) throw notFound();
      if (driver.version !== input.expectedVersion) throw versionConflict();

      const targets = {
        pause: { from: ['active'], status: 'paused', data: { pausedAt: now } },
        resume: { from: ['paused'], status: 'active', data: { activatedAt: now, pausedAt: null } },
        end: { from: ['invited', 'active', 'paused'], status: 'ended', data: { endedAt: now, presence: 'offline' } },
        reinvite: { from: ['declined', 'ended'], status: 'invited', data: { invitedAt: now, respondedAt: null, declinedAt: null, endedAt: null, presence: 'offline' } },
      } as const;
      const target = targets[input.action];
      if (!(target.from as readonly string[]).includes(driver.status)) {
        throw new DeliveryError('INVALID_STATE', 409, `Cannot ${input.action} a ${driver.status} driver relationship`);
      }
      if (input.action === 'pause' || input.action === 'end') {
        const liveWork = await tx.deliveryAssignment.count({
          where: {
            businessDriverId: driver.id,
            status: { in: ['offered', 'accepted'] },
            fulfillment: { status: { in: ['assigned', 'accepted', 'picked_up', 'in_transit'] } },
          },
        });
        if (liveWork > 0) {
          throw new DeliveryError('INVALID_STATE', 409, 'Driver relationship has active delivery work');
        }
      }
      const updated = await tx.businessDriver.updateMany({
        where: { id: driver.id, version: input.expectedVersion },
        data: { ...target.data, status: target.status, version: { increment: 1 } },
      });
      if (updated.count !== 1) throw versionConflict();
      await writeAudit(tx, userId, `driver.${input.action}`, 'BusinessDriver', driver.id, {
        workspaceId, from: driver.status, to: target.status, version: input.expectedVersion + 1,
      });
      return tx.businessDriver.findUniqueOrThrow({ where: { id: driver.id } });
    });
    await emit(`driver.${input.action}`, { businessDriverId: result.id, workspaceId, actorId: userId, version: result.version, timestamp: now.toISOString() });
    return result;
  }

  async listTermsForManager(userId: string, workspaceId: string, driverId: string) {
    const db = transactionView(this.prisma);
    const workspace = await assertWorkspaceManager(db, userId, workspaceId);
    assertDeliveryEnabled(workspace);
    const driver = await db.businessDriver.findFirst({ where: { id: driverId, companyId: workspaceId, archivedAt: null }, select: { id: true } });
    if (!driver) throw notFound();
    return db.driverCompensationTermVersion.findMany({ where: { businessDriverId: driverId }, orderBy: { versionNumber: 'desc' } });
  }

  async proposeTerms(userId: string, workspaceId: string, driverId: string, rawInput: unknown) {
    const input = compensationTermsSchema.parse(rawInput);
    const now = this.clock();
    const result = await withSerializableRetry(this.prisma, async (tx) => {
      const workspace = await assertWorkspaceManager(tx, userId, workspaceId);
      assertDeliveryEnabled(workspace);
      const driver = await tx.businessDriver.findFirst({ where: { id: driverId, companyId: workspaceId, archivedAt: null } });
      if (!driver) throw notFound();
      if (['declined', 'ended'].includes(driver.status)) throw new DeliveryError('INVALID_STATE', 409, 'Cannot propose terms for this relationship');
      const latest = await tx.driverCompensationTermVersion.findFirst({
        where: { businessDriverId: driver.id }, orderBy: { versionNumber: 'desc' }, select: { versionNumber: true },
      });
      await tx.driverCompensationTermVersion.updateMany({
        where: { businessDriverId: driver.id, status: 'proposed' },
        data: { status: 'superseded', supersededAt: now },
      });
      const term = await tx.driverCompensationTermVersion.create({
        data: {
          businessDriverId: driver.id,
          versionNumber: (latest?.versionNumber ?? 0) + 1,
          schemaVersion: input.schemaVersion,
          currency: input.currency,
          components: input.components as Prisma.InputJsonValue,
          proposedById: userId,
          proposedAt: now,
        },
      });
      await notify(tx, driver.userId, 'Compensation terms', `${workspace.name} proposed driver compensation terms for your review.`);
      await writeAudit(tx, userId, 'driver.terms_proposed', 'DriverCompensationTermVersion', term.id, {
        workspaceId, businessDriverId: driver.id, termVersion: term.versionNumber,
      });
      return term;
    });
    await emit('driver.terms_proposed', { termId: result.id, businessDriverId: driverId, workspaceId, actorId: userId, timestamp: now.toISOString() });
    return result;
  }

  async listRelationships(userId: string) {
    const db = transactionView(this.prisma);
    const rows = await db.businessDriver.findMany({
      where: { userId, archivedAt: null, company: { deliveryOperationsEnabled: true } },
      include: { company: { select: { id: true, name: true, logoUrl: true } }, currentAcceptedTerm: true, terms: { orderBy: { versionNumber: 'desc' } } },
      orderBy: { createdAt: 'desc' },
    });
    return Promise.all(rows.map((row) => this.withEffectiveAvailability(db, row)));
  }

  async respondRelationship(userId: string, driverId: string, input: { action: 'accept' | 'decline'; expectedVersion: number }) {
    const now = this.clock();
    const result = await withSerializableRetry(this.prisma, async (tx) => {
      const driver = await assertDriverSelf(tx, userId, driverId);
      if (driver.version !== input.expectedVersion) throw versionConflict();
      if (driver.status !== 'invited') throw new DeliveryError('INVALID_STATE', 409, 'Only an invitation can be answered');
      const status = input.action === 'accept' ? 'active' : 'declined';
      const update = await tx.businessDriver.updateMany({
        where: { id: driver.id, userId, version: input.expectedVersion, status: 'invited' },
        data: {
          status,
          respondedAt: now,
          activatedAt: input.action === 'accept' ? now : null,
          declinedAt: input.action === 'decline' ? now : null,
          version: { increment: 1 },
        },
      });
      if (update.count !== 1) throw versionConflict();
      await writeAudit(tx, userId, `driver.invitation_${input.action}ed`, 'BusinessDriver', driver.id, {
        workspaceId: driver.companyId, from: 'invited', to: status, version: input.expectedVersion + 1,
      });
      return tx.businessDriver.findUniqueOrThrow({ where: { id: driver.id } });
    });
    await emit(`driver.invitation_${input.action}ed`, { businessDriverId: result.id, workspaceId: result.companyId, actorId: userId, version: result.version, timestamp: now.toISOString() });
    return result;
  }

  async respondTerms(userId: string, driverId: string, termId: string, input: {
    action: 'accept' | 'reject'; expectedDriverVersion: number;
  }) {
    const now = this.clock();
    const result = await withSerializableRetry(this.prisma, async (tx) => {
      const driver = await assertDriverSelf(tx, userId, driverId);
      if (driver.version !== input.expectedDriverVersion) throw versionConflict();
      const term = await tx.driverCompensationTermVersion.findFirst({ where: { id: termId, businessDriverId: driver.id } });
      if (!term) throw notFound();
      if (term.status !== 'proposed') throw new DeliveryError('INVALID_STATE', 409, 'Only proposed terms can be answered');

      const driverUpdate = await tx.businessDriver.updateMany({
        where: { id: driver.id, userId, version: input.expectedDriverVersion },
        data: {
          ...(input.action === 'accept' ? { currentAcceptedTermId: term.id } : {}),
          version: { increment: 1 },
        },
      });
      if (driverUpdate.count !== 1) throw versionConflict();
      if (input.action === 'accept' && driver.currentAcceptedTermId) {
        await tx.driverCompensationTermVersion.updateMany({
          where: { id: driver.currentAcceptedTermId, status: 'accepted' },
          data: { status: 'superseded', supersededAt: now },
        });
      }
      await tx.driverCompensationTermVersion.update({
        where: { id: term.id },
        data: input.action === 'accept'
          ? { status: 'accepted', acceptedAt: now, acceptedById: userId }
          : { status: 'rejected', rejectedAt: now },
      });
      await writeAudit(tx, userId, `driver.terms_${input.action}ed`, 'DriverCompensationTermVersion', term.id, {
        workspaceId: driver.companyId, businessDriverId: driver.id, termVersion: term.versionNumber,
      });
      return tx.businessDriver.findUniqueOrThrow({ where: { id: driver.id }, include: { currentAcceptedTerm: true } });
    });
    await emit(`driver.terms_${input.action}ed`, { termId, businessDriverId: driverId, workspaceId: result.companyId, actorId: userId, timestamp: now.toISOString() });
    return result;
  }

  async setPresence(userId: string, driverId: string, input: { presence: 'available' | 'offline'; expectedVersion: number }) {
    const now = this.clock();
    const result = await withSerializableRetry(this.prisma, async (tx) => {
      const driver = await assertDriverSelf(tx, userId, driverId);
      if (driver.version !== input.expectedVersion) throw versionConflict();
      if (driver.status !== 'active') throw new DeliveryError('INVALID_STATE', 409, 'Only active drivers can change presence');
      const updated = await tx.businessDriver.updateMany({
        where: { id: driver.id, userId, version: input.expectedVersion },
        data: { presence: input.presence, version: { increment: 1 } },
      });
      if (updated.count !== 1) throw versionConflict();
      await writeAudit(tx, userId, 'driver.presence_changed', 'BusinessDriver', driver.id, {
        workspaceId: driver.companyId, presence: input.presence, version: input.expectedVersion + 1,
      });
      return tx.businessDriver.findUniqueOrThrow({ where: { id: driver.id } });
    });
    await emit('driver.presence_changed', { businessDriverId: result.id, workspaceId: result.companyId, actorId: userId, presence: result.presence, timestamp: now.toISOString() });
    return result;
  }

  async listAvailabilityForManager(userId: string, workspaceId: string, driverId: string) {
    const db = transactionView(this.prisma);
    const workspace = await assertWorkspaceManager(db, userId, workspaceId);
    assertDeliveryEnabled(workspace);
    const driver = await db.businessDriver.findFirst({ where: { id: driverId, companyId: workspaceId, archivedAt: null } });
    if (!driver) throw notFound();
    return this.listAvailability(db, driver);
  }

  async listAvailabilityForSelf(userId: string, driverId: string) {
    const db = transactionView(this.prisma);
    const driver = await assertDriverSelf(db, userId, driverId);
    return this.listAvailability(db, driver);
  }

  async createAvailabilityForManager(userId: string, workspaceId: string, driverId: string, input: AvailabilityInput) {
    return withSerializableRetry(this.prisma, async (tx) => {
      const workspace = await assertWorkspaceManager(tx, userId, workspaceId);
      assertDeliveryEnabled(workspace);
      const driver = await tx.businessDriver.findFirst({ where: { id: driverId, companyId: workspaceId, archivedAt: null } });
      if (!driver) throw notFound();
      return this.createAvailability(tx, driver, userId, input);
    });
  }

  async createAvailabilityForSelf(userId: string, driverId: string, input: AvailabilityInput) {
    return withSerializableRetry(this.prisma, async (tx) => {
      const driver = await assertDriverSelf(tx, userId, driverId);
      return this.createAvailability(tx, driver, userId, input);
    });
  }

  async updateAvailabilityForManager(userId: string, workspaceId: string, driverId: string, scheduleId: string, input: Partial<AvailabilityInput>) {
    return withSerializableRetry(this.prisma, async (tx) => {
      const workspace = await assertWorkspaceManager(tx, userId, workspaceId);
      assertDeliveryEnabled(workspace);
      const driver = await tx.businessDriver.findFirst({ where: { id: driverId, companyId: workspaceId, archivedAt: null } });
      if (!driver) throw notFound();
      return this.updateAvailability(tx, driver, scheduleId, userId, input, false);
    });
  }

  async updateAvailabilityForSelf(userId: string, driverId: string, scheduleId: string, input: Partial<AvailabilityInput>) {
    return withSerializableRetry(this.prisma, async (tx) => {
      const driver = await assertDriverSelf(tx, userId, driverId);
      return this.updateAvailability(tx, driver, scheduleId, userId, input, false);
    });
  }

  async archiveAvailabilityForManager(userId: string, workspaceId: string, driverId: string, scheduleId: string) {
    return withSerializableRetry(this.prisma, async (tx) => {
      const workspace = await assertWorkspaceManager(tx, userId, workspaceId);
      assertDeliveryEnabled(workspace);
      const driver = await tx.businessDriver.findFirst({ where: { id: driverId, companyId: workspaceId, archivedAt: null } });
      if (!driver) throw notFound();
      return this.updateAvailability(tx, driver, scheduleId, userId, {}, true);
    });
  }

  async archiveAvailabilityForSelf(userId: string, driverId: string, scheduleId: string) {
    return withSerializableRetry(this.prisma, async (tx) => {
      const driver = await assertDriverSelf(tx, userId, driverId);
      return this.updateAvailability(tx, driver, scheduleId, userId, {}, true);
    });
  }

  async listEligibleOrders(userId: string, workspaceId: string) {
    const db = transactionView(this.prisma);
    const workspace = await assertWorkspaceManager(db, userId, workspaceId);
    assertDeliveryEnabled(workspace);
    return db.order.findMany({
      where: { matchedWorkspaceId: workspaceId, status: { in: ['paid', 'in_progress'] }, fulfillment: null },
      select: {
        id: true, status: true, description: true, scheduledAt: true,
        serviceCatalog: { select: { id: true, name: true, category: true } },
        payment: { select: { status: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createFulfillment(userId: string, workspaceId: string, rawInput: {
    orderId: string; providerKey: string; pickupAddress: unknown; dropoffAddress: unknown;
  }) {
    const provider = resolveDeliveryProvider(rawInput.providerKey);
    const pickupAddress = addressSnapshotSchema.parse(rawInput.pickupAddress);
    const dropoffAddress = addressSnapshotSchema.parse(rawInput.dropoffAddress);
    const now = this.clock();
    const result = await withSerializableRetry(this.prisma, async (tx) => {
      const workspace = await assertWorkspaceManager(tx, userId, workspaceId);
      assertDeliveryEnabled(workspace);
      const order = await tx.order.findFirst({
        where: { id: rawInput.orderId, matchedWorkspaceId: workspaceId, status: { in: ['paid', 'in_progress'] } },
        select: { id: true },
      });
      if (!order) throw notFound('Eligible order not found');
      const fulfillment = await tx.fulfillment.create({
        data: {
          orderId: order.id,
          workspaceId,
          providerKind: provider.kind,
          providerKey: provider.key,
          pickupAddressSnapshot: pickupAddress as Prisma.InputJsonValue,
          dropoffAddressSnapshot: dropoffAddress as Prisma.InputJsonValue,
          createdById: userId,
        },
      });
      await writeAudit(tx, userId, 'fulfillment.created', 'Fulfillment', fulfillment.id, {
        workspaceId, orderId: order.id, providerKey: provider.key, status: fulfillment.status, version: fulfillment.version,
      });
      return fulfillment;
    });
    await emit('fulfillment.created', { fulfillmentId: result.id, workspaceId, orderId: result.orderId, actorId: userId, status: result.status, version: result.version, timestamp: now.toISOString() });
    return result;
  }

  async listFulfillments(userId: string, workspaceId: string) {
    const db = transactionView(this.prisma);
    const workspace = await assertWorkspaceManager(db, userId, workspaceId);
    assertDeliveryEnabled(workspace);
    const rows = await db.fulfillment.findMany({ where: { workspaceId, archivedAt: null }, include: fulfillmentInclude, orderBy: { createdAt: 'desc' } });
    return rows.map((row) => this.serializeFulfillment(row, true));
  }

  async getFulfillmentForManager(userId: string, workspaceId: string, fulfillmentId: string) {
    const db = transactionView(this.prisma);
    const workspace = await assertWorkspaceManager(db, userId, workspaceId);
    assertDeliveryEnabled(workspace);
    const row = await db.fulfillment.findFirst({ where: { id: fulfillmentId, workspaceId, archivedAt: null }, include: fulfillmentInclude });
    if (!row) throw notFound();
    return this.serializeFulfillment(row, true);
  }

  async offerAssignment(userId: string, workspaceId: string, fulfillmentId: string, input: {
    businessDriverId: string; expectedVersion: number; plannedStartAt?: string | null; plannedEndAt?: string | null;
    replaceReason?: string; notes?: string;
  }) {
    const now = this.clock();
    const result = await withSerializableRetry(this.prisma, async (tx) => {
      const workspace = await assertWorkspaceManager(tx, userId, workspaceId);
      assertDeliveryEnabled(workspace);
      const fulfillment = await tx.fulfillment.findFirst({
        where: { id: fulfillmentId, workspaceId, archivedAt: null }, include: { currentAssignment: true },
      });
      if (!fulfillment) throw notFound();
      if (fulfillment.version !== input.expectedVersion) throw versionConflict();
      if (terminalFulfillmentStatuses.has(fulfillment.status) || ['picked_up', 'in_transit'].includes(fulfillment.status)) {
        throw new DeliveryError('INVALID_STATE', 409, 'Fulfillment can no longer be assigned');
      }
      if (fulfillment.currentAssignment && !input.replaceReason) {
        throw new DeliveryError('INVALID_STATE', 409, 'A replacement reason is required');
      }
      const driver = await tx.businessDriver.findFirst({ where: { id: input.businessDriverId, companyId: workspaceId, archivedAt: null } });
      if (!driver) throw notFound();
      const interval = input.plannedStartAt && input.plannedEndAt
        ? { startAt: new Date(input.plannedStartAt), endAt: new Date(input.plannedEndAt) }
        : undefined;
      await assertActivePrincipal(tx, driver, interval);

      if (fulfillment.currentAssignment) {
        if (!['offered', 'accepted'].includes(fulfillment.currentAssignment.status)) {
          throw new DeliveryError('INVALID_STATE', 409, 'Current assignment cannot be replaced');
        }
        await this.releaseReservation(tx, fulfillment.currentAssignment, now);
        await tx.deliveryAssignment.update({
          where: { id: fulfillment.currentAssignment.id },
          data: { status: 'revoked', revokedAt: now, outcomeById: userId, reasonCode: input.replaceReason, version: { increment: 1 } },
        });
      }

      const assignment = await tx.deliveryAssignment.create({
        data: {
          fulfillmentId: fulfillment.id,
          businessDriverId: driver.id,
          compensationTermId: driver.currentAcceptedTermId!,
          plannedStartAt: interval?.startAt,
          plannedEndAt: interval?.endAt,
          offeredById: userId,
          offeredAt: now,
          notes: input.notes,
        },
      });
      const updated = await tx.fulfillment.updateMany({
        where: { id: fulfillment.id, workspaceId, version: input.expectedVersion },
        data: { status: 'assigned', currentAssignmentId: assignment.id, assignedAt: now, acceptedAt: null, version: { increment: 1 } },
      });
      if (updated.count !== 1) throw versionConflict();
      await notify(tx, driver.userId, 'Delivery assignment', `${workspace.name} offered you a delivery assignment.`);
      await writeAudit(tx, userId, fulfillment.currentAssignment ? 'fulfillment.assignment_replaced' : 'fulfillment.assignment_offered', 'DeliveryAssignment', assignment.id, {
        fulfillmentId: fulfillment.id, workspaceId, businessDriverId: driver.id, status: assignment.status,
        fulfillmentVersion: input.expectedVersion + 1,
      });
      return { assignment, driverUserId: driver.userId, fulfillmentVersion: input.expectedVersion + 1 };
    });
    await emit('fulfillment.assignment_offered', { assignmentId: result.assignment.id, fulfillmentId, workspaceId, actorId: userId, fulfillmentVersion: result.fulfillmentVersion, timestamp: now.toISOString() });
    return result.assignment;
  }

  async listAssignmentsForSelf(userId: string) {
    const db = transactionView(this.prisma);
    const rows = await db.deliveryAssignment.findMany({
      where: { businessDriver: { userId, archivedAt: null, company: { deliveryOperationsEnabled: true } } },
      include: { compensationTerm: true, businessDriver: { include: { company: { select: { id: true, name: true, logoUrl: true } } } }, fulfillment: { include: { order: { select: { id: true, status: true, description: true, serviceCatalog: { select: { id: true, name: true, category: true } } } } } } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => this.serializeDriverAssignment(row));
  }

  async getAssignmentForSelf(userId: string, assignmentId: string) {
    const db = transactionView(this.prisma);
    const row = await db.deliveryAssignment.findFirst({
      where: { id: assignmentId, businessDriver: { userId, archivedAt: null, company: { deliveryOperationsEnabled: true } } },
      include: { compensationTerm: true, businessDriver: { include: { company: { select: { id: true, name: true, logoUrl: true } } } }, fulfillment: { include: { order: { select: { id: true, status: true, description: true, serviceCatalog: { select: { id: true, name: true, category: true } } } } } } },
    });
    if (!row) throw notFound();
    return this.serializeDriverAssignment(row);
  }

  async respondAssignment(userId: string, assignmentId: string, input: {
    action: 'accept' | 'reject'; expectedAssignmentVersion: number; expectedFulfillmentVersion: number;
    reasonCode?: string; notes?: string;
  }) {
    const now = this.clock();
    const result = await withSerializableRetry(this.prisma, async (tx) => {
      const assignment = await tx.deliveryAssignment.findFirst({
        where: { id: assignmentId, businessDriver: { userId, archivedAt: null } },
        include: { businessDriver: { include: { company: { select: { deliveryOperationsEnabled: true } } } }, fulfillment: true },
      });
      if (!assignment || !assignment.businessDriver.company.deliveryOperationsEnabled) throw notFound();
      if (assignment.version !== input.expectedAssignmentVersion || assignment.fulfillment.version !== input.expectedFulfillmentVersion) throw versionConflict();
      if (assignment.status !== 'offered' || assignment.fulfillment.currentAssignmentId !== assignment.id || assignment.fulfillment.status !== 'assigned') {
        throw new DeliveryError('INVALID_STATE', 409, 'Assignment is no longer open');
      }
      if (input.action === 'reject' && !input.reasonCode) {
        throw new DeliveryError('INVALID_STATE', 400, 'A rejection reason is required');
      }

      let blockId: string | undefined;
      if (input.action === 'accept') {
        if (assignment.compensationTermId !== assignment.businessDriver.currentAcceptedTermId) {
          throw new DeliveryError('DRIVER_NOT_ELIGIBLE', 409, 'Compensation terms changed; the assignment must be offered again');
        }
        const interval = assignment.plannedStartAt && assignment.plannedEndAt
          ? { startAt: assignment.plannedStartAt, endAt: assignment.plannedEndAt }
          : undefined;
        await assertActivePrincipal(tx, assignment.businessDriver, interval);
        if (interval) {
          const block = await tx.staffSlotBlock.create({
            data: {
              staffId: userId,
              workspaceId: assignment.businessDriver.companyId,
              startAt: interval.startAt,
              endAt: interval.endAt,
              reason: `delivery_assignment:${assignment.id}`,
              orderId: assignment.fulfillment.orderId,
            },
          });
          blockId = block.id;
        }
      }

      const assignmentUpdate = await tx.deliveryAssignment.updateMany({
        where: { id: assignment.id, version: input.expectedAssignmentVersion, status: 'offered' },
        data: {
          status: input.action === 'accept' ? 'accepted' : 'rejected',
          respondedAt: now,
          respondedById: userId,
          reasonCode: input.reasonCode,
          notes: input.notes,
          staffSlotBlockId: blockId,
          version: { increment: 1 },
        },
      });
      if (assignmentUpdate.count !== 1) throw versionConflict();
      const fulfillmentUpdate = await tx.fulfillment.updateMany({
        where: { id: assignment.fulfillment.id, currentAssignmentId: assignment.id, version: input.expectedFulfillmentVersion },
        data: input.action === 'accept'
          ? { status: 'accepted', acceptedAt: now, version: { increment: 1 } }
          : { status: 'unassigned', currentAssignmentId: null, assignedAt: null, acceptedAt: null, version: { increment: 1 } },
      });
      if (fulfillmentUpdate.count !== 1) throw versionConflict();
      await writeAudit(tx, userId, `fulfillment.assignment_${input.action}ed`, 'DeliveryAssignment', assignment.id, {
        fulfillmentId: assignment.fulfillment.id, workspaceId: assignment.businessDriver.companyId,
        status: input.action === 'accept' ? 'accepted' : 'rejected', fulfillmentVersion: input.expectedFulfillmentVersion + 1,
      });
      return { assignmentId: assignment.id, fulfillmentId: assignment.fulfillment.id, workspaceId: assignment.businessDriver.companyId };
    });
    await emit(`fulfillment.assignment_${input.action}ed`, { ...result, actorId: userId, timestamp: now.toISOString() });
    return this.getAssignmentForSelf(userId, assignmentId);
  }

  async transitionAssignment(userId: string, assignmentId: string, input: {
    action: DriverTransitionAction; expectedAssignmentVersion: number; expectedFulfillmentVersion: number;
    reasonCode?: string; notes?: string;
  }) {
    const now = this.clock();
    const result = await withSerializableRetry(this.prisma, async (tx) => {
      const assignment = await tx.deliveryAssignment.findFirst({
        where: { id: assignmentId, businessDriver: { userId, archivedAt: null } },
        include: { businessDriver: { include: { company: { select: { deliveryOperationsEnabled: true } } } }, fulfillment: true },
      });
      if (!assignment || !assignment.businessDriver.company.deliveryOperationsEnabled) throw notFound();
      if (assignment.version !== input.expectedAssignmentVersion || assignment.fulfillment.version !== input.expectedFulfillmentVersion) throw versionConflict();
      if (assignment.status !== 'accepted' || assignment.fulfillment.currentAssignmentId !== assignment.id) {
        throw new DeliveryError('INVALID_STATE', 409, 'Assignment is not active');
      }
      const nextStatus = transitionFulfillment(assignment.fulfillment.status, input.action);
      if (['failed', 'unable_to_deliver'].includes(nextStatus) && !input.reasonCode) {
        throw new DeliveryError('INVALID_STATE', 400, 'An outcome reason is required');
      }
      const assignmentStatus = assignmentStatusForFulfillment(nextStatus);
      const assignmentTimestamps = assignmentStatus === 'completed' ? { completedAt: now }
        : assignmentStatus === 'failed' || assignmentStatus === 'unable_to_deliver' ? { failedAt: now }
        : {};
      const assignmentUpdate = await tx.deliveryAssignment.updateMany({
        where: { id: assignment.id, version: input.expectedAssignmentVersion, status: 'accepted' },
        data: {
          status: assignmentStatus,
          ...assignmentTimestamps,
          ...(assignmentStatus !== 'accepted' ? { outcomeById: userId, reasonCode: input.reasonCode, notes: input.notes } : {}),
          version: { increment: 1 },
        },
      });
      if (assignmentUpdate.count !== 1) throw versionConflict();
      const fulfillmentUpdate = await tx.fulfillment.updateMany({
        where: { id: assignment.fulfillment.id, currentAssignmentId: assignment.id, version: input.expectedFulfillmentVersion },
        data: { status: nextStatus, ...lifecycleTimestampFor(nextStatus, now), version: { increment: 1 } },
      });
      if (fulfillmentUpdate.count !== 1) throw versionConflict();
      if (terminalFulfillmentStatuses.has(nextStatus)) await this.releaseReservation(tx, assignment, now);
      await writeAudit(tx, userId, `fulfillment.${nextStatus}`, 'Fulfillment', assignment.fulfillment.id, {
        assignmentId: assignment.id, workspaceId: assignment.businessDriver.companyId,
        from: assignment.fulfillment.status, to: nextStatus, fulfillmentVersion: input.expectedFulfillmentVersion + 1,
      });
      return { fulfillmentId: assignment.fulfillment.id, workspaceId: assignment.businessDriver.companyId, status: nextStatus };
    });
    await emit(`fulfillment.${result.status}`, { ...result, assignmentId, actorId: userId, timestamp: now.toISOString() });
    return this.getAssignmentForSelf(userId, assignmentId);
  }

  async cancelFulfillment(userId: string, workspaceId: string, fulfillmentId: string, input: {
    expectedVersion: number; reasonCode: string; notes?: string;
  }) {
    const now = this.clock();
    const result = await withSerializableRetry(this.prisma, async (tx) => {
      const workspace = await assertWorkspaceManager(tx, userId, workspaceId);
      assertDeliveryEnabled(workspace);
      const fulfillment = await tx.fulfillment.findFirst({ where: { id: fulfillmentId, workspaceId, archivedAt: null }, include: { currentAssignment: true } });
      if (!fulfillment) throw notFound();
      if (fulfillment.version !== input.expectedVersion) throw versionConflict();
      if (terminalFulfillmentStatuses.has(fulfillment.status)) throw new DeliveryError('INVALID_STATE', 409, 'Fulfillment is terminal');
      if (fulfillment.currentAssignment) {
        await this.releaseReservation(tx, fulfillment.currentAssignment, now);
        await tx.deliveryAssignment.update({
          where: { id: fulfillment.currentAssignment.id },
          data: { status: 'cancelled', cancelledAt: now, outcomeById: userId, reasonCode: input.reasonCode, notes: input.notes, version: { increment: 1 } },
        });
      }
      const updated = await tx.fulfillment.updateMany({
        where: { id: fulfillment.id, workspaceId, version: input.expectedVersion },
        data: { status: 'cancelled', terminalAt: now, version: { increment: 1 } },
      });
      if (updated.count !== 1) throw versionConflict();
      await writeAudit(tx, userId, 'fulfillment.cancelled', 'Fulfillment', fulfillment.id, {
        workspaceId, from: fulfillment.status, to: 'cancelled', version: input.expectedVersion + 1,
      });
      return tx.fulfillment.findUniqueOrThrow({ where: { id: fulfillment.id } });
    });
    await emit('fulfillment.cancelled', { fulfillmentId: result.id, workspaceId, actorId: userId, status: result.status, version: result.version, timestamp: now.toISOString() });
    return result;
  }

  async setWorkspaceCapability(userId: string, userRole: string, workspaceId: string, enabled: boolean) {
    if (!['owner', 'platform_admin'].includes(userRole)) {
      throw new DeliveryError('FORBIDDEN', 403, 'Platform delivery capability access is not permitted');
    }
    const now = this.clock();
    const result = await withSerializableRetry(this.prisma, async (tx) => {
      const workspace = await tx.company.findUnique({ where: { id: workspaceId }, select: { id: true, deliveryOperationsEnabled: true } });
      if (!workspace) throw notFound('Workspace not found');
      if (!enabled) {
        const active = await tx.fulfillment.count({ where: { workspaceId, archivedAt: null, status: { in: nonterminalStatuses } } });
        if (active > 0) throw new DeliveryError('ACTIVE_FULFILLMENTS_EXIST', 409, 'Delivery operations cannot be disabled while active work exists');
      }
      const updated = await tx.company.update({ where: { id: workspaceId }, data: { deliveryOperationsEnabled: enabled }, select: { id: true, deliveryOperationsEnabled: true } });
      await writeAudit(tx, userId, 'delivery.capability_changed', 'Company', workspaceId, { enabled });
      return updated;
    });
    await emit('driver.capability_changed', { workspaceId, actorId: userId, enabled, timestamp: now.toISOString() });
    return result;
  }

  private async listAvailability(db: Tx, driver: Pick<BusinessDriver, 'companyId' | 'userId'>) {
    return db.schedule.findMany({
      where: { companyId: driver.companyId, staffId: driver.userId, purpose: 'delivery' },
      orderBy: { startTime: 'asc' },
    });
  }

  private async createAvailability(db: Tx, driver: Pick<BusinessDriver, 'id' | 'companyId' | 'userId'>, actorId: string, input: AvailabilityInput) {
    const schedule = await db.schedule.create({
      data: {
        companyId: driver.companyId, staffId: driver.userId, purpose: 'delivery', status: 'available', isActive: true,
        startTime: new Date(input.startTime), endTime: new Date(input.endTime),
      },
    });
    await writeAudit(db, actorId, 'driver.availability_created', 'Schedule', schedule.id, { workspaceId: driver.companyId, businessDriverId: driver.id });
    return schedule;
  }

  private async updateAvailability(
    db: Tx,
    driver: Pick<BusinessDriver, 'id' | 'companyId' | 'userId'>,
    scheduleId: string,
    actorId: string,
    input: Partial<AvailabilityInput>,
    archive: boolean,
  ) {
    const schedule = await db.schedule.findFirst({
      where: { id: scheduleId, companyId: driver.companyId, staffId: driver.userId, purpose: 'delivery' },
    });
    if (!schedule) throw notFound();
    const startTime = input.startTime ? new Date(input.startTime) : schedule.startTime;
    const endTime = input.endTime ? new Date(input.endTime) : schedule.endTime;
    if (startTime >= endTime) throw new DeliveryError('INVALID_STATE', 400, 'startTime must be before endTime');
    const updated = await db.schedule.update({
      where: { id: schedule.id },
      data: { startTime, endTime, ...(archive ? { isActive: false } : {}) },
    });
    await writeAudit(db, actorId, archive ? 'driver.availability_archived' : 'driver.availability_updated', 'Schedule', schedule.id, {
      workspaceId: driver.companyId, businessDriverId: driver.id,
    });
    return updated;
  }

  private async releaseReservation(db: Tx, assignment: { id: string; staffSlotBlockId: string | null }, now: Date) {
    if (!assignment.staffSlotBlockId) return;
    await db.deliveryAssignment.update({
      where: { id: assignment.id },
      data: { staffSlotBlockId: null, reservationReleasedAt: now },
    });
    await db.staffSlotBlock.deleteMany({ where: { id: assignment.staffSlotBlockId } });
  }

  private async withEffectiveAvailability<T extends BusinessDriver>(db: Tx, driver: T) {
    const now = this.clock();
    const [window, assignments] = await Promise.all([
      db.schedule.findFirst({
        where: {
          companyId: driver.companyId, staffId: driver.userId, purpose: 'delivery', isActive: true,
          startTime: { lte: now }, endTime: { gt: now },
        }, select: { id: true },
      }),
      db.deliveryAssignment.findMany({
        where: { businessDriverId: driver.id, status: 'accepted' },
        select: { plannedStartAt: true, plannedEndAt: true, fulfillment: { select: { status: true } } },
      }),
    ]);
    return {
      ...driver,
      effectiveAvailability: effectiveAvailability({
        relationshipStatus: driver.status,
        mode: driver.availabilityMode,
        presence: driver.presence,
        now,
        insideScheduledWindow: Boolean(window),
        assignments: assignments.map((assignment) => ({
          fulfillmentStatus: assignment.fulfillment.status,
          plannedStartAt: assignment.plannedStartAt,
          plannedEndAt: assignment.plannedEndAt,
        })),
      }),
    };
  }

  private serializeFulfillment(row: Prisma.FulfillmentGetPayload<{ include: typeof fulfillmentInclude }>, managerView: boolean) {
    return {
      id: row.id,
      orderId: row.orderId,
      workspaceId: row.workspaceId,
      providerKind: row.providerKind,
      providerKey: row.providerKey,
      status: row.status,
      version: row.version,
      currentAssignmentId: row.currentAssignmentId,
      addressSchemaVersion: row.addressSchemaVersion,
      ...serializeAddresses(row.pickupAddressSnapshot, row.dropoffAddressSnapshot, row.currentAssignment?.status ?? null, managerView),
      order: row.order,
      currentAssignment: row.currentAssignment,
      assignments: row.assignments,
      assignedAt: row.assignedAt,
      acceptedAt: row.acceptedAt,
      pickedUpAt: row.pickedUpAt,
      inTransitAt: row.inTransitAt,
      deliveredAt: row.deliveredAt,
      terminalAt: row.terminalAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private serializeDriverAssignment(row: {
    id: string; status: DeliveryAssignmentStatus; version: number; plannedStartAt: Date | null; plannedEndAt: Date | null;
    offeredAt: Date; respondedAt: Date | null; reasonCode: string | null; notes: string | null;
    compensationTerm: unknown;
    businessDriver: { companyId: string; company: { id: string; name: string; logoUrl: string | null } };
    fulfillment: {
      id: string; status: FulfillmentStatus; version: number; pickupAddressSnapshot: unknown; dropoffAddressSnapshot: unknown;
      order: { id: string; status: unknown; description: string; serviceCatalog: { id: string; name: string; category: string } };
    };
  }) {
    return {
      id: row.id,
      status: row.status,
      version: row.version,
      plannedStartAt: row.plannedStartAt,
      plannedEndAt: row.plannedEndAt,
      offeredAt: row.offeredAt,
      respondedAt: row.respondedAt,
      reasonCode: row.reasonCode,
      notes: row.notes,
      compensationTerm: row.compensationTerm,
      workspace: row.businessDriver.company,
      fulfillment: {
        id: row.fulfillment.id,
        status: row.fulfillment.status,
        version: row.fulfillment.version,
        order: row.fulfillment.order,
        ...serializeAddresses(
          row.fulfillment.pickupAddressSnapshot,
          row.fulfillment.dropoffAddressSnapshot,
          row.status,
          false,
          row.respondedAt != null && row.status !== 'rejected',
        ),
      },
    };
  }
}
