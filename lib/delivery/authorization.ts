import type { BusinessDriver, Prisma } from '@prisma/client';
import { DeliveryError, notFound } from './errors.js';

export async function assertWorkspaceManager(
  db: Prisma.TransactionClient,
  userId: string,
  workspaceId: string,
) {
  const workspace = await db.company.findUnique({
    where: { id: workspaceId },
    select: { id: true, ownerId: true, deliveryOperationsEnabled: true, name: true },
  });
  if (!workspace) throw notFound('Workspace not found');
  if (workspace.ownerId === userId) return workspace;

  const membership = await db.companyUser.findUnique({
    where: { companyId_userId: { companyId: workspaceId, userId } },
    select: { role: true },
  });
  if (!membership || !['owner', 'admin'].includes(membership.role)) {
    throw new DeliveryError('FORBIDDEN', 403, 'Delivery operations management is not permitted');
  }
  return workspace;
}

export function assertDeliveryEnabled(workspace: { deliveryOperationsEnabled: boolean }) {
  if (!workspace.deliveryOperationsEnabled) {
    throw new DeliveryError('FEATURE_DISABLED', 404, 'Delivery operations are not available');
  }
}

export async function assertDriverSelf(
  db: Prisma.TransactionClient,
  userId: string,
  businessDriverId: string,
) {
  const relationship = await db.businessDriver.findFirst({
    where: { id: businessDriverId, userId, archivedAt: null },
    include: { company: { select: { id: true, name: true, logoUrl: true, deliveryOperationsEnabled: true } }, currentAcceptedTerm: true },
  });
  if (!relationship) throw notFound();
  assertDeliveryEnabled(relationship.company);
  return relationship;
}

export async function assertActivePrincipal(
  db: Prisma.TransactionClient,
  driver: Pick<BusinessDriver, 'id' | 'companyId' | 'userId' | 'status' | 'currentAcceptedTermId' | 'availabilityMode' | 'presence'>,
  interval?: { startAt: Date; endAt: Date },
) {
  if (driver.status !== 'active') {
    throw new DeliveryError('DRIVER_NOT_ELIGIBLE', 409, 'Driver is not active');
  }
  if (!driver.currentAcceptedTermId) {
    throw new DeliveryError('DRIVER_NOT_ELIGIBLE', 409, 'Driver has no accepted compensation terms');
  }
  if (driver.presence !== 'available') {
    throw new DeliveryError('DRIVER_NOT_ELIGIBLE', 409, 'Driver is offline');
  }

  const [company, membership, user, approvedKyc, acceptedTerm] = await Promise.all([
    db.company.findUnique({ where: { id: driver.companyId }, select: { ownerId: true } }),
    db.companyUser.findUnique({
      where: { companyId_userId: { companyId: driver.companyId, userId: driver.userId } },
      select: { userId: true },
    }),
    db.user.findUnique({ where: { id: driver.userId }, select: { status: true, avatarUrl: true } }),
    db.kycPersonalSubmission.findFirst({
      where: { userId: driver.userId, status: 'approved' },
      select: { id: true },
      orderBy: { submittedAt: 'desc' },
    }),
    db.driverCompensationTermVersion.findFirst({
      where: { id: driver.currentAcceptedTermId, businessDriverId: driver.id, status: 'accepted' },
      select: { id: true },
    }),
  ]);

  if (!company || (company.ownerId !== driver.userId && !membership)) {
    throw new DeliveryError('DRIVER_NOT_ELIGIBLE', 409, 'Driver is no longer a workspace principal');
  }
  if (!user || user.status !== 'active' || !user.avatarUrl || !approvedKyc || !acceptedTerm) {
    throw new DeliveryError('DRIVER_NOT_ELIGIBLE', 409, 'Driver eligibility requirements are not satisfied');
  }

  if (driver.availabilityMode === 'scheduled') {
    if (!interval) {
      throw new DeliveryError('DRIVER_NOT_ELIGIBLE', 409, 'Scheduled drivers require a planned interval');
    }
    const coveringWindow = await db.schedule.findFirst({
      where: {
        companyId: driver.companyId,
        staffId: driver.userId,
        purpose: 'delivery',
        isActive: true,
        startTime: { lte: interval.startAt },
        endTime: { gte: interval.endAt },
      },
      select: { id: true },
    });
    if (!coveringWindow) {
      throw new DeliveryError('DRIVER_NOT_ELIGIBLE', 409, 'Planned interval is outside delivery availability');
    }
  }

  if (interval) {
    const conflict = await db.staffSlotBlock.findFirst({
      where: {
        staffId: driver.userId,
        startAt: { lt: interval.endAt },
        endAt: { gt: interval.startAt },
      },
      select: { id: true },
    });
    if (conflict) {
      throw new DeliveryError('SLOT_CONFLICT', 409, 'Driver is busy during the requested interval');
    }
  }

  const activeWork = await db.deliveryAssignment.findFirst({
    where: {
      businessDriver: { userId: driver.userId },
      status: 'accepted',
      fulfillment: { status: { in: ['accepted', 'picked_up', 'in_transit'] } },
      ...(interval
        ? {
            OR: [
              { fulfillment: { status: { in: ['picked_up', 'in_transit'] } } },
              { plannedStartAt: null, plannedEndAt: null },
            ],
          }
        : {}),
    },
    select: { id: true },
  });
  if (activeWork) {
    throw new DeliveryError('SLOT_CONFLICT', 409, 'Driver is already busy');
  }
}
