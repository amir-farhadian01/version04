import { Router, Response } from 'express';
import {
  ContractActionType,
  ContractVersionStatus,
  Prisma,
} from '@prisma/client';
import prisma from '../lib/db.js';
import { authenticate, isAdmin, AuthRequest } from '../lib/auth.middleware.js';
import { createContractEvent } from '../lib/contractEvents.js';

const router = Router();

router.use(authenticate, isAdmin);

function pickStr(v: unknown): string | undefined {
  if (typeof v === 'string' && v.trim()) return v.trim();
  return undefined;
}

function parseVersionStatuses(q: AuthRequest['query']): ContractVersionStatus[] | undefined {
  const raw = pickStr(q.versionStatus);
  if (!raw) return undefined;
  const allowed = new Set(Object.values(ContractVersionStatus));
  const parts = raw.split(',').map((s) => s.trim().toLowerCase());
  const out = parts.filter((s): s is ContractVersionStatus => allowed.has(s as ContractVersionStatus));
  return out.length ? (out as ContractVersionStatus[]) : undefined;
}

function parseAttention(q: AuthRequest['query']): boolean {
  return pickStr(q.attention) === '1' || pickStr(q.attention) === 'true';
}

function orderSearchWhere(q: string): Prisma.OrderWhereInput {
  return {
    OR: [
      { id: { contains: q, mode: 'insensitive' } },
      {
        customer: {
          OR: [
            { email: { contains: q, mode: 'insensitive' } },
            { firstName: { contains: q, mode: 'insensitive' } },
            { lastName: { contains: q, mode: 'insensitive' } },
            { displayName: { contains: q, mode: 'insensitive' } },
          ],
        },
      },
      {
        matchedProvider: {
          OR: [
            { email: { contains: q, mode: 'insensitive' } },
            { firstName: { contains: q, mode: 'insensitive' } },
            { lastName: { contains: q, mode: 'insensitive' } },
            { displayName: { contains: q, mode: 'insensitive' } },
          ],
        },
      },
    ],
  };
}

router.get('/queue', async (req: AuthRequest, res: Response) => {
  try {
    const workspaceId = pickStr(req.query.workspaceId);
    const search = pickStr(req.query.q);
    const dateFrom = pickStr(req.query.dateFrom) ? new Date(String(req.query.dateFrom)) : undefined;
    const dateTo = pickStr(req.query.dateTo) ? new Date(String(req.query.dateTo)) : undefined;
    const dateOkFrom = dateFrom && !Number.isNaN(dateFrom.getTime());
    const dateOkTo = dateTo && !Number.isNaN(dateTo.getTime());

    const attention = parseAttention(req.query);
    const versionStatuses = parseVersionStatuses(req.query);

    const versionSome: Prisma.ContractVersionWhereInput = {
      ...(versionStatuses?.length ? { status: { in: versionStatuses } } : {}),
      ...(attention && !versionStatuses?.length
        ? { status: { in: [ContractVersionStatus.sent, ContractVersionStatus.rejected] } }
        : {}),
      ...(dateOkFrom || dateOkTo
        ? {
            updatedAt: {
              ...(dateOkFrom ? { gte: dateFrom } : {}),
              ...(dateOkTo ? { lte: dateTo } : {}),
            },
          }
        : {}),
    };

    const needsVersionSome =
      attention || Boolean(versionStatuses?.length) || dateOkFrom || dateOkTo;

    const orderAnd: Prisma.OrderWhereInput[] = [];
    if (workspaceId) orderAnd.push({ matchedWorkspaceId: workspaceId });
    if (search) orderAnd.push(orderSearchWhere(search));

    const where: Prisma.OrderContractWhereInput = {
      ...(orderAnd.length ? { order: orderAnd.length === 1 ? orderAnd[0]! : { AND: orderAnd } } : {}),
      ...(needsVersionSome ? { versions: { some: versionSome } } : {}),
    };

    const contracts = await prisma.orderContract.findMany({
      where,
      take: 300,
      orderBy: { updatedAt: 'desc' },
      include: {
        currentVersion: true,
        order: {
          select: {
            id: true,
            status: true,
            phase: true,
            matchedWorkspaceId: true,
            matchedProviderId: true,
            customer: {
              select: { id: true, email: true, displayName: true, firstName: true, lastName: true },
            },
            matchedProvider: {
              select: { id: true, email: true, displayName: true, firstName: true, lastName: true },
            },
            matchedWorkspace: { select: { id: true, name: true } },
            matchedPackage: { select: { id: true, name: true, finalPrice: true, currency: true } },
          },
        },
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 20,
        },
      },
    });

    return res.json({ items: contracts });
  } catch (err: unknown) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/** Read-only contract + versions for an order (admin order drawer). */
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const orderId = pickStr(req.query.orderId);
    if (!orderId) {
      return res.status(400).json({ error: 'orderId query parameter is required' });
    }
    const row = await prisma.orderContract.findUnique({
      where: { orderId },
      include: {
        versions: { orderBy: { versionNumber: 'desc' } },
      },
    });
    if (!row) {
      return res.json({ contract: null, versions: [] });
    }
    return res.json({
      contract: {
        id: row.id,
        orderId: row.orderId,
        currentVersionId: row.currentVersionId,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      },
      versions: row.versions.map((v) => ({
        id: v.id,
        contractId: v.contractId,
        versionNumber: v.versionNumber,
        status: v.status,
        title: v.title,
        termsMarkdown: v.termsMarkdown,
        policiesMarkdown: v.policiesMarkdown,
        scopeSummary: v.scopeSummary,
        startDate: v.startDate?.toISOString() ?? null,
        endDate: v.endDate?.toISOString() ?? null,
        amount: v.amount,
        currency: v.currency,
        createdAt: v.createdAt.toISOString(),
        updatedAt: v.updatedAt.toISOString(),
      })),
    });
  } catch (err: unknown) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

