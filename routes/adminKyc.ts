import { Router, Response } from 'express';
import type { Prisma } from '@prisma/client';
import { KycStatus, KycSubmissionType, UserRole } from '@prisma/client';
import prisma from '../lib/db.js';
import { authenticate, isAdmin, requireRole, AuthRequest } from '../lib/auth.middleware.js';
import { isBusinessKycFormV1, type BusinessKycFormV1 } from '../lib/kycTypes.js';
import { computeExpiryFlags } from '../lib/kycExpiryFlags.js';
import { runInquiryProvider } from '../lib/kycInquiry/index.js';

const router = Router();
router.use(authenticate, isAdmin);

const KYC_STATUS_VALUES = new Set<string>(Object.values(KycStatus));
const LEVEL0_FILTERS = new Set(['emailMissing', 'phoneMissing', 'addressMissing', 'complete']);

function parsePage(req: AuthRequest): { page: number; pageSize: number; skip: number } {
  const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize ?? '20'), 10) || 20));
  return { page, pageSize, skip: (page - 1) * pageSize };
}

function parseQueryStringArray(v: unknown): string[] {
  if (v == null) return [];
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string');
  if (typeof v === 'string') {
    if (!v.trim()) return [];
    return v.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

function parseJsonRecord(x: unknown): Record<string, unknown> {
  if (x && typeof x === 'object' && !Array.isArray(x)) return x as Record<string, unknown>;
  return {};
}

function legacyKycStatusFromPersonal(status: KycStatus): 'verified' | 'rejected' | 'pending' {
  if (status === KycStatus.approved) return 'verified';
  if (status === KycStatus.rejected) return 'rejected';
  return 'pending';
}

async function mirrorLegacyKycPersonal(
  tx: Prisma.TransactionClient,
  userId: string,
  prismaStatus: KycStatus,
): Promise<void> {
  const legacy = legacyKycStatusFromPersonal(prismaStatus);
  await tx.kYC.upsert({
    where: { userId },
    create: {
      userId,
      type: 'personal',
      status: legacy,
    },
    update: {
      type: 'personal',
      status: legacy,
    },
  });
}

function formFromSchemaJson(raw: unknown): BusinessKycFormV1 | null {
  if (!isBusinessKycFormV1(raw)) return null;
  return raw;
}

function withComputedExpiry(
  submission: {
    schemaVersion: number;
    answers: Prisma.JsonValue;
    expiryFlags: Prisma.JsonValue | null;
  },
  formByVersion: Map<number, BusinessKycFormV1>,
): Record<string, unknown> {
  const form = formByVersion.get(submission.schemaVersion);
  const answers = parseJsonRecord(submission.answers);
  if (!form) return {};
  return computeExpiryFlags(form, answers) as unknown as Record<string, unknown>;
}

// --- Level 0 ---

router.get('/level0', async (req: AuthRequest, res: Response) => {
  try {
    const { skip, pageSize, page } = parsePage(req);
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const filter = typeof req.query.filter === 'string' ? req.query.filter : '';
    if (filter && !LEVEL0_FILTERS.has(filter)) {
      return res.status(400).json({ error: 'Invalid filter' });
    }
    const sortBy = typeof req.query.sortBy === 'string' ? req.query.sortBy : 'lastUpdated';
    const sortDir = req.query.sortDir === 'asc' ? 'asc' : 'desc';

    const userWhere: Prisma.UserWhereInput = {};
    if (q) {
      userWhere.OR = [
        { email: { contains: q, mode: 'insensitive' } },
        { displayName: { contains: q, mode: 'insensitive' } },
        { firstName: { contains: q, mode: 'insensitive' } },
        { lastName: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
      ];
    }

    const orderBy: Prisma.UserOrderByWithRelationInput[] =
      sortBy === 'email'
        ? [{ email: sortDir }]
        : sortBy === 'createdAt'
          ? [{ createdAt: sortDir }]
          : [{ updatedAt: sortDir }];

    type UserWithL0 = Awaited<
      ReturnType<
        typeof prisma.user.findMany<{ include: { kycLevel0Profile: true } }>
      >
    >[number];

    type Level0Row = {
      user: {
        id: string;
        email: string;
        displayName: string | null;
        firstName: string | null;
        lastName: string | null;
        phone: string | null;
        role: UserRole;
        isVerified: boolean;
        address: string | null;
        createdAt: Date;
        updatedAt: Date;
      };
      emailVerified: boolean;
      phoneVerified: boolean;
      address: string | null;
      addressVerified: boolean;
      addressCapturedAt: Date | null;
      adminAcknowledgedAt: Date | null;
      lastUpdated: Date;
    };

    const mapUserRow = (u: UserWithL0) => {
      const p = u.kycLevel0Profile;
      const emailVerified = p?.emailVerifiedAt != null || u.isVerified;
      const phoneVerified = p?.phoneVerifiedAt != null || (!!u.phone && u.phone.length > 0);
      const addressStr = (p?.address ?? u.address ?? '').trim();
      const addressCaptured = addressStr.length > 0;
      const addressVerified = p?.addressVerifiedAt != null;
      const lastUpdated = (() => {
        const a = p?.updatedAt?.getTime() ?? 0;
        const b = u.updatedAt.getTime();
        return new Date(Math.max(a, b));
      })();

      let includeRow = true;
      if (filter === 'emailMissing') includeRow = !emailVerified;
      else if (filter === 'phoneMissing') includeRow = !phoneVerified;
      else if (filter === 'addressMissing') includeRow = !addressCaptured;
      else if (filter === 'complete') includeRow = emailVerified && phoneVerified && addressCaptured;

      return {
        user: {
          id: u.id,
          email: u.email,
          displayName: u.displayName,
          firstName: u.firstName,
          lastName: u.lastName,
          phone: u.phone,
          role: u.role,
          isVerified: u.isVerified,
          address: u.address,
          createdAt: u.createdAt,
          updatedAt: u.updatedAt,
        },
        emailVerified,
        phoneVerified,
        address: addressStr || null,
        addressVerified,
        addressCapturedAt: p?.addressCapturedAt ?? null,
        adminAcknowledgedAt: p?.adminAcknowledgedAt ?? null,
        lastUpdated,
        _include: includeRow,
      };
    };

    let users: Awaited<ReturnType<typeof prisma.user.findMany>>;
    let total: number;
    let rowsOut: Level0Row[];

    if (filter) {
      users = await prisma.user.findMany({
        where: userWhere,
        orderBy,
        include: { kycLevel0Profile: true },
      });
      const mapped = users.map(mapUserRow);
      let filtered = mapped.filter((r) => r._include);
      const dir = sortDir === 'asc' ? 1 : -1;
      if (sortBy === 'lastUpdated') {
        filtered = [...filtered].sort((a, b) => dir * (a.lastUpdated.getTime() - b.lastUpdated.getTime()));
      } else if (sortBy === 'email') {
        filtered = [...filtered].sort((a, b) => dir * a.user.email.localeCompare(b.user.email));
      } else if (sortBy === 'createdAt') {
        filtered = [...filtered].sort((a, b) => dir * (a.user.createdAt.getTime() - b.user.createdAt.getTime()));
      }
      total = filtered.length;
      rowsOut = filtered.slice(skip, skip + pageSize).map(({ _include: _i, ...rest }) => rest);
    } else {
      const [c, pageUsers] = await prisma.$transaction([
        prisma.user.count({ where: userWhere }),
        prisma.user.findMany({
          where: userWhere,
          skip,
          take: pageSize,
          orderBy,
          include: { kycLevel0Profile: true },
        }),
      ]);
      total = c;
      users = pageUsers;
      rowsOut = users.map(mapUserRow).map(({ _include: _i, ...rest }) => rest);
    }

    res.json({
      page,
      pageSize,
      total,
      rows: rowsOut,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

router.post('/level0/:userId/acknowledge', async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const actorId = req.user!.userId;
    const user = await prisma.user.findUnique({ where: { id: userId }, include: { kycLevel0Profile: true } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const prev = user.kycLevel0Profile?.adminAcknowledgedAt ? 'acknowledged' : 'unacknowledged';

    const profile = await prisma.kycLevel0Profile.upsert({
      where: { userId },
      create: {
        userId,
        adminAcknowledgedAt: new Date(),
        adminAcknowledgedBy: actorId,
      },
      update: {
        adminAcknowledgedAt: new Date(),
        adminAcknowledgedBy: actorId,
      },
    });

    await prisma.kycReviewAuditLog.create({
      data: {
        submissionType: KycSubmissionType.level0,
        submissionId: userId,
        actorId,
        fromStatus: prev,
        toStatus: 'acknowledged',
        note: null,
        metadata: { userId },
      },
    });

    res.json({ success: true, profile });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

// --- Personal (Level 1) ---

router.get('/personal', async (req: AuthRequest, res: Response) => {
  try {
    const { skip, pageSize, page } = parsePage(req);
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const sortBy = typeof req.query.sortBy === 'string' ? req.query.sortBy : 'submittedAt';
    const sortDir = req.query.sortDir === 'asc' ? 'asc' : 'desc';
    const userIdFilter = typeof req.query.userId === 'string' ? req.query.userId : '';

    const statusRaw = parseQueryStringArray(req.query.status);
    const statusFilter = (statusRaw.length ? statusRaw : ['pending']) as KycStatus[];
    for (const s of statusFilter) {
      if (!KYC_STATUS_VALUES.has(s)) {
        return res.status(400).json({ error: `Invalid status: ${s}` });
      }
    }

    const aiRec = parseQueryStringArray(req.query.aiRecommendation);
    for (const r of aiRec) {
      if (!['approve', 'reject', 'manual_review'].includes(r)) {
        return res.status(400).json({ error: `Invalid aiRecommendation: ${r}` });
      }
    }

    const where: Prisma.KycPersonalSubmissionWhereInput = {
      status: { in: statusFilter },
    };
    if (userIdFilter) where.userId = userIdFilter;

    if (q) {
      where.OR = [
        { declaredLegalName: { contains: q, mode: 'insensitive' } },
        { user: { email: { contains: q, mode: 'insensitive' } } },
        { user: { displayName: { contains: q, mode: 'insensitive' } } },
        { user: { phone: { contains: q, mode: 'insensitive' } } },
      ];
    }

    if (aiRec.length) {
      where.AND = [
        ...(where.AND ? (Array.isArray(where.AND) ? where.AND : [where.AND]) : []),
        {
          OR: aiRec.map((rec) => ({
            aiAnalysis: { path: ['recommendation'], equals: rec },
          })),
        },
      ];
    }

    const orderKey =
      sortBy === 'status' ? 'status' : sortBy === 'createdAt' ? 'createdAt' : 'submittedAt';
    const orderBy: Prisma.KycPersonalSubmissionOrderByWithRelationInput = {
      [orderKey]: sortDir,
    };

    const [total, items] = await prisma.$transaction([
      prisma.kycPersonalSubmission.count({ where }),
      prisma.kycPersonalSubmission.findMany({
        where,
        skip,
        take: pageSize,
        orderBy,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              displayName: true,
              phone: true,
              isVerified: true,
            },
          },
        },
      }),
    ]);

    res.json({ page, pageSize, total, rows: items });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

router.get('/personal/:id', async (req: AuthRequest, res: Response) => {
  try {
    const row = await prisma.kycPersonalSubmission.findUnique({
      where: { id: req.params.id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            displayName: true,
            firstName: true,
            lastName: true,
            phone: true,
            address: true,
            isVerified: true,
            createdAt: true,
          },
        },
      },
    });
    if (!row) return res.status(404).json({ error: 'Not found' });

    const auditHistory = await prisma.kycReviewAuditLog.findMany({
      where: {
        submissionType: KycSubmissionType.personal,
        submissionId: row.id,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ ...row, auditHistory });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

async function applyPersonalReview(
  submissionId: string,
  actorId: string,
  action: 'approve' | 'reject' | 'request_resubmit',
  note: string | undefined,
): Promise<void> {
  const nextStatus: KycStatus =
    action === 'approve'
      ? KycStatus.approved
      : action === 'reject'
        ? KycStatus.rejected
        : KycStatus.resubmit_requested;

  if (action !== 'approve' && (!note || !String(note).trim())) {
    throw Object.assign(new Error('note is required for this action'), { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    const sub = await tx.kycPersonalSubmission.findUnique({ where: { id: submissionId } });
    if (!sub) throw Object.assign(new Error('Submission not found'), { status: 404 });

    const fromStatus = sub.status;

    await tx.kycPersonalSubmission.update({
      where: { id: submissionId },
      data: {
        status: nextStatus,
        reviewedById: actorId,
        reviewedAt: new Date(),
        reviewNote: note?.trim() ?? null,
      },
    });

    if (action === 'approve') {
      await tx.user.update({
        where: { id: sub.userId },
        data: { isVerified: true },
      });
    }

    await mirrorLegacyKycPersonal(tx, sub.userId, nextStatus);

    await tx.kycReviewAuditLog.create({
      data: {
        submissionType: KycSubmissionType.personal,
        submissionId,
        actorId,
        fromStatus,
        toStatus: nextStatus,
        note: note?.trim() ?? null,
        metadata: { action },
      },
    });

    const title =
      action === 'approve'
        ? 'Identity verified'
        : action === 'reject'
          ? 'Identity verification rejected'
          : 'Resubmit identity documents';
    const message =
      action === 'approve'
        ? 'Your identity verification was approved by an administrator.'
        : action === 'reject'
          ? `Your request was rejected. Notes: ${note?.trim()}`
          : `Please resubmit your documents. Notes: ${note?.trim()}`;

    await tx.notification.create({
      data: {
        userId: sub.userId,
        title,
        message,
        type: 'system',
        link: '/dashboard',
      },
    });
  });
}

router.post('/personal/:id/review', async (req: AuthRequest, res: Response) => {
  try {
    const { action, note } = req.body as { action?: string; note?: string };
    if (action !== 'approve' && action !== 'reject' && action !== 'request_resubmit') {
      return res.status(400).json({ error: 'Invalid action' });
    }
    try {
      await applyPersonalReview(req.params.id, req.user!.userId, action, note);
    } catch (e: unknown) {
      const st = e && typeof e === 'object' && 'status' in e ? (e as { status: number }).status : 500;
      const msg = e instanceof Error ? e.message : String(e);
      if (st === 400) return res.status(400).json({ error: msg });
      if (st === 404) return res.status(404).json({ error: msg });
      throw e;
    }
    const updated = await prisma.kycPersonalSubmission.findUnique({ where: { id: req.params.id } });
    res.json({ success: true, submission: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

router.post(
  '/personal/bulk',
  requireRole('owner', 'platform_admin'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { ids, action, note } = req.body as { ids?: unknown; action?: string; note?: string };
      if (!Array.isArray(ids) || !ids.every((x) => typeof x === 'string')) {
        return res.status(400).json({ error: 'Expected ids: string[]' });
      }
      if (action !== 'approve' && action !== 'reject' && action !== 'request_resubmit') {
        return res.status(400).json({ error: 'Invalid action' });
      }
      for (const id of ids) {
        try {
          await applyPersonalReview(id, req.user!.userId, action, note);
        } catch (e: unknown) {
          const st = e && typeof e === 'object' && 'status' in e ? (e as { status: number }).status : 500;
          const msg = e instanceof Error ? e.message : String(e);
          return res.status(st === 404 ? 404 : 400).json({ error: msg, failedId: id });
        }
      }
      res.json({ success: true, affected: ids.length });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  },
);

// --- Business (Level 2) ---

router.get('/business', async (req: AuthRequest, res: Response) => {
  try {
    const { skip, pageSize, page } = parsePage(req);
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const sortBy = typeof req.query.sortBy === 'string' ? req.query.sortBy : 'submittedAt';
    const sortDir = req.query.sortDir === 'asc' ? 'asc' : 'desc';
    const userIdFilter = typeof req.query.userId === 'string' ? req.query.userId : '';

    const statusRaw = parseQueryStringArray(req.query.status);
    const statusFilter = (statusRaw.length ? statusRaw : ['pending']) as KycStatus[];
    for (const s of statusFilter) {
      if (!KYC_STATUS_VALUES.has(s)) {
        return res.status(400).json({ error: `Invalid status: ${s}` });
      }
    }

    const where: Prisma.BusinessKycSubmissionWhereInput = {
      status: { in: statusFilter },
    };
    if (userIdFilter) where.userId = userIdFilter;
    if (q) {
      where.OR = [
        { user: { email: { contains: q, mode: 'insensitive' } } },
        { user: { displayName: { contains: q, mode: 'insensitive' } } },
        { company: { name: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const orderKey =
      sortBy === 'status' ? 'status' : sortBy === 'createdAt' ? 'createdAt' : 'submittedAt';
    const orderBy: Prisma.BusinessKycSubmissionOrderByWithRelationInput = {
      [orderKey]: sortDir,
    };

    const [total, items] = await prisma.$transaction([
      prisma.businessKycSubmission.count({ where }),
      prisma.businessKycSubmission.findMany({
        where,
        skip,
        take: pageSize,
        orderBy,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              displayName: true,
              phone: true,
            },
          },
          company: {
            select: {
              id: true,
              name: true,
              kycStatus: true,
            },
          },
        },
      }),
    ]);

    const versions = [...new Set(items.map((i) => i.schemaVersion))];
    const schemas = await prisma.businessKycFormSchema.findMany({
      where: { version: { in: versions } },
    });
    const formByVersion = new Map<number, BusinessKycFormV1>();
    for (const s of schemas) {
      const f = formFromSchemaJson(s.schema);
      if (f) formByVersion.set(s.version, f);
    }

    const rows = items.map((item) => ({
      ...item,
      expiryFlags: withComputedExpiry(item, formByVersion),
    }));

    res.json({ page, pageSize, total, rows });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

router.get('/business/:id', async (req: AuthRequest, res: Response) => {
  try {
    const row = await prisma.businessKycSubmission.findUnique({
      where: { id: req.params.id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            displayName: true,
            firstName: true,
            lastName: true,
            phone: true,
            address: true,
            isVerified: true,
          },
        },
        company: true,
      },
    });
    if (!row) return res.status(404).json({ error: 'Not found' });

    const schemaRow = await prisma.businessKycFormSchema.findUnique({
      where: { version: row.schemaVersion },
    });
    const resolvedSchema = schemaRow ? formFromSchemaJson(schemaRow.schema) : null;
    const formByVersion = new Map<number, BusinessKycFormV1>();
    if (resolvedSchema) formByVersion.set(row.schemaVersion, resolvedSchema);

    const auditHistory = await prisma.kycReviewAuditLog.findMany({
      where: {
        submissionType: KycSubmissionType.business,
        submissionId: row.id,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      ...row,
      resolvedSchema,
      expiryFlags: withComputedExpiry(row, formByVersion),
      auditHistory,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

async function applyBusinessReview(
  submissionId: string,
  actorId: string,
  action: 'approve' | 'reject' | 'request_resubmit',
  note: string | undefined,
): Promise<void> {
  const nextStatus: KycStatus =
    action === 'approve'
      ? KycStatus.approved
      : action === 'reject'
        ? KycStatus.rejected
        : KycStatus.resubmit_requested;

  if (action !== 'approve' && (!note || !String(note).trim())) {
    throw Object.assign(new Error('note is required for this action'), { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    const sub = await tx.businessKycSubmission.findUnique({ where: { id: submissionId } });
    if (!sub) throw Object.assign(new Error('Submission not found'), { status: 404 });

    const fromStatus = sub.status;

    await tx.businessKycSubmission.update({
      where: { id: submissionId },
      data: {
        status: nextStatus,
        reviewedById: actorId,
        reviewedAt: new Date(),
        reviewNote: note?.trim() ?? null,
      },
    });

    if (action === 'approve' && sub.companyId) {
      await tx.company.update({
        where: { id: sub.companyId },
        data: { kycStatus: 'verified' },
      });
    }
    if (action === 'reject' && sub.companyId) {
      await tx.company.update({
        where: { id: sub.companyId },
        data: { kycStatus: 'rejected' },
      });
    }
    if (action === 'request_resubmit' && sub.companyId) {
      await tx.company.update({
        where: { id: sub.companyId },
        data: { kycStatus: 'pending' },
      });
    }

    await tx.kycReviewAuditLog.create({
      data: {
        submissionType: KycSubmissionType.business,
        submissionId,
        actorId,
        fromStatus,
        toStatus: nextStatus,
        note: note?.trim() ?? null,
        metadata: { action },
      },
    });

    const title =
      action === 'approve'
        ? 'Business KYC approved'
        : action === 'reject'
          ? 'Business KYC rejected'
          : 'Business KYC documents need correction';
    const message =
      action === 'approve'
        ? 'Your business identity verification was approved.'
        : action === 'reject'
          ? `Rejected. Notes: ${note?.trim()}`
          : `Please correct and resubmit your documents. Notes: ${note?.trim()}`;

    await tx.notification.create({
      data: {
        userId: sub.userId,
        title,
        message,
        type: 'system',
        link: '/dashboard',
      },
    });
  });
}

router.post('/business/:id/review', async (req: AuthRequest, res: Response) => {
  try {
    const { action, note } = req.body as { action?: string; note?: string };
    if (action !== 'approve' && action !== 'reject' && action !== 'request_resubmit') {
      return res.status(400).json({ error: 'Invalid action' });
    }
    try {
      await applyBusinessReview(req.params.id, req.user!.userId, action, note);
    } catch (e: unknown) {
      const st = e && typeof e === 'object' && 'status' in e ? (e as { status: number }).status : 500;
      const msg = e instanceof Error ? e.message : String(e);
      if (st === 400) return res.status(400).json({ error: msg });
      if (st === 404) return res.status(404).json({ error: msg });
      throw e;
    }
    const updated = await prisma.businessKycSubmission.findUnique({ where: { id: req.params.id } });
    res.json({ success: true, submission: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

router.post('/business/:id/run-inquiries', async (req: AuthRequest, res: Response) => {
  try {
    const row = await prisma.businessKycSubmission.findUnique({ where: { id: req.params.id } });
    if (!row) return res.status(404).json({ error: 'Not found' });

    const schemaRow = await prisma.businessKycFormSchema.findUnique({
      where: { version: row.schemaVersion },
    });
    if (!schemaRow) return res.status(400).json({ error: 'Schema version not found' });
    const form = formFromSchemaJson(schemaRow.schema);
    if (!form) return res.status(400).json({ error: 'Invalid stored form schema' });

    const answers = parseJsonRecord(row.answers);
    const existing = parseJsonRecord(row.inquiryResults) as Record<string, Record<string, unknown>>;

    const next: Record<string, Record<string, unknown>> = { ...existing };

    for (const field of form.fields) {
      if (!field.inquiry) continue;
      const ctx = {
        answers,
        payloadFieldIds: field.inquiry.payloadFields,
      };
      const result = await runInquiryProvider(field.inquiry.providerKey, ctx);
      next[field.id] = result as unknown as Record<string, unknown>;
    }

    const updated = await prisma.businessKycSubmission.update({
      where: { id: row.id },
      data: { inquiryResults: next as unknown as Prisma.InputJsonValue },
    });

    res.json({ success: true, submission: updated, inquiryResults: next });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

router.post(
  '/business/bulk',
  requireRole('owner', 'platform_admin'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { ids, action, note } = req.body as { ids?: unknown; action?: string; note?: string };
      if (!Array.isArray(ids) || !ids.every((x) => typeof x === 'string')) {
        return res.status(400).json({ error: 'Expected ids: string[]' });
      }
      if (action !== 'approve' && action !== 'reject' && action !== 'request_resubmit') {
        return res.status(400).json({ error: 'Invalid action' });
      }
      for (const id of ids) {
        try {
          await applyBusinessReview(id, req.user!.userId, action, note);
        } catch (e: unknown) {
          const st = e && typeof e === 'object' && 'status' in e ? (e as { status: number }).status : 500;
          const msg = e instanceof Error ? e.message : String(e);
          return res.status(st === 404 ? 404 : 400).json({ error: msg, failedId: id });
        }
      }
      res.json({ success: true, affected: ids.length });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  },
);

// --- Form schemas ---

router.get('/form-schemas', async (_req: AuthRequest, res: Response) => {
  try {
    const rows = await prisma.businessKycFormSchema.findMany({
      orderBy: [{ isActive: 'desc' }, { version: 'desc' }],
    });
    res.json({ rows });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

router.get('/form-schemas/active', async (_req: AuthRequest, res: Response) => {
  try {
    const row = await prisma.businessKycFormSchema.findFirst({
      where: { isActive: true },
      orderBy: { version: 'desc' },
    });
    if (!row) return res.status(404).json({ error: 'No active schema' });
    res.json(row);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

router.post('/form-schemas', async (req: AuthRequest, res: Response) => {
  try {
    const { schema, description } = req.body as { schema?: unknown; description?: string };
    if (!isBusinessKycFormV1(schema)) {
      return res.status(400).json({ error: 'Invalid BusinessKycFormV1 schema' });
    }
    if (description !== undefined && typeof description !== 'string') {
      return res.status(400).json({ error: 'description must be a string' });
    }

    const agg = await prisma.businessKycFormSchema.aggregate({ _max: { version: true } });
    const nextVersion = (agg._max.version ?? 0) + 1;

    const row = await prisma.businessKycFormSchema.create({
      data: {
        version: nextVersion,
        isActive: false,
        schema: schema as unknown as Prisma.InputJsonValue,
        description: description?.trim() || null,
      },
    });
    res.status(201).json(row);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

router.put('/form-schemas/:id', async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.businessKycFormSchema.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (existing.isActive) {
      return res.status(400).json({ error: 'Cannot edit an active schema' });
    }

    const { schema, description } = req.body as { schema?: unknown; description?: unknown };
    const data: Prisma.BusinessKycFormSchemaUpdateInput = {};
    if (schema !== undefined) {
      if (!isBusinessKycFormV1(schema)) {
        return res.status(400).json({ error: 'Invalid BusinessKycFormV1 schema' });
      }
      data.schema = schema as unknown as Prisma.InputJsonValue;
    }
    if (description !== undefined) {
      if (description !== null && typeof description !== 'string') {
        return res.status(400).json({ error: 'description must be string or null' });
      }
      data.description = description;
    }

    const row = await prisma.businessKycFormSchema.update({
      where: { id: req.params.id },
      data,
    });
    res.json(row);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

router.post(
  '/form-schemas/:id/publish',
  requireRole('owner', 'platform_admin'),
  async (req: AuthRequest, res: Response) => {
    try {
      const actorId = req.user!.userId;
      const row = await prisma.businessKycFormSchema.findUnique({ where: { id: req.params.id } });
      if (!row) return res.status(404).json({ error: 'Not found' });

      await prisma.$transaction([
        prisma.businessKycFormSchema.updateMany({ data: { isActive: false } }),
        prisma.businessKycFormSchema.update({
          where: { id: row.id },
          data: {
            isActive: true,
            publishedAt: new Date(),
            publishedById: actorId,
          },
        }),
      ]);

      const updated = await prisma.businessKycFormSchema.findUnique({ where: { id: row.id } });
      res.json({ success: true, schema: updated });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  },
);

router.delete(
  '/form-schemas/:id',
  requireRole('owner', 'platform_admin'),
  async (req: AuthRequest, res: Response) => {
    try {
      const row = await prisma.businessKycFormSchema.findUnique({ where: { id: req.params.id } });
      if (!row) return res.status(404).json({ error: 'Not found' });
      if (row.isActive) {
        return res.status(400).json({ error: 'Cannot delete active schema' });
      }
      const refCount = await prisma.businessKycSubmission.count({
        where: { schemaVersion: row.version },
      });
      if (refCount > 0) {
        return res.status(400).json({ error: 'Schema version is referenced by submissions' });
      }
      await prisma.businessKycFormSchema.delete({ where: { id: row.id } });
      res.json({ success: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  },
);

// --- Trust Score ---

router.get('/business/:id/trust-score', async (req: AuthRequest, res: Response) => {
  try {
    const row = await prisma.businessKycSubmission.findUnique({
      where: { id: req.params.id },
      select: { companyId: true },
    });
    if (!row) return res.status(404).json({ error: 'Submission not found' });
    if (!row.companyId) return res.status(400).json({ error: 'No company associated with this submission' });

    const trustScore = await prisma.businessTrustScore.findUnique({
      where: { workspaceId: row.companyId },
    });

    const businessVerification = await prisma.businessVerification.findUnique({
      where: { workspaceId: row.companyId },
    });

    res.json({
      trustScore,
      businessVerification,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

router.put('/business/:id/trust-score', async (req: AuthRequest, res: Response) => {
  try {
    const row = await prisma.businessKycSubmission.findUnique({
      where: { id: req.params.id },
      select: { companyId: true },
    });
    if (!row) return res.status(404).json({ error: 'Submission not found' });
    if (!row.companyId) return res.status(400).json({ error: 'No company associated with this submission' });

    const { kycVerified, licenseVerified, insuranceVerified, avgRating } = req.body as {
      kycVerified?: boolean;
      licenseVerified?: boolean;
      insuranceVerified?: boolean;
      avgRating?: number;
    };

    const data: Record<string, unknown> = {};
    if (kycVerified !== undefined) data.kycVerified = kycVerified;
    if (licenseVerified !== undefined) data.licenseVerified = licenseVerified;
    if (insuranceVerified !== undefined) data.insuranceVerified = insuranceVerified;
    if (avgRating !== undefined) data.avgRating = avgRating;

    // Calculate totalScore
    const kycVal = (data.kycVerified as boolean) ?? false;
    const licVal = (data.licenseVerified as boolean) ?? false;
    const insVal = (data.insuranceVerified as boolean) ?? false;
    const ratingVal = (data.avgRating as number) ?? 0;

    const totalScore = (kycVal ? 30 : 0) + (licVal ? 25 : 0) + (insVal ? 25 : 0) + Math.round((ratingVal / 5) * 20);
    data.totalScore = totalScore;

    const updated = await prisma.businessTrustScore.upsert({
      where: { workspaceId: row.companyId },
      update: data as Prisma.BusinessTrustScoreUpdateInput,
      create: {
        workspaceId: row.companyId,
        kycVerified: kycVerified ?? false,
        licenseVerified: licenseVerified ?? false,
        insuranceVerified: insuranceVerified ?? false,
        avgRating: avgRating ?? 0,
        totalScore,
      },
    });

    res.json({ success: true, trustScore: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

// --- Audit ---

router.get('/audit', async (req: AuthRequest, res: Response) => {
  try {
    const submissionType = typeof req.query.submissionType === 'string' ? req.query.submissionType : '';
    const submissionId = typeof req.query.submissionId === 'string' ? req.query.submissionId : '';
    const actorId = typeof req.query.actorId === 'string' ? req.query.actorId : '';
    const from = typeof req.query.from === 'string' ? req.query.from : '';
    const to = typeof req.query.to === 'string' ? req.query.to : '';

    const where: Prisma.KycReviewAuditLogWhereInput = {};
    if (submissionType) {
      if (!['level0', 'personal', 'business'].includes(submissionType)) {
        return res.status(400).json({ error: 'Invalid submissionType' });
      }
      where.submissionType = submissionType as KycSubmissionType;
    }
    if (submissionId) where.submissionId = submissionId;
    if (actorId) where.actorId = actorId;
    if (from || to) {
      where.createdAt = {};
      if (from) {
        const d = new Date(from);
        if (Number.isNaN(d.getTime())) return res.status(400).json({ error: 'Invalid from date' });
        where.createdAt.gte = d;
      }
      if (to) {
        const d = new Date(to);
        if (Number.isNaN(d.getTime())) return res.status(400).json({ error: 'Invalid to date' });
        where.createdAt.lte = d;
      }
    }

    const { skip, pageSize, page } = parsePage(req);
    const [total, rows] = await prisma.$transaction([
      prisma.kycReviewAuditLog.count({ where }),
      prisma.kycReviewAuditLog.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    res.json({ page, pageSize, total, rows });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

export default router;
