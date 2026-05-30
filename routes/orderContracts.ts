import { Router, Response } from 'express';
import {
  ContractActionType,
  ContractVersionStatus,
  OrderStatus,
  Prisma,
} from '@prisma/client';
import prisma from '../lib/db.js';
import { publish } from '../lib/bus.js';
import { authenticate, AuthRequest } from '../lib/auth.middleware.js';
import { phaseFromStatus } from '../lib/orderPhase.js';
import { assertWorkspaceMember, WorkspaceAccessError } from '../lib/workspaceAccess.js';
import { userHasActiveInboxAttemptForOrder } from '../lib/orderNegotiationAccess.js';
import { generateContractDraft } from '../lib/contractDraft.js';
import { analyzeMismatch } from '../lib/contractMismatchGuard.js';
import { createContractEvent } from '../lib/contractEvents.js';
import {
  getContractTemplateDefinition,
  listContractTemplateDefinitions,
} from '../lib/contractTemplateCatalog.js';
import { buildContractTemplateContext, renderContractTemplate } from '../lib/renderContractTemplate.js';

const router = Router({ mergeParams: true });

router.use(authenticate);

const ADMIN_ROLES = new Set(['owner', 'platform_admin', 'support', 'finance']);

function displayName(u: {
  displayName: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string;
}): string {
  if (u.displayName?.trim()) return u.displayName.trim();
  const n = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
  if (n) return n;
  return u.email;
}

async function loadOrderForContracts(orderId: string) {
  return prisma.order.findUnique({
    where: { id: orderId },
    include: {
      customer: {
        select: { id: true, email: true, displayName: true, firstName: true, lastName: true },
      },
      matchedProvider: {
        select: { id: true, email: true, displayName: true, firstName: true, lastName: true },
      },
      matchedPackage: {
        select: {
          id: true,
          name: true,
          description: true,
          finalPrice: true,
          currency: true,
        },
      },
      matchedWorkspace: { select: { id: true, name: true } },
      orderContract: {
        include: {
          currentVersion: true,
          versions: { orderBy: { versionNumber: 'desc' } },
          events: { orderBy: { createdAt: 'desc' }, take: 200 },
        },
      },
    },
  });
}

async function resolveParticipantRole(
  order: {
    id: string;
    customerId: string;
    matchedProviderId: string | null;
    matchedWorkspaceId: string | null;
  },
  req: AuthRequest,
): Promise<'customer' | 'provider' | 'admin' | 'invited_provider' | 'forbidden'> {
  const uid = req.user?.userId;
  const role = req.user?.role;
  if (!uid || !role) return 'forbidden';
  if (ADMIN_ROLES.has(role)) return 'admin';
  if (uid === order.customerId) return 'customer';
  if (order.matchedProviderId && uid === order.matchedProviderId) return 'provider';
  if (order.matchedWorkspaceId) {
    try {
      await assertWorkspaceMember(uid, order.matchedWorkspaceId);
      return 'provider';
    } catch (e) {
      if (e instanceof WorkspaceAccessError && e.statusCode === 404) {
        // fall through — user may still be an invited workspace on another attempt
      } else {
        throw e;
      }
    }
  }
  if (!order.matchedProviderId && (await userHasActiveInboxAttemptForOrder(uid, order.id))) {
    return 'invited_provider';
  }
  return 'forbidden';
}

function contractsGate(order: { matchedProviderId: string | null; status: OrderStatus }): {
  ok: boolean;
  status: number;
  message: string;
  code?: string;
} {
  if (!order.matchedProviderId) {
    return {
      ok: false,
      status: 400,
      message: 'Order has no matched provider yet',
      code: 'NO_MATCHED_PROVIDER',
    };
  }
  if (order.status === OrderStatus.draft || order.status === OrderStatus.cancelled) {
    return { ok: false, status: 400, message: 'Contracts are not available for this order state', code: 'ORDER_STATE' };
  }
  return { ok: true, status: 200, message: '' };
}

