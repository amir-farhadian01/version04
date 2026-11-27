import { Router, Response } from 'express';
import { BaseOrderStatus, OrderKind, OrderStatus, Prisma } from '@prisma/client';
import prisma from '../lib/db.js';
import { authenticate, AuthRequest } from '../lib/auth.middleware.js';
import { assertWorkspaceMember, WorkspaceAccessError } from '../lib/workspaceAccess.js';
import {
  computeOverallScheduleWindow,
  CustomBundleOrderSchema,
  CustomIntakeFormSchema,
  PipelineStageUpdateSchema,
  validateIntakeAnswersAgainstFields,
  WorkspacePipelineStagesSchema,
} from '../lib/validations/customOrderValidation.js';

export const workspaceCustomFormsRoutes = Router();
export const customBundleOrdersRoutes = Router();

workspaceCustomFormsRoutes.use(authenticate);
customBundleOrdersRoutes.use(authenticate);

const OFFLINE_PAYMENT_NOTICE =
  'پرداخت این سفارش به‌صورت توافقی/حضوری میان شما و ارائه‌دهنده انجام می‌پذیرد و نیاز به پرداخت آنلاین ندارد.';

function mapBaseStatusToOrderStatus(baseStatus: BaseOrderStatus): OrderStatus {
  switch (baseStatus) {
    case BaseOrderStatus.Draft:
      return OrderStatus.draft;
    case BaseOrderStatus.Submitted:
      return OrderStatus.submitted;
    case BaseOrderStatus.InReview:
      return OrderStatus.matching;
    case BaseOrderStatus.Accepted:
      return OrderStatus.contracted;
    case BaseOrderStatus.InProgress:
      return OrderStatus.in_progress;
    case BaseOrderStatus.Completed:
      return OrderStatus.completed;
    case BaseOrderStatus.Cancelled:
      return OrderStatus.cancelled;
  }
}

function handleRouteError(res: Response, err: unknown): void {
  if (err instanceof WorkspaceAccessError) {
    res.status(err.statusCode).json({
      status: 'error',
      error: err.message,
      ...(err.body ?? {}),
    });
    return;
  }
  console.error(err);
  res.status(500).json({ status: 'error', error: 'Internal server error' });
}

// ─── Workspace Custom Intake Form Routes (/api/workspaces/:workspaceId/intake-form) ─

workspaceCustomFormsRoutes.get(
  '/:workspaceId/intake-form',
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { workspaceId } = req.params;
      const company = await prisma.company.findUnique({
        where: { id: workspaceId },
        select: { id: true },
      });
      if (!company) {
        res.status(404).json({ status: 'error', error: 'Workspace not found' });
        return;
      }

      const form = await prisma.customIntakeForm.findFirst({
        where: { workspaceId, isActive: true },
        include: {
          fields: { orderBy: { sortOrder: 'asc' } },
        },
        orderBy: { updatedAt: 'desc' },
      });

      if (!form) {
        res.json({
          status: 'empty',
          data: null,
          message: 'No active intake form configured for this workspace',
        });
        return;
      }

      res.json({ status: 'success', data: form });
    } catch (err) {
      handleRouteError(res, err);
    }
  },
);

workspaceCustomFormsRoutes.put(
  '/:workspaceId/intake-form',
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { workspaceId } = req.params;
      const { role } = await assertWorkspaceMember(req.user!.userId, workspaceId);
      if (role !== 'owner' && role !== 'admin') {
        res.status(403).json({
          status: 'error',
          error: 'Forbidden: only workspace owner or admin can configure intake forms',
        });
        return;
      }

      const parsed = CustomIntakeFormSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          status: 'error',
          error: parsed.error.issues[0]?.message ?? 'Invalid intake form payload',
          details: parsed.error.issues,
        });
        return;
      }

      const { name, description, serviceCatalogId, isActive, fields } = parsed.data;

      const savedForm = await prisma.$transaction(async (tx) => {
        if (isActive) {
          await tx.customIntakeForm.updateMany({
            where: { workspaceId, isActive: true },
            data: { isActive: false },
          });
        }

        return tx.customIntakeForm.create({
          data: {
            workspaceId,
            serviceCatalogId: serviceCatalogId ?? null,
            name,
            description: description ?? null,
            isActive,
            fields: {
              create: fields.map((f, index) => ({
                label: f.label,
                fieldType: f.fieldType,
                isRequired: f.isRequired,
                placeholder: f.placeholder ?? null,
                options: f.options !== undefined ? (f.options as Prisma.InputJsonValue) : Prisma.JsonNull,
                sortOrder: f.sortOrder ?? index,
              })),
            },
          },
          include: {
            fields: { orderBy: { sortOrder: 'asc' } },
          },
        });
      });

      res.json({ status: 'success', data: savedForm });
    } catch (err) {
      handleRouteError(res, err);
    }
  },
);

// ─── Workspace CRM Pipeline Stages Routes (/api/workspaces/:workspaceId/pipeline-stages) ─

