import { Router, Response } from 'express';
import { KycStatus, KycSubmissionType } from '@prisma/client';
import prisma from '../lib/db.js';
import { authenticate, AuthRequest } from '../lib/auth.middleware.js';
import { publish } from '../lib/bus.js';
import { isBusinessKycFormV1, type BusinessKycFormV1 } from '../lib/kycTypes.js';
import { validateBusinessKycAnswers, type BusinessKycUploadRow } from '../lib/kycBusinessValidate.js';
import { computeExpiryFlags } from '../lib/kycExpiryFlags.js';
import { mirrorLegacyKycPersonalPending } from '../lib/kycLegacyPersonal.js';

const router = Router();
router.use(authenticate);

function parseJsonRecord(x: unknown): Record<string, unknown> {
  if (x && typeof x === 'object' && !Array.isArray(x)) return x as Record<string, unknown>;
  return {};
}

async function loadLevel0(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isVerified: true, phone: true, address: true },
  });
  const profile = await prisma.kycLevel0Profile.findUnique({ where: { userId } });
  const emailVerified = user?.isVerified ?? false;
  const phoneVerified = profile?.phoneVerifiedAt != null || (!!user?.phone && user.phone.length > 0);
  const addressStr = (profile?.address ?? user?.address ?? '').trim();
  const address = addressStr.length > 0 ? addressStr : null;
  const addressCapturedAt = profile?.addressCapturedAt ?? null;
  const complete = emailVerified && phoneVerified && !!address;
  return { emailVerified, phoneVerified, address, addressCapturedAt, complete, user, profile };
}

// --- Level 0 ---

const level0 = Router();

level0.get('/me', async (req: AuthRequest, res: Response) => {
  try {
    const s = await loadLevel0(req.user!.userId);
    res.json({
      emailVerified: s.emailVerified,
      phoneVerified: s.phoneVerified,
      address: s.address,
      addressCapturedAt: s.addressCapturedAt?.toISOString() ?? null,
      complete: s.complete,
    });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Error' });
  }
});

level0.post('/address', async (req: AuthRequest, res: Response) => {
  try {
    const { address } = req.body as { address?: string };
    if (typeof address !== 'string' || !address.trim()) {
      return res.status(400).json({ error: 'address is required' });
    }
    const trimmed = address.trim();
    if (trimmed.length < 5 || trimmed.length > 300) {
      return res.status(400).json({ error: 'address must be 5–300 characters' });
    }
    const now = new Date();
    const userId = req.user!.userId;
    await prisma.$transaction([
      prisma.kycLevel0Profile.upsert({
        where: { userId },
        create: {
          userId,
          address: trimmed,
          addressCapturedAt: now,
        },
        update: {
          address: trimmed,
          addressCapturedAt: now,
        },
      }),
      prisma.user.update({
        where: { id: userId },
        data: { address: trimmed },
      }),
    ]);
    res.json({ ok: true });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Error' });
  }
});

level0.post('/verify-email/start', async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { isVerified: true },
    });
    if (user?.isVerified) {
      return res.json({ success: true, message: 'Email is already verified.', alreadyVerified: true });
    }
    const verificationToken = `${Date.now()}-${Math.random().toString(36).substring(2)}`;
    res.json({
      success: true,
      message: 'Verification started.',
      token: process.env.NODE_ENV !== 'production' ? verificationToken : undefined,
    });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Error' });
  }
});

level0.post('/verify-email/confirm', async (req: AuthRequest, res: Response) => {
  try {
    const { token } = req.body as { token?: string };
    if (typeof token !== 'string' || !token.trim()) {
      return res.status(400).json({ error: 'token is required' });
    }
    const userId = req.user!.userId;
    const now = new Date();
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { isVerified: true },
      }),
      prisma.kycLevel0Profile.upsert({
        where: { userId },
        create: { userId, emailVerifiedAt: now },
        update: { emailVerifiedAt: now },
      }),
    ]);
    res.json({ success: true });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Error' });
  }
});