function pickStr(v: unknown): string | undefined {
  if (typeof v === 'string') {
    const t = v.trim();
    return t.length ? t : undefined;
  }
  return undefined;
}

function parseDate(v: unknown): Date | undefined {
  const s = pickStr(v);
  if (!s) return undefined;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function newestSentVersionNumber(
  versions: Array<{ versionNumber: number; status: ContractVersionStatus }>,
): number | null {
  const sent = versions.filter((v) => v.status === ContractVersionStatus.sent);
  if (!sent.length) return null;
  return Math.max(...sent.map((v) => v.versionNumber));
}

router.get('/context', async (req: AuthRequest, res: Response) => {
  try {
    const orderId = req.params.orderId;
    if (!orderId) return res.status(400).json({ error: 'orderId is required' });
    const order = await loadOrderForContracts(orderId);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    const role = await resolveParticipantRole(order, req);
    if (role === 'forbidden') return res.status(403).json({ error: 'Forbidden' });
    if (role === 'invited_provider') {
      const orderSummary = [
        order.description,
        JSON.stringify(order.answers ?? {}),
        order.address,
        `Schedule flexibility: ${order.scheduleFlexibility}`,
        order.scheduledAt ? `Scheduled at: ${order.scheduledAt.toISOString()}` : '',
      ]
        .filter(Boolean)
        .join('\n');
      return res.json({
        readOnly: true,
        code: 'CONTRACTS_LOCKED_UNTIL_MATCHED',
        lockReason:
          'Contract drafting unlocks when your workspace is the matched provider. You can review this summary until then.',
        order: {
          id: order.id,
          status: order.status,
          phase: order.phase,
          description: order.description,
          answers: order.answers,
          address: order.address,
          scheduledAt: order.scheduledAt,
          scheduleFlexibility: order.scheduleFlexibility,
        },
        package: null,
        chatMessages: [],
        orderSummary,
      });
    }
    const gate = contractsGate(order);
    if (!gate.ok) {
      return res.status(gate.status).json({ error: gate.message, ...(gate.code ? { code: gate.code } : {}) });
    }

    const thread = await prisma.orderChatThread.findUnique({
      where: { orderId },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: { id: true, displayText: true, senderRole: true, createdAt: true },
        },
      },
    });
    const messages = (thread?.messages ?? []).reverse();

    const orderSummary = [
      order.description,
      JSON.stringify(order.answers ?? {}),
      order.address,
      `Schedule flexibility: ${order.scheduleFlexibility}`,
      order.scheduledAt ? `Scheduled at: ${order.scheduledAt.toISOString()}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    return res.json({
      order: {
        id: order.id,
        status: order.status,
        phase: order.phase,
        description: order.description,
        answers: order.answers,
        address: order.address,
        scheduledAt: order.scheduledAt,
        scheduleFlexibility: order.scheduleFlexibility,
      },
      package: order.matchedPackage,
      chatMessages: messages,
      orderSummary,
    });
  } catch (err: unknown) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const orderId = req.params.orderId;
    if (!orderId) return res.status(400).json({ error: 'orderId is required' });
    const order = await loadOrderForContracts(orderId);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    const role = await resolveParticipantRole(order, req);
    if (role === 'forbidden') return res.status(403).json({ error: 'Forbidden' });
    if (role === 'invited_provider') {
      return res.json({
        readOnly: true,
        code: 'CONTRACTS_LOCKED_UNTIL_MATCHED',
        lockReason:
          'No contract versions yet for your workspace in pre-match state. Editing and send unlock when you are the matched provider.',
        contract: null,
        versions: [],
        events: [],
      });
    }
    const gate = contractsGate(order);
    if (!gate.ok) {
      return res.status(gate.status).json({ error: gate.message, ...(gate.code ? { code: gate.code } : {}) });
    }

    const shell = order.orderContract;
    if (!shell) {
      return res.json({ contract: null, versions: [], events: [] });
    }
    return res.json({
      contract: {
        id: shell.id,
        orderId: shell.orderId,
        currentVersionId: shell.currentVersionId,
        createdAt: shell.createdAt,
        updatedAt: shell.updatedAt,
        currentVersion: shell.currentVersion,
      },
      versions: shell.versions,
      events: shell.events,
    });
  } catch (err: unknown) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/draft-from-ai', async (req: AuthRequest, res: Response) => {
  try {
    const orderId = req.params.orderId;
    if (!orderId) return res.status(400).json({ error: 'orderId is required' });
    const order = await loadOrderForContracts(orderId);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    const role = await resolveParticipantRole(order, req);
    if (role === 'invited_provider') {
      return res.status(403).json({
        error: 'AI draft is available after your workspace is the matched provider.',
        code: 'CONTRACTS_READ_ONLY_UNTIL_MATCHED',
      });
    }
    if (role !== 'provider') return res.status(403).json({ error: 'Only the matched provider can create an AI draft' });
    const gate = contractsGate(order);
    if (!gate.ok) {
      return res.status(gate.status).json({ error: gate.message, ...(gate.code ? { code: gate.code } : {}) });
    }

    const thread = await prisma.orderChatThread.findUnique({
      where: { orderId },
      include: {
        messages: { orderBy: { createdAt: 'desc' }, take: 50, select: { displayText: true } },
      },
    });
    const chatSummary = (thread?.messages ?? [])
      .map((m) => m.displayText)
      .reverse()
      .join('\n---\n');

    const orderSummary = [
      order.description,
      typeof order.answers === 'object' ? JSON.stringify(order.answers) : '',
      order.address,
    ]
      .filter(Boolean)
      .join('\n');

    const pkg = order.matchedPackage;
    const scheduleLine =
      order.scheduledAt != null
        ? `${order.scheduledAt.toISOString()} (${order.scheduleFlexibility})`
        : order.scheduleFlexibility;

    const draft = await generateContractDraft({
      orderSummary,
      packageLabel: pkg?.name ?? 'Matched package',
      packagePrice: pkg?.finalPrice ?? null,
      packageCurrency: pkg?.currency ?? 'CAD',
      chatSummary,
      customerName: displayName(order.customer),
      providerName: order.matchedProvider ? displayName(order.matchedProvider) : 'Provider',
      scheduleLine,
    });

    const result = await prisma.$transaction(async (tx) => {
      let shell = await tx.orderContract.findUnique({ where: { orderId } });
      if (!shell) {
        shell = await tx.orderContract.create({ data: { orderId } });
      }
      const agg = await tx.contractVersion.aggregate({
        where: { contractId: shell.id },
        _max: { versionNumber: true },
      });
      const nextNum = (agg._max.versionNumber ?? 0) + 1;
      const mismatchWarningsJson = draft.mismatchWarnings.length
        ? (draft.mismatchWarnings as Prisma.InputJsonValue)
        : Prisma.JsonNull;

      const version = await tx.contractVersion.create({
        data: {
          contractId: shell.id,
          versionNumber: nextNum,
          status: ContractVersionStatus.draft,
          title: draft.title,
          termsMarkdown: draft.termsMarkdown,
          policiesMarkdown: draft.policiesMarkdown || null,
          scopeSummary: draft.scopeSummary || null,
          amount: draft.amount,
          currency: draft.currency,
          generatedByAi: true,
          generationPrompt: 'draft-from-ai',
          generationContext: {
            orderSummary: orderSummary.slice(0, 12000),
            chatExcerpt: chatSummary.slice(0, 12000),
          } as Prisma.InputJsonValue,
          mismatchWarnings: mismatchWarningsJson,
        },
      });
      return { shell, version };
    });

    return res.status(201).json(result);
  } catch (err: unknown) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/draft', async (req: AuthRequest, res: Response) => {
  try {
    const orderId = req.params.orderId;
    if (!orderId) return res.status(400).json({ error: 'orderId is required' });
    const order = await loadOrderForContracts(orderId);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    const role = await resolveParticipantRole(order, req);
    if (role === 'invited_provider') {
      return res.status(403).json({
        error: 'Saving drafts is available after your workspace is the matched provider.',
        code: 'CONTRACTS_READ_ONLY_UNTIL_MATCHED',
      });
    }
    if (role !== 'provider') return res.status(403).json({ error: 'Only the matched provider can edit drafts' });
    const gate = contractsGate(order);
    if (!gate.ok) {
      return res.status(gate.status).json({ error: gate.message, ...(gate.code ? { code: gate.code } : {}) });
    }

    const body = req.body as Record<string, unknown>;
    const title = pickStr(body.title);
    const termsMarkdown = pickStr(body.termsMarkdown);
    if (!title || !termsMarkdown) {
      return res.status(400).json({ error: 'title and termsMarkdown are required' });
    }
    const policiesMarkdown = pickStr(body.policiesMarkdown);
    const scopeSummary = pickStr(body.scopeSummary);
    const startDate = parseDate(body.startDate);
    const endDate = parseDate(body.endDate);
    const amount = typeof body.amount === 'number' && Number.isFinite(body.amount) ? body.amount : undefined;
    const currency = pickStr(body.currency) ?? 'CAD';

    const thread = await prisma.orderChatThread.findUnique({
      where: { orderId },
      include: {
        messages: { orderBy: { createdAt: 'desc' }, take: 50, select: { displayText: true } },
      },
    });
    const chatSummary = (thread?.messages ?? [])
      .map((m) => m.displayText)
      .reverse()
      .join('\n---\n');
    const mismatchWarnings = analyzeMismatch({
      chatSummary,
      termsMarkdown,
      scopeSummary: scopeSummary ?? null,
      amount: amount ?? null,
    });
    const mismatchWarningsJson = mismatchWarnings.length
      ? (mismatchWarnings as Prisma.InputJsonValue)
      : Prisma.JsonNull;

    const result = await prisma.$transaction(async (tx) => {
      let shell = await tx.orderContract.findUnique({ where: { orderId } });
      if (!shell) {
        shell = await tx.orderContract.create({ data: { orderId } });
      }
      const latest = await tx.contractVersion.findFirst({
        where: { contractId: shell.id },
        orderBy: { versionNumber: 'desc' },
      });
      if (latest?.status === ContractVersionStatus.draft) {
        const updated = await tx.contractVersion.update({
          where: { id: latest.id },
          data: {
            title,
            termsMarkdown,
            policiesMarkdown: policiesMarkdown ?? null,
            scopeSummary: scopeSummary ?? null,
            startDate: startDate ?? null,
            endDate: endDate ?? null,
            amount: amount ?? null,
            currency,
            generatedByAi: false,
            generationPrompt: null,
            generationContext: Prisma.JsonNull,
            mismatchWarnings: mismatchWarningsJson,
          },
        });
        return { shell, version: updated, created: false };
      }
      const agg = await tx.contractVersion.aggregate({
        where: { contractId: shell.id },
        _max: { versionNumber: true },
      });
      const nextNum = (agg._max.versionNumber ?? 0) + 1;
      const created = await tx.contractVersion.create({
        data: {
          contractId: shell.id,
          versionNumber: nextNum,
          status: ContractVersionStatus.draft,
          title,
          termsMarkdown,
          policiesMarkdown: policiesMarkdown ?? null,
          scopeSummary: scopeSummary ?? null,
          startDate: startDate ?? null,
          endDate: endDate ?? null,
          amount: amount ?? null,
          currency,
          generatedByAi: false,
          mismatchWarnings: mismatchWarningsJson,
        },
      });
      return { shell, version: created, created: true };
    });

    return res.status(result.created ? 201 : 200).json(result);
  } catch (err: unknown) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/templates', async (req: AuthRequest, res: Response) => {
  try {
    const orderId = req.params.orderId;
    if (!orderId) return res.status(400).json({ error: 'orderId is required' });
    const order = await loadOrderForContracts(orderId);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    const role = await resolveParticipantRole(order, req);
    if (role === 'forbidden') return res.status(403).json({ error: 'Forbidden' });

    const templates = listContractTemplateDefinitions().map((d) => ({
      id: d.id,
      version: d.version,
      title: d.title,
      description: d.description,
      placeholders: d.placeholders,
    }));
    return res.json({ templates });
  } catch (err: unknown) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/draft-from-template', async (req: AuthRequest, res: Response) => {
  try {
    const orderId = req.params.orderId;
    if (!orderId) return res.status(400).json({ error: 'orderId is required' });
    const order = await loadOrderForContracts(orderId);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    const role = await resolveParticipantRole(order, req);
    if (role === 'invited_provider') {
      return res.status(403).json({
        error: 'Template drafts are available after your workspace is the matched provider.',
        code: 'CONTRACTS_READ_ONLY_UNTIL_MATCHED',
      });
    }
    if (role !== 'provider') return res.status(403).json({ error: 'Only the matched provider can create a template draft' });
    const gate = contractsGate(order);
    if (!gate.ok) {
      return res.status(gate.status).json({ error: gate.message, ...(gate.code ? { code: gate.code } : {}) });
    }

    const templateId = pickStr((req.body as Record<string, unknown>)?.templateId);
    if (!templateId) {
      return res.status(400).json({ error: 'templateId is required' });
    }
    const def = getContractTemplateDefinition(templateId);
    if (!def) {
      return res.status(400).json({ error: 'Unknown templateId', code: 'UNKNOWN_TEMPLATE' });
    }

    const thread = await prisma.orderChatThread.findUnique({
      where: { orderId },
      include: {
        messages: { orderBy: { createdAt: 'desc' }, take: 50, select: { displayText: true } },
      },
    });
    const chatSummary = (thread?.messages ?? [])
      .map((m) => m.displayText)
      .reverse()
      .join('\n---\n');

    const ctx = buildContractTemplateContext(order, chatSummary);
    const rendered = renderContractTemplate(def, ctx);
    const pkg = order.matchedPackage;
    const amount =
      pkg?.finalPrice != null && Number.isFinite(pkg.finalPrice) ? pkg.finalPrice : null;
    const currency = (pkg?.currency ?? 'CAD').toUpperCase();

    const mismatchWarnings = analyzeMismatch({
      chatSummary,
      termsMarkdown: rendered.termsMarkdown,
      scopeSummary: rendered.scopeSummary,
      amount,
    });
    const mismatchWarningsJson = mismatchWarnings.length
      ? (mismatchWarnings as Prisma.InputJsonValue)
      : Prisma.JsonNull;

    const result = await prisma.$transaction(async (tx) => {
      let shell = await tx.orderContract.findUnique({ where: { orderId } });
      if (!shell) {
        shell = await tx.orderContract.create({ data: { orderId } });
      }
      const agg = await tx.contractVersion.aggregate({
        where: { contractId: shell.id },
        _max: { versionNumber: true },
      });
      const nextNum = (agg._max.versionNumber ?? 0) + 1;

      const version = await tx.contractVersion.create({
        data: {
          contractId: shell.id,
          versionNumber: nextNum,
          status: ContractVersionStatus.draft,
          title: rendered.title,
          termsMarkdown: rendered.termsMarkdown,
          policiesMarkdown: rendered.policiesMarkdown || null,
          scopeSummary: rendered.scopeSummary || null,
          amount,
          currency,
          generatedByAi: false,
          generationPrompt: `template:${def.id}`,
          generationContext: {
            templateId: def.id,
            templateVersion: def.version,
            placeholderKeys: Object.keys(ctx),
          } as Prisma.InputJsonValue,
          mismatchWarnings: mismatchWarningsJson,
        },
      });
      return { shell, version };
    });

    return res.status(201).json(result);
  } catch (err: unknown) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:versionId/send', async (req: AuthRequest, res: Response) => {
  try {
    const orderId = req.params.orderId;
    const versionId = req.params.versionId;
    if (!orderId || !versionId) return res.status(400).json({ error: 'orderId and versionId are required' });
    const order = await loadOrderForContracts(orderId);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    const role = await resolveParticipantRole(order, req);
    if (role === 'invited_provider') {
      return res.status(403).json({
        error: 'Sending a contract is available after your workspace is the matched provider.',
        code: 'CONTRACTS_READ_ONLY_UNTIL_MATCHED',
      });
    }
    if (role !== 'provider') return res.status(403).json({ error: 'Only the matched provider can send a draft' });
    const gate = contractsGate(order);
    if (!gate.ok) {
      return res.status(gate.status).json({ error: gate.message, ...(gate.code ? { code: gate.code } : {}) });
    }
    const shell = order.orderContract;
    if (!shell) return res.status(404).json({ error: 'No contract for this order' });

    const uid = req.user!.userId;
    const urole = req.user!.role;

    const updated = await prisma.$transaction(async (tx) => {
      const version = await tx.contractVersion.findFirst({
        where: { id: versionId, contractId: shell.id },
      });
      if (!version) throw Object.assign(new Error('not_found'), { code: 404 });
      if (version.status !== ContractVersionStatus.draft) {
        throw Object.assign(new Error('invalid_state'), { code: 400, msg: 'Only draft versions can be sent' });
      }
      await tx.contractVersion.updateMany({
        where: {
          contractId: shell.id,
          status: ContractVersionStatus.sent,
          id: { not: version.id },
        },
        data: { status: ContractVersionStatus.superseded },
      });
      const v = await tx.contractVersion.update({
        where: { id: version.id },
        data: {
          status: ContractVersionStatus.sent,
          sentById: uid,
          sentAt: new Date(),
        },
      });
      await createContractEvent(tx, {
        contractId: shell.id,
        versionId: v.id,
        actorId: uid,
        actorRole: urole,
        actionType: ContractActionType.provider_sent,
      });
      return v;
    });

    await publish('contracts.sent', {
      orderId,
      contractId: shell.id,
      versionId: updated.id,
    });
    return res.json({ version: updated });
  } catch (err: unknown) {
    const e = err as { code?: number; message?: string; msg?: string };
    if (e?.code === 404) return res.status(404).json({ error: 'Version not found' });
    if (e?.code === 400) return res.status(400).json({ error: e.msg ?? e.message });
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:versionId/approve', async (req: AuthRequest, res: Response) => {
  try {
    const orderId = req.params.orderId;
    const versionId = req.params.versionId;
    if (!orderId || !versionId) return res.status(400).json({ error: 'orderId and versionId are required' });
    const order = await loadOrderForContracts(orderId);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    const role = await resolveParticipantRole(order, req);
    if (role !== 'customer') return res.status(403).json({ error: 'Only the customer can approve' });
    const gate = contractsGate(order);
    if (!gate.ok) {
      return res.status(gate.status).json({ error: gate.message, ...(gate.code ? { code: gate.code } : {}) });
    }
    const shell = order.orderContract;
    if (!shell) return res.status(404).json({ error: 'No contract for this order' });

    const uid = req.user!.userId;
    const urole = req.user!.role;

    const allVersions = await prisma.contractVersion.findMany({
      where: { contractId: shell.id },
    });
    const newestSent = newestSentVersionNumber(allVersions);
    const version = allVersions.find((v) => v.id === versionId);
    if (!version) return res.status(404).json({ error: 'Version not found' });

    if (
      version.status === ContractVersionStatus.approved &&
      shell.currentVersionId === versionId &&
      order.status === OrderStatus.contracted
    ) {
      return res.json({ version, order: { id: order.id, status: order.status, phase: order.phase }, idempotent: true });
    }

    if (version.status !== ContractVersionStatus.sent) {
      return res.status(400).json({ error: 'Only a sent version can be approved' });
    }
    if (newestSent == null || version.versionNumber !== newestSent) {
      return res.status(400).json({ error: 'Only the newest sent version can be approved' });
    }

    const phase = phaseFromStatus(OrderStatus.contracted, order.phase);

    const { version: vOut, order: oOut } = await prisma.$transaction(async (tx) => {
      await tx.contractVersion.updateMany({
        where: {
          contractId: shell.id,
          status: { in: [ContractVersionStatus.sent, ContractVersionStatus.approved] },
          id: { not: version.id },
        },
        data: { status: ContractVersionStatus.superseded },
      });
      const v = await tx.contractVersion.update({
        where: { id: version.id },
        data: {
          status: ContractVersionStatus.approved,
          reviewedById: uid,
          reviewedAt: new Date(),
        },
      });
      await tx.orderContract.update({
        where: { id: shell.id },
        data: { currentVersionId: v.id },
      });
      const o = await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.contracted, phase },
      });
      await createContractEvent(tx, {
        contractId: shell.id,
        versionId: v.id,
        actorId: uid,
        actorRole: urole,
        actionType: ContractActionType.customer_approved,
      });
      return { version: v, order: o };
    });

    await publish('contracts.approved', {
      orderId,
      contractId: shell.id,
      versionId: vOut.id,
    });
    return res.json({ version: vOut, order: oOut });
  } catch (err: unknown) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:versionId/reject', async (req: AuthRequest, res: Response) => {
  try {
    const orderId = req.params.orderId;
    const versionId = req.params.versionId;
    if (!orderId || !versionId) return res.status(400).json({ error: 'orderId and versionId are required' });
    const order = await loadOrderForContracts(orderId);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    const role = await resolveParticipantRole(order, req);
    if (role !== 'customer') return res.status(403).json({ error: 'Only the customer can reject' });
    const gate = contractsGate(order);
    if (!gate.ok) {
      return res.status(gate.status).json({ error: gate.message, ...(gate.code ? { code: gate.code } : {}) });
    }
    const shell = order.orderContract;
    if (!shell) return res.status(404).json({ error: 'No contract for this order' });

    const body = req.body as { note?: unknown; requestEdit?: unknown };
    const note = typeof body.note === 'string' ? body.note : '';
    const requestEdit = Boolean(body.requestEdit);

    const uid = req.user!.userId;
    const urole = req.user!.role;

    const allVersions = await prisma.contractVersion.findMany({ where: { contractId: shell.id } });
    const newestSent = newestSentVersionNumber(allVersions);
    const version = allVersions.find((v) => v.id === versionId);
    if (!version) return res.status(404).json({ error: 'Version not found' });

    if (version.status === ContractVersionStatus.rejected) {
      return res.json({ version, idempotent: true });
    }
    if (version.status !== ContractVersionStatus.sent) {
      return res.status(400).json({ error: 'Only a sent version can be rejected' });
    }
    if (newestSent == null || version.versionNumber !== newestSent) {
      return res.status(400).json({ error: 'Only the newest sent version can be rejected' });
    }

    const action = requestEdit
      ? ContractActionType.customer_requested_edit
      : ContractActionType.customer_rejected;

    const vOut = await prisma.$transaction(async (tx) => {
      const v = await tx.contractVersion.update({
        where: { id: version.id },
        data: {
          status: ContractVersionStatus.rejected,
          reviewedById: uid,
          reviewedAt: new Date(),
          reviewNote: note || null,
        },
      });
      await createContractEvent(tx, {
        contractId: shell.id,
        versionId: v.id,
        actorId: uid,
        actorRole: urole,
        actionType: action,
        note: note || null,
        metadata: { requestEdit } as Prisma.InputJsonValue,
      });
      return v;
    });

    await publish('contracts.rejected', {
      orderId,
      contractId: shell.id,
      versionId: vOut.id,
      requestEdit,
    });
    return res.json({ version: vOut });
  } catch (err: unknown) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:versionId', async (req: AuthRequest, res: Response) => {
  try {
    const orderId = req.params.orderId;
    const versionId = req.params.versionId;
    if (!orderId || !versionId) return res.status(400).json({ error: 'orderId and versionId are required' });
    const order = await loadOrderForContracts(orderId);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    const role = await resolveParticipantRole(order, req);
    if (role === 'forbidden') return res.status(403).json({ error: 'Forbidden' });
    if (role === 'invited_provider') {
      return res.status(403).json({
        error: 'Contract version bodies unlock when your workspace is the matched provider.',
        code: 'CONTRACTS_READ_ONLY_UNTIL_MATCHED',
      });
    }
    const gate = contractsGate(order);
    if (!gate.ok) {
      return res.status(gate.status).json({ error: gate.message, ...(gate.code ? { code: gate.code } : {}) });
    }
    const shell = order.orderContract;
    if (!shell) return res.status(404).json({ error: 'No contract for this order' });
    const version = await prisma.contractVersion.findFirst({
      where: { id: versionId, contractId: shell.id },
    });
    if (!version) return res.status(404).json({ error: 'Version not found' });
    return res.json(version);
  } catch (err: unknown) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:versionId/supersede', async (req: AuthRequest, res: Response) => {
  try {
    const orderId = req.params.orderId;
    const versionId = req.params.versionId;
    if (!orderId || !versionId) return res.status(400).json({ error: 'orderId and versionId are required' });
    const order = await loadOrderForContracts(orderId);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    const role = await resolveParticipantRole(order, req);
    if (role === 'invited_provider') {
      return res.status(403).json({
        error: 'Supersede is available after your workspace is the matched provider.',
        code: 'CONTRACTS_READ_ONLY_UNTIL_MATCHED',
      });
    }
    if (role !== 'provider' && role !== 'admin') {
      return res.status(403).json({ error: 'Only provider or admin can supersede' });
    }
    const gate = contractsGate(order);
    if (!gate.ok) {
      return res.status(gate.status).json({ error: gate.message, ...(gate.code ? { code: gate.code } : {}) });
    }
    const shell = order.orderContract;
    if (!shell) return res.status(404).json({ error: 'No contract for this order' });

    const uid = req.user!.userId;
    const urole = req.user!.role;
    const actionType =
      role === 'admin' ? ContractActionType.admin_override : ContractActionType.provider_superseded;

    const vOut = await prisma.$transaction(async (tx) => {
      const version = await tx.contractVersion.findFirst({
        where: { id: versionId, contractId: shell.id },
      });
      if (!version) throw Object.assign(new Error('nf'), { code: 404 });
      if (
        version.status !== ContractVersionStatus.draft &&
        version.status !== ContractVersionStatus.sent
      ) {
        throw Object.assign(new Error('bad'), { code: 400, msg: 'Only draft or sent versions can be superseded' });
      }
      const v = await tx.contractVersion.update({
        where: { id: version.id },
        data: { status: ContractVersionStatus.superseded },
      });
      await createContractEvent(tx, {
        contractId: shell.id,
        versionId: v.id,
        actorId: uid,
        actorRole: urole,
        actionType,
      });
      return v;
    });

    return res.json({ version: vOut });
  } catch (err: unknown) {
    const e = err as { code?: number; msg?: string };
    if (e?.code === 404) return res.status(404).json({ error: 'Version not found' });
    if (e?.code === 400) return res.status(400).json({ error: e.msg });
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