const userSelectForContractParty = {
  id: true,
  email: true,
  displayName: true,
  firstName: true,
  lastName: true,
} as const;

async function attachSentByToVersions<T extends { versions: { sentById: string | null }[] }>(row: T): Promise<
  T & {
    versions: (T['versions'][number] & {
      sentBy: {
        id: string;
        email: string;
        displayName: string | null;
        firstName: string | null;
        lastName: string | null;
      } | null;
    })[];
  }
> {
  const sentIds = [...new Set(row.versions.map((v) => v.sentById).filter((id): id is string => Boolean(id)))];
  if (!sentIds.length) {
    return { ...row, versions: row.versions.map((v) => ({ ...v, sentBy: null })) };
  }
  const senders = await prisma.user.findMany({
    where: { id: { in: sentIds } },
    select: userSelectForContractParty,
  });
  const byId = Object.fromEntries(senders.map((u) => [u.id, u]));
  return {
    ...row,
    versions: row.versions.map((v) => ({
      ...v,
      sentBy: v.sentById ? (byId[v.sentById] ?? null) : null,
    })),
  };
}

router.get('/:contractId', async (req: AuthRequest, res: Response) => {
  try {
    const { contractId } = req.params;
    if (!contractId) return res.status(400).json({ error: 'contractId is required' });
    const row = await prisma.orderContract.findUnique({
      where: { id: contractId },
      include: {
        currentVersion: true,
        versions: { orderBy: { versionNumber: 'asc' } },
        events: { orderBy: { createdAt: 'desc' }, take: 300 },
        order: {
          select: {
            id: true,
            status: true,
            phase: true,
            description: true,
            matchedWorkspaceId: true,
            matchedProviderId: true,
            customer: {
              select: { id: true, email: true, displayName: true, firstName: true, lastName: true },
            },
            matchedProvider: {
              select: { id: true, email: true, displayName: true, firstName: true, lastName: true },
            },
            matchedWorkspace: { select: { id: true, name: true } },
            matchedPackage: { select: { id: true, name: true, finalPrice: true, currency: true } },
          },
        },
      },
    });
    if (!row) return res.status(404).json({ error: 'Contract not found' });
    const withSenders = await attachSentByToVersions(row);
    return res.json(withSenders);
  } catch (err: unknown) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

async function handleMarkContractReviewed(req: AuthRequest, res: Response) {
  try {
    const { contractId } = req.params;
    const uid = req.user!.userId;
    const role = req.user!.role;
    const exists = await prisma.orderContract.findUnique({ where: { id: contractId }, select: { id: true } });
    if (!exists) return res.status(404).json({ error: 'Contract not found' });

    await prisma.$transaction(async (tx) => {
      await tx.orderContract.update({
        where: { id: contractId },
        data: { adminLastReviewAt: new Date(), adminLastReviewById: uid },
      });
      await createContractEvent(tx, {
        contractId,
        versionId: null,
        actorId: uid,
        actorRole: role,
        actionType: ContractActionType.admin_marked_reviewed,
      });
    });
    const row = await prisma.orderContract.findUnique({
      where: { id: contractId },
      include: { currentVersion: true, order: { select: { id: true, status: true } } },
    });
    return res.json({ contract: row });
  } catch (err: unknown) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

router.post('/:contractId/mark-reviewed', handleMarkContractReviewed);
/** Alias for admin UI / integrations expecting `/reviewed`. */
router.post('/:contractId/reviewed', handleMarkContractReviewed);

router.post('/:contractId/override-supersede', async (req: AuthRequest, res: Response) => {
  try {
    const { contractId } = req.params;
    const body = req.body as { versionId?: unknown };
    const versionId = typeof body.versionId === 'string' ? body.versionId.trim() : '';
    if (!versionId) return res.status(400).json({ error: 'versionId is required' });
    const uid = req.user!.userId;
    const role = req.user!.role;

    const updated = await prisma.$transaction(async (tx) => {
      const version = await tx.contractVersion.findFirst({
        where: { id: versionId, contractId },
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
        contractId,
        versionId: v.id,
        actorId: uid,
        actorRole: role,
        actionType: ContractActionType.admin_override,
        metadata: { kind: 'supersede', versionId: v.id } as Prisma.InputJsonValue,
      });
      return v;
    });
    return res.json({ version: updated });
  } catch (err: unknown) {
    const e = err as { code?: number; msg?: string };
    if (e?.code === 404) return res.status(404).json({ error: 'Version not found' });
    if (e?.code === 400) return res.status(400).json({ error: e.msg });
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

async function handleContractInternalNote(req: AuthRequest, res: Response) {
  try {
    const { contractId } = req.params;
    const body = req.body as { note?: unknown };
    const note = typeof body.note === 'string' ? body.note.trim() : '';
    if (note.length < 3) return res.status(400).json({ error: 'note must be at least 3 characters' });
    const uid = req.user!.userId;
    const role = req.user!.role;

    const exists = await prisma.orderContract.findUnique({ where: { id: contractId }, select: { id: true } });
    if (!exists) return res.status(404).json({ error: 'Contract not found' });

    await prisma.$transaction(async (tx) => {
      await createContractEvent(tx, {
        contractId,
        versionId: null,
        actorId: uid,
        actorRole: role,
        actionType: ContractActionType.admin_internal_note,
        note,
      });
    });
    const events = await prisma.contractEvent.findMany({
      where: { contractId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return res.json({ events });
  } catch (err: unknown) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

router.post('/:contractId/internal-note', handleContractInternalNote);
/** Alias for admin UI / integrations expecting `/note`. */
router.post('/:contractId/note', handleContractInternalNote);

export default router;