level0.post('/verify-phone/start', async (_req: AuthRequest, res: Response) => {
  try {
    res.json({ success: true, message: 'Code sent.', debugCode: '123456' });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Error' });
  }
});

level0.post('/verify-phone/confirm', async (req: AuthRequest, res: Response) => {
  try {
    const { code } = req.body as { code?: string };
    if (typeof code !== 'string' || !/^\d{6}$/.test(code)) {
      return res.status(400).json({ error: '6-digit code required' });
    }
    const isDev = process.env.NODE_ENV !== 'production';
    if (!isDev && code !== '123456') {
      return res.status(400).json({ error: 'Invalid code' });
    }
    const userId = req.user!.userId;
    const now = new Date();
    await prisma.kycLevel0Profile.upsert({
      where: { userId },
      create: { userId, phoneVerifiedAt: now },
      update: { phoneVerifiedAt: now },
    });
    res.json({ success: true });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Error' });
  }
});

router.use('/level0', level0);

// --- Personal ---

const personal = Router();

function personalRowToJson(row: {
  id: string;
  declaredAddress: string | null;
  declaredLegalName: string;
  idDocumentType: string;
  idDocumentNumber: string | null;
  idFrontUrl: string;
  idBackUrl: string | null;
  selfieUrl: string;
  aiAnalysis: unknown;
  status: KycStatus;
  submittedAt: Date;
  reviewedAt: Date | null;
  reviewNote: string | null;
  reviewedById: string | null;
}) {
  return {
    id: row.id,
    declaredAddress: row.declaredAddress,
    declaredLegalName: row.declaredLegalName,
    idDocumentType: row.idDocumentType,
    idDocumentNumber: row.idDocumentNumber,
    idFrontUrl: row.idFrontUrl,
    idBackUrl: row.idBackUrl,
    selfieUrl: row.selfieUrl,
    aiAnalysis: row.aiAnalysis,
    status: row.status,
    submittedAt: row.submittedAt.toISOString(),
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    reviewNote: row.reviewNote,
    reviewedById: row.reviewedById,
  };
}

personal.get('/me', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const l0 = await loadLevel0(userId);
    const latest = await prisma.kycPersonalSubmission.findFirst({
      where: { userId },
      orderBy: { submittedAt: 'desc' },
    });
    const open =
      latest &&
      (latest.status === KycStatus.pending || latest.status === KycStatus.resubmit_requested);
    const canSubmit = l0.complete && !open;

    if (!latest) {
      return res.json({ submission: null, canSubmit });
    }

    res.json({
      submission: personalRowToJson(latest),
      canSubmit,
    });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Error' });
  }
});

const DOC_TYPES = new Set(['national_id', 'passport', 'drivers_license']);

function validatePersonalBody(body: unknown): string | null {
  if (!body || typeof body !== 'object') return 'Invalid body';
  const b = body as Record<string, unknown>;
  if (typeof b.declaredLegalName !== 'string' || b.declaredLegalName.trim().length < 2 || b.declaredLegalName.length > 120) {
    return 'declaredLegalName must be 2–120 characters';
  }
  if (typeof b.idDocumentType !== 'string' || !DOC_TYPES.has(b.idDocumentType)) {
    return 'invalid idDocumentType';
  }
  if (b.idDocumentNumber !== undefined && b.idDocumentNumber !== null && typeof b.idDocumentNumber !== 'string') {
    return 'idDocumentNumber must be string';
  }
  if (typeof b.idFrontUrl !== 'string' || !b.idFrontUrl.trim()) return 'idFrontUrl required';
  if (typeof b.selfieUrl !== 'string' || !b.selfieUrl.trim()) return 'selfieUrl required';
  if (b.idBackUrl !== undefined && b.idBackUrl !== null && typeof b.idBackUrl !== 'string') {
    return 'idBackUrl must be string';
  }
  if (b.idDocumentType === 'national_id') {
    if (typeof b.idBackUrl !== 'string' || !b.idBackUrl.trim()) {
      return 'idBackUrl required for national_id';
    }
  }
  return null;
}