workspaceCustomFormsRoutes.get(
  '/:workspaceId/pipeline-stages',
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { workspaceId } = req.params;
      await assertWorkspaceMember(req.user!.userId, workspaceId);

      const stages = await prisma.workspacePipelineStage.findMany({
        where: { workspaceId },
        orderBy: { sortOrder: 'asc' },
      });

      if (stages.length === 0) {
        res.json({
          status: 'empty',
          data: [],
          message: 'No custom pipeline stages configured for this workspace',
        });
        return;
      }

      res.json({ status: 'success', data: stages });
    } catch (err) {
      handleRouteError(res, err);
    }
  },
);

workspaceCustomFormsRoutes.post(
  '/:workspaceId/pipeline-stages',
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { workspaceId } = req.params;
      const { role } = await assertWorkspaceMember(req.user!.userId, workspaceId);
      if (role !== 'owner' && role !== 'admin') {
        res.status(403).json({
          status: 'error',
          error: 'Forbidden: only workspace owner or admin can configure pipeline stages',
        });
        return;
      }

      const parsed = WorkspacePipelineStagesSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          status: 'error',
          error: parsed.error.issues[0]?.message ?? 'Invalid pipeline stages payload',
          details: parsed.error.issues,
        });
        return;
      }

      const createdStages = await prisma.$transaction(async (tx) => {
        await tx.workspacePipelineStage.deleteMany({
          where: { workspaceId },
        });

        await tx.workspacePipelineStage.createMany({
          data: parsed.data.stages.map((stage, index) => ({
            workspaceId,
            name: stage.name,
            baseStatus: stage.baseStatus,
            sortOrder: stage.sortOrder ?? index,
            isDefault: stage.isDefault,
          })),
        });

        return tx.workspacePipelineStage.findMany({
          where: { workspaceId },
          orderBy: { sortOrder: 'asc' },
        });
      });

      res.status(201).json({ status: 'success', data: createdStages });
    } catch (err) {
      handleRouteError(res, err);
    }
  },
);

// ─── Custom Bundle Order & CRM Stage Update Routes (/api/orders/...) ───────────

customBundleOrdersRoutes.post(
  '/custom-bundle',
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const parsed = CustomBundleOrderSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          status: 'error',
          error: parsed.error.issues[0]?.message ?? 'Invalid custom bundle order payload',
          details: parsed.error.issues,
        });
        return;
      }

      const {
        workspaceId,
        serviceCatalogId: requestedCatalogId,
        description,
        address,
        scheduleFlexibility,
        items,
        intakeAnswers,
      } = parsed.data;

      const workspace = await prisma.company.findUnique({
        where: { id: workspaceId },
        select: { id: true, ownerId: true },
      });
      if (!workspace) {
        res.status(404).json({ status: 'error', error: 'Workspace not found' });
        return;
      }

      const activeForm = await prisma.customIntakeForm.findFirst({
        where: { workspaceId, isActive: true },
        include: { fields: { orderBy: { sortOrder: 'asc' } } },
      });

      if (activeForm && activeForm.fields.length > 0) {
        const answersCheck = validateIntakeAnswersAgainstFields(
          activeForm.fields,
          intakeAnswers,
        );
        if (!answersCheck.valid && 'errors' in answersCheck) {
          res.status(400).json({
            status: 'error',
            error: answersCheck.errors[0],
            details: answersCheck.errors,
          });
          return;
        }
      }

      const packageIds = items
        .map((i) => i.packageId)
        .filter((id): id is string => Boolean(id));

      const packages =
        packageIds.length > 0
          ? await prisma.providerServicePackage.findMany({
              where: { id: { in: packageIds }, workspaceId },
            })
          : [];
      const packageById = new Map(packages.map((p) => [p.id, p]));

      const resolvedServiceCatalogId =
        requestedCatalogId ??
        activeForm?.serviceCatalogId ??
        packages[0]?.serviceCatalogId;

      if (!resolvedServiceCatalogId) {
        res.status(400).json({
          status: 'error',
          error: 'serviceCatalogId could not be resolved from payload or packages',
        });
        return;
      }

      const { overallStartAt, overallEndAt } = computeOverallScheduleWindow(items);

      const defaultStage = await prisma.workspacePipelineStage.findFirst({
        where: { workspaceId, isDefault: true },
      });

      const createdOrder = await prisma.$transaction(async (tx) => {
        const order = await tx.order.create({
          data: {
            customerId: req.user!.userId,
            serviceCatalogId: resolvedServiceCatalogId,
            matchedWorkspaceId: workspaceId,
            matchedProviderId: workspace.ownerId,
            orderKind: OrderKind.custom_bundle,
            status: OrderStatus.submitted,
            currentStageId: defaultStage?.id ?? null,
            overallStartAt,
            overallEndAt,
            scheduledAt: overallStartAt,
            scheduleFlexibility,
            address: address ?? '',
            description: description ?? 'Custom bundle order',
            schemaSnapshot: activeForm
              ? ({ formId: activeForm.id, fields: activeForm.fields } as unknown as Prisma.InputJsonValue)
              : ({} as Prisma.InputJsonValue),
            answers: (intakeAnswers ?? {}) as Prisma.InputJsonValue,
            intakeAnswers: (intakeAnswers ?? {}) as Prisma.InputJsonValue,
            photos: [] as Prisma.InputJsonValue,
            submittedAt: new Date(),
            lineItems: {
              create: items.map((item, idx) => {
                const pkg = item.packageId ? packageById.get(item.packageId) : undefined;
                const unitPriceCents = pkg
                  ? Math.round(pkg.finalPrice * 100)
                  : item.unitPriceCents;
                return {
                  packageId: pkg?.id ?? null,
                  packageSnapshot: pkg
                    ? ({
                        id: pkg.id,
                        name: pkg.name,
                        finalPrice: pkg.finalPrice,
                        currency: pkg.currency,
                      } as Prisma.InputJsonValue)
                    : Prisma.JsonNull,
                  title: item.title,
                  quantity: item.quantity,
                  unitPriceCents,
                  totalPriceCents: unitPriceCents * item.quantity,
                  scheduledStartAt: item.scheduledStartAt ? new Date(item.scheduledStartAt) : null,
                  scheduledEndAt: item.scheduledEndAt ? new Date(item.scheduledEndAt) : null,
                  sessionIndex: item.sessionIndex ?? idx + 1,
                  status: BaseOrderStatus.Submitted,
                };
              }),
            },
          },
          include: {
            lineItems: true,
            currentStage: true,
          },
        });

        return order;
      });

      res.status(201).json({
        status: 'success',
        data: createdOrder,
        paymentNotice: OFFLINE_PAYMENT_NOTICE,
      });
    } catch (err) {
      handleRouteError(res, err);
    }
  },
);