async function createPersonalSubmission(
  userId: string,
  body: Record<string, unknown>,
  declaredAddress: string | null,
): Promise<{ id: string }> {
  const declaredLegalName = String(body.declaredLegalName).trim();
  const idDocumentType = String(body.idDocumentType);
  const idDocumentNumber =
    body.idDocumentNumber != null && String(body.idDocumentNumber).trim()
      ? String(body.idDocumentNumber).trim()
      : null;
  const idFrontUrl = String(body.idFrontUrl).trim();
  const idBackUrl =
    body.idBackUrl != null && String(body.idBackUrl).trim() ? String(body.idBackUrl).trim() : null;
  const selfieUrl = String(body.selfieUrl).trim();

  let aiAnalysis: unknown = undefined;
  if (body.aiAnalysis !== undefined) {
    aiAnalysis = body.aiAnalysis as unknown;
  }

  const sub = await prisma.kycPersonalSubmission.create({
    data: {
      userId,
      declaredAddress,
      declaredLegalName,
      idDocumentType,
      idDocumentNumber,
      idFrontUrl,
      idBackUrl,
      selfieUrl,
      aiAnalysis: aiAnalysis as object | undefined,
      status: KycStatus.pending,
    },
  });

  await prisma.kycReviewAuditLog.create({
    data: {
      submissionType: KycSubmissionType.personal,
      submissionId: sub.id,
      actorId: userId,
      fromStatus: null,
      toStatus: KycStatus.pending,
    },
  });

  await publish('kyc.personal.submitted', { userId, submissionId: sub.id });
  await mirrorLegacyKycPersonalPending(userId, idDocumentType);

  return { id: sub.id };
}

personal.post('/submit', async (req: AuthRequest, res: Response) => {
  try {
    const errMsg = validatePersonalBody(req.body);
    if (errMsg) return res.status(400).json({ error: errMsg });

    const userId = req.user!.userId;
    const l0 = await loadLevel0(userId);
    if (!l0.complete) {
      return res.status(400).json({ error: 'Complete Level 0 before submitting personal KYC' });
    }

    const pending = await prisma.kycPersonalSubmission.findFirst({
      where: { userId, status: KycStatus.pending },
    });
    if (pending) {
      return res.status(409).json({ error: 'A submission is already pending review' });
    }

    const latest = await prisma.kycPersonalSubmission.findFirst({
      where: { userId },
      orderBy: { submittedAt: 'desc' },
    });
    if (latest?.status === KycStatus.resubmit_requested || latest?.status === KycStatus.rejected) {
      return res.status(400).json({ error: 'Use POST /api/kyc/v2/personal/resubmit' });
    }
    if (latest?.status === KycStatus.approved) {
      return res.status(400).json({ error: 'Already approved' });
    }

    const declaredAddress = l0.address;
    const { id } = await createPersonalSubmission(userId, req.body as Record<string, unknown>, declaredAddress);
    res.status(201).json({ id, status: 'pending' });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Error' });
  }
});

personal.post('/resubmit', async (req: AuthRequest, res: Response) => {
  try {
    const errMsg = validatePersonalBody(req.body);
    if (errMsg) return res.status(400).json({ error: errMsg });

    const userId = req.user!.userId;
    const l0 = await loadLevel0(userId);
    if (!l0.complete) {
      return res.status(400).json({ error: 'Complete Level 0 before submitting personal KYC' });
    }

    const latest = await prisma.kycPersonalSubmission.findFirst({
      where: { userId },
      orderBy: { submittedAt: 'desc' },
    });
    if (!latest || (latest.status !== KycStatus.rejected && latest.status !== KycStatus.resubmit_requested)) {
      return res.status(400).json({ error: 'No rejected or resubmit_requested submission to supersede' });
    }

    const pending = await prisma.kycPersonalSubmission.findFirst({
      where: { userId, status: KycStatus.pending },
    });
    if (pending) {
      return res.status(409).json({ error: 'A submission is already pending review' });
    }

    const declaredAddress = l0.address;
    const { id } = await createPersonalSubmission(userId, req.body as Record<string, unknown>, declaredAddress);
    res.status(201).json({ id, status: 'pending' });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Error' });
  }
});

personal.get('/history', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const rows = await prisma.kycPersonalSubmission.findMany({
      where: { userId },
      orderBy: { submittedAt: 'asc' },
    });
    const reviewerIds = [...new Set(rows.map((r) => r.reviewedById).filter(Boolean))] as string[];
    const reviewers = await prisma.user.findMany({
      where: { id: { in: reviewerIds } },
      select: { id: true, displayName: true, firstName: true, lastName: true, email: true },
    });
    const nameById = new Map<string, string>();
    for (const u of reviewers) {
      const name =
        u.displayName?.trim() ||
        [u.firstName, u.lastName].filter(Boolean).join(' ').trim() ||
        u.email;
      nameById.set(u.id, name);
    }

    const out = rows.map((r) => ({
      ...personalRowToJson(r),
      reviewerName:
        r.reviewedById && r.reviewedById !== userId ? (nameById.get(r.reviewedById) ?? null) : null,
    }));
    res.json(out);
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Error' });
  }
});

router.use('/personal', personal);

// --- Business ---

async function getActiveBusinessSchemaRow() {
  return prisma.businessKycFormSchema.findFirst({
    where: { isActive: true },
    orderBy: { version: 'desc' },
  });
}

async function assertCompanyBizAccess(userId: string, companyId: string) {
  const company = await prisma.company.findFirst({
    where: {
      id: companyId,
      OR: [{ ownerId: userId }, { members: { some: { userId } } }],
    },
  });
  return company;
}

async function resolveCompanyId(userId: string, queryCompanyId: string | undefined): Promise<string | null> {
  if (queryCompanyId?.trim()) return queryCompanyId.trim();
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { companyId: true } });
  if (u?.companyId) return u.companyId;
  const c = await prisma.company.findFirst({ where: { ownerId: userId } });
  return c?.id ?? null;
}

function parseDraftBody(body: unknown):
  | { ok: true; companyId: string; answers: Record<string, unknown>; uploads: BusinessKycUploadRow[] }
  | { ok: false; error: string } {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Invalid JSON' };
  const b = body as Record<string, unknown>;
  if (typeof b.companyId !== 'string' || !b.companyId.trim()) return { ok: false, error: 'companyId required' };
  if (!b.answers || typeof b.answers !== 'object' || Array.isArray(b.answers)) {
    return { ok: false, error: 'answers must be an object' };
  }
  if (!Array.isArray(b.uploads)) return { ok: false, error: 'uploads must be an array' };
  const uploads: BusinessKycUploadRow[] = [];
  for (const u of b.uploads) {
    if (!u || typeof u !== 'object') return { ok: false, error: 'Invalid upload entry' };
    const r = u as Record<string, unknown>;
    if (typeof r.fieldId !== 'string' || typeof r.url !== 'string') {
      return { ok: false, error: 'Each upload needs fieldId and url' };
    }
    uploads.push({
      fieldId: r.fieldId,
      url: r.url,
      fileName: typeof r.fileName === 'string' ? r.fileName : '',
      mimeType: typeof r.mimeType === 'string' ? r.mimeType : 'application/octet-stream',
      sizeBytes: typeof r.sizeBytes === 'number' && Number.isFinite(r.sizeBytes) ? r.sizeBytes : 0,
    });
  }
  return { ok: true, companyId: b.companyId.trim(), answers: b.answers as Record<string, unknown>, uploads };
}