customBundleOrdersRoutes.patch(
  '/:id/pipeline-stage',
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const parsed = PipelineStageUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          status: 'error',
          error: parsed.error.issues[0]?.message ?? 'Invalid pipeline stage update payload',
          details: parsed.error.issues,
        });
        return;
      }

      const order = await prisma.order.findUnique({
        where: { id: req.params.id },
        select: { id: true, matchedWorkspaceId: true, status: true, currentStageId: true },
      });
      if (!order) {
        res.status(404).json({ status: 'error', error: 'Order not found' });
        return;
      }
      if (!order.matchedWorkspaceId) {
        res.status(400).json({
          status: 'error',
          error: 'Order is not associated with a workspace',
        });
        return;
      }

      await assertWorkspaceMember(req.user!.userId, order.matchedWorkspaceId);

      const stage = await prisma.workspacePipelineStage.findUnique({
        where: { id: parsed.data.stageId },
      });
      if (!stage || stage.workspaceId !== order.matchedWorkspaceId) {
        res.status(404).json({
          status: 'error',
          error: 'Pipeline stage not found in this workspace',
        });
        return;
      }

      if (
        order.status === OrderStatus.in_progress &&
        stage.baseStatus === BaseOrderStatus.Cancelled
      ) {
        res.status(400).json({
          status: 'error',
          error: 'Direct cancellation is not permitted after job has started; use dispute flow',
        });
        return;
      }

      const nextOrderStatus = mapBaseStatusToOrderStatus(stage.baseStatus);

      const updatedOrder = await prisma.$transaction(async (tx) => {
        const updated = await tx.order.update({
          where: { id: order.id },
          data: {
            currentStageId: stage.id,
            status: nextOrderStatus,
          },
          include: {
            currentStage: true,
            lineItems: true,
          },
        });

        await tx.auditLog.create({
          data: {
            actorId: req.user!.userId,
            action: 'order_pipeline_stage_changed',
            resourceType: 'Order',
            resourceId: order.id,
            metadata: {
              previousStageId: order.currentStageId,
              newStageId: stage.id,
              baseStatus: stage.baseStatus,
              internalNote: parsed.data.internalNote ?? null,
            } as Prisma.InputJsonValue,
          },
        });

        return updated;
      });

      res.json({ status: 'success', data: updatedOrder });
    } catch (err) {
      handleRouteError(res, err);
    }
  },
);

customBundleOrdersRoutes.get(
  '/:id/bundle-details',
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const order = await prisma.order.findUnique({
        where: { id: req.params.id },
        include: {
          lineItems: { orderBy: { sessionIndex: 'asc' } },
          currentStage: true,
        },
      });
      if (!order) {
        res.status(404).json({ status: 'error', error: 'Order not found' });
        return;
      }

      const isCustomerOwner = order.customerId === req.user!.userId;
      if (!isCustomerOwner) {
        if (!order.matchedWorkspaceId) {
          res.status(403).json({ status: 'error', error: 'Forbidden' });
          return;
        }
        await assertWorkspaceMember(req.user!.userId, order.matchedWorkspaceId);
      }

      res.json({
        status: 'success',
        data: {
          id: order.id,
          orderKind: order.orderKind,
          status: order.status,
          currentStage: order.currentStage,
          overallStartAt: order.overallStartAt,
          overallEndAt: order.overallEndAt,
          intakeAnswers: order.intakeAnswers,
          lineItems: order.lineItems,
          paymentNotice: OFFLINE_PAYMENT_NOTICE,
        },
      });
    } catch (err) {
      handleRouteError(res, err);
    }
  },
);