/**
 * TODO: wire `Company.categoryTags` or categories relation when available (schema has neither today).
 * @see prisma/schema.prisma — `Company`
 */
function companyCategoryTags(_companyId: string): string[] {
  return [];
}

const business = Router();

business.get('/schema/active', async (_req: AuthRequest, res: Response) => {
  try {
    const row = await getActiveBusinessSchemaRow();
    if (!row) {
      return res.status(404).json({ error: 'No active business KYC schema' });
    }
    res.json({ version: row.version, schema: row.schema });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Error' });
  }
});

business.get('/me', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const companyId = await resolveCompanyId(userId, typeof req.query.companyId === 'string' ? req.query.companyId : undefined);
    if (!companyId) {
      return res.json({ submission: null });
    }
    const company = await assertCompanyBizAccess(userId, companyId);
    if (!company) {
      return res.status(403).json({ error: 'Not allowed for this company' });
    }

    const latest = await prisma.businessKycSubmission.findFirst({
      where: { userId, companyId },
      orderBy: { updatedAt: 'desc' },
    });
    if (!latest) {
      return res.json({ submission: null, companyId });
    }

    const formRow = await prisma.businessKycFormSchema.findFirst({
      where: { version: latest.schemaVersion },
    });
    const form = formRow?.schema && isBusinessKycFormV1(formRow.schema) ? formRow.schema : null;
    const answers = parseJsonRecord(latest.answers);
    const expiryFlags =
      form && answers
        ? (computeExpiryFlags(form, answers) as Record<string, unknown>)
        : (parseJsonRecord(latest.expiryFlags) as Record<string, unknown>);

    res.json({
      companyId,
      submission: {
        id: latest.id,
        status: latest.status,
        answers: latest.answers,
        uploads: latest.uploads,
        submittedAt: latest.submittedAt?.toISOString() ?? null,
        reviewedAt: latest.reviewedAt?.toISOString() ?? null,
        reviewNote: latest.reviewNote,
        schemaVersion: latest.schemaVersion,
        expiryFlags,
        inquiryResults: latest.inquiryResults,
      },
    });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Error' });
  }
});

business.post('/draft', async (req: AuthRequest, res: Response) => {
  try {
    const parsed = parseDraftBody(req.body);
    if (parsed.ok === false) {
      return res.status(400).json({ error: parsed.error });
    }

    const userId = req.user!.userId;
    const company = await assertCompanyBizAccess(userId, parsed.companyId);
    if (!company) {
      return res.status(403).json({ error: 'Not allowed for this company' });
    }

    const active = await getActiveBusinessSchemaRow();
    if (!active) {
      return res.status(404).json({ error: 'No active business KYC schema' });
    }

    const existing = await prisma.businessKycSubmission.findFirst({
      where: { userId, companyId: parsed.companyId, status: KycStatus.draft },
    });

    const uploadsJson = parsed.uploads as unknown as object;
    const answersJson = parsed.answers as object;
    const expiry = (() => {
      const form = active.schema;
      if (!isBusinessKycFormV1(form)) return undefined;
      return computeExpiryFlags(form, parsed.answers) as object;
    })();

    if (existing) {
      const updated = await prisma.businessKycSubmission.update({
        where: { id: existing.id },
        data: {
          schemaVersion: active.version,
          answers: answersJson,
          uploads: uploadsJson,
          expiryFlags: expiry,
        },
      });
      return res.json({
        id: updated.id,
        status: updated.status,
        companyId: updated.companyId,
        schemaVersion: updated.schemaVersion,
        answers: updated.answers,
        uploads: updated.uploads,
        submittedAt: updated.submittedAt,
      });
    }

    const created = await prisma.businessKycSubmission.create({
      data: {
        userId,
        companyId: parsed.companyId,
        schemaVersion: active.version,
        status: KycStatus.draft,
        answers: answersJson,
        uploads: uploadsJson,
        submittedAt: null,
        expiryFlags: expiry,
      },
    });
    res.status(201).json({
      id: created.id,
      status: created.status,
      companyId: created.companyId,
      schemaVersion: created.schemaVersion,
      answers: created.answers,
      uploads: created.uploads,
      submittedAt: created.submittedAt,
    });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Error' });
  }
});

business.post('/submit', async (req: AuthRequest, res: Response) => {
  try {
    const parsed = parseDraftBody(req.body);
    if (parsed.ok === false) {
      return res.status(400).json({ error: parsed.error });
    }

    const userId = req.user!.userId;
    const company = await assertCompanyBizAccess(userId, parsed.companyId);
    if (!company) {
      return res.status(403).json({ error: 'Not allowed for this company' });
    }

    const active = await getActiveBusinessSchemaRow();
    if (!active || !isBusinessKycFormV1(active.schema)) {
      return res.status(404).json({ error: 'No active business KYC schema' });
    }
    const form: BusinessKycFormV1 = active.schema;
    const categories = companyCategoryTags(parsed.companyId);

    const vr = validateBusinessKycAnswers(form, parsed.answers, parsed.uploads, categories);
    if (!vr.valid) {
      return res.status(400).json({ errors: vr.errors });
    }

    const expiryFlags = computeExpiryFlags(form, parsed.answers) as object;
    const uploadsJson = parsed.uploads as unknown as object;
    const answersJson = parsed.answers as object;

    const draft = await prisma.businessKycSubmission.findFirst({
      where: { userId, companyId: parsed.companyId, status: KycStatus.draft },
    });

    const latestAny = await prisma.businessKycSubmission.findFirst({
      where: { userId, companyId: parsed.companyId },
      orderBy: { updatedAt: 'desc' },
    });
    if (latestAny?.status === KycStatus.pending) {
      return res.status(409).json({ error: 'A submission is already pending review' });
    }
    if (latestAny?.status === KycStatus.resubmit_requested || latestAny?.status === KycStatus.rejected) {
      return res.status(400).json({ error: 'Use POST /api/kyc/v2/business/resubmit' });
    }
    if (latestAny?.status === KycStatus.approved) {
      return res.status(400).json({ error: 'Already approved' });
    }

    const now = new Date();
    let subId: string;

    if (draft) {
      const updated = await prisma.businessKycSubmission.update({
        where: { id: draft.id },
        data: {
          status: KycStatus.pending,
          schemaVersion: active.version,
          answers: answersJson,
          uploads: uploadsJson,
          submittedAt: now,
          expiryFlags,
        },
      });
      subId = updated.id;
    } else {
      const created = await prisma.businessKycSubmission.create({
        data: {
          userId,
          companyId: parsed.companyId,
          schemaVersion: active.version,
          status: KycStatus.pending,
          answers: answersJson,
          uploads: uploadsJson,
          submittedAt: now,
          expiryFlags,
        },
      });
      subId = created.id;
    }

    await prisma.kycReviewAuditLog.create({
      data: {
        submissionType: KycSubmissionType.business,
        submissionId: subId,
        actorId: userId,
        fromStatus: KycStatus.draft,
        toStatus: KycStatus.pending,
      },
    });

    await prisma.company.update({
      where: { id: parsed.companyId },
      data: { kycStatus: 'pending' },
    });

    await publish('kyc.business.submitted', { userId, companyId: parsed.companyId, submissionId: subId });

    res.status(201).json({ id: subId, status: 'pending' });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Error' });
  }
});

business.post('/resubmit', async (req: AuthRequest, res: Response) => {
  try {
    const parsed = parseDraftBody(req.body);
    if (parsed.ok === false) {
      return res.status(400).json({ error: parsed.error });
    }

    const userId = req.user!.userId;
    const company = await assertCompanyBizAccess(userId, parsed.companyId);
    if (!company) {
      return res.status(403).json({ error: 'Not allowed for this company' });
    }

    const active = await getActiveBusinessSchemaRow();
    if (!active || !isBusinessKycFormV1(active.schema)) {
      return res.status(404).json({ error: 'No active business KYC schema' });
    }
    const form: BusinessKycFormV1 = active.schema;
    const categories = companyCategoryTags(parsed.companyId);

    const vr = validateBusinessKycAnswers(form, parsed.answers, parsed.uploads, categories);
    if (!vr.valid) {
      return res.status(400).json({ errors: vr.errors });
    }

    const latest = await prisma.businessKycSubmission.findFirst({
      where: { userId, companyId: parsed.companyId },
      orderBy: { updatedAt: 'desc' },
    });
    if (!latest || (latest.status !== KycStatus.rejected && latest.status !== KycStatus.resubmit_requested)) {
      return res.status(400).json({ error: 'Nothing to resubmit' });
    }

    const pending = await prisma.businessKycSubmission.findFirst({
      where: { userId, companyId: parsed.companyId, status: KycStatus.pending },
    });
    if (pending) {
      return res.status(409).json({ error: 'A submission is already pending review' });
    }

    const expiryFlags = computeExpiryFlags(form, parsed.answers) as object;
    const now = new Date();
    const created = await prisma.businessKycSubmission.create({
      data: {
        userId,
        companyId: parsed.companyId,
        schemaVersion: active.version,
        status: KycStatus.pending,
        answers: parsed.answers as object,
        uploads: parsed.uploads as unknown as object,
        submittedAt: now,
        expiryFlags,
      },
    });

    await prisma.kycReviewAuditLog.create({
      data: {
        submissionType: KycSubmissionType.business,
        submissionId: created.id,
        actorId: userId,
        fromStatus: latest.status,
        toStatus: KycStatus.pending,
      },
    });

    await prisma.company.update({
      where: { id: parsed.companyId },
      data: { kycStatus: 'pending' },
    });

    await publish('kyc.business.submitted', {
      userId,
      companyId: parsed.companyId,
      submissionId: created.id,
    });

    res.status(201).json({ id: created.id, status: 'pending' });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Error' });
  }
});

business.get('/history', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const companyId =
      typeof req.query.companyId === 'string' && req.query.companyId.trim()
        ? req.query.companyId.trim()
        : null;
    if (!companyId) {
      return res.status(400).json({ error: 'companyId query required' });
    }
    const company = await assertCompanyBizAccess(userId, companyId);
    if (!company) {
      return res.status(403).json({ error: 'Not allowed for this company' });
    }

    const rows = await prisma.businessKycSubmission.findMany({
      where: { userId, companyId },
      orderBy: { createdAt: 'asc' },
    });

    const versions = [...new Set(rows.map((r) => r.schemaVersion))];
    const forms = await prisma.businessKycFormSchema.findMany({
      where: { version: { in: versions } },
    });
    const formByV = new Map<number, BusinessKycFormV1>();
    for (const f of forms) {
      if (isBusinessKycFormV1(f.schema)) formByV.set(f.version, f.schema);
    }

    const out = rows.map((r) => {
      const form = formByV.get(r.schemaVersion);
      const answers = parseJsonRecord(r.answers);
      const expiryFlags =
        form && answers
          ? (computeExpiryFlags(form, answers) as Record<string, unknown>)
          : (parseJsonRecord(r.expiryFlags) as Record<string, unknown>);
      return {
        id: r.id,
        status: r.status,
        submittedAt: r.submittedAt?.toISOString() ?? null,
        reviewedAt: r.reviewedAt?.toISOString() ?? null,
        reviewNote: r.reviewNote,
        schemaVersion: r.schemaVersion,
        expiryFlags,
      };
    });
    res.json(out);
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Error' });
  }
});

router.use('/business', business);

export default router;
