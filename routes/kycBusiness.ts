import { Router, Response } from 'express';
import { KycStatus } from '@prisma/client';
import prisma from '../lib/db.js';
import { authenticate, AuthRequest } from '../lib/auth.middleware.js';
import { z } from 'zod';

const router = Router();
router.use(authenticate);

// ─── Zod schemas ────────────────────────────────────────────────────────────

const upgradeSchema = z.object({
  companyId: z.string().min(1, 'companyId is required'),
  businessType: z.enum(['individual', 'company']),
});

const uploadDocSchema = z.object({
  submissionId: z.string().min(1),
  documentType: z.enum(['license', 'insurance']),
  fileUrl: z.string().url('fileUrl must be a valid URL'),
});

// ─── Helpers ────────────────────────────────────────────────────────────────

async function assertCompanyAccess(userId: string, companyId: string) {
  const membership = await prisma.companyUser.findFirst({
    where: { userId, companyId },
    include: { company: true },
  });
  if (!membership) {
    const owned = await prisma.company.findFirst({
      where: { id: companyId, ownerId: userId },
    });
    if (!owned) throw Object.assign(new Error('Not allowed for this company'), { status: 403 });
    return { company: owned, role: 'owner' };
  }
  return membership;
}

function normalizeEmail(email: string): string {
  const [local, domain] = email.toLowerCase().trim().split('@');
  if (!domain) return email.toLowerCase().trim();
  // Gmail: strip dots and +alias
  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    return local.replace(/\./g, '').split('+')[0] + '@' + domain;
  }
  return local + '@' + domain;
}

// ─── POST /api/kyc/business/upgrade — Start business upgrade flow ──────────

router.post('/upgrade', async (req: AuthRequest, res: Response) => {
  try {
    const parsed = upgradeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    }

    const { companyId, businessType } = parsed.data;
    const userId = req.user!.userId;

    // Verify user has access to this company
    const membership = await assertCompanyAccess(userId, companyId);
    if (!membership) {
      return res.status(403).json({ error: 'Not allowed for this company' });
    }

    // Check existing business KYC
    const existing = await prisma.businessKycSubmission.findFirst({
      where: { userId, companyId },
      orderBy: { updatedAt: 'desc' },
    });

    if (existing?.status === KycStatus.approved) {
      return res.status(400).json({ error: 'Business KYC already approved' });
    }

    if (existing?.status === KycStatus.pending) {
      return res.status(409).json({ error: 'A submission is already pending review' });
    }

    // Get active form schema
    const activeSchema = await prisma.businessKycFormSchema.findFirst({
      where: { isActive: true },
      orderBy: { version: 'desc' },
    });

    if (!activeSchema) {
      return res.status(404).json({ error: 'No active business KYC form schema' });
    }

    // Create or update draft submission
    const now = new Date();
    const answers = {
      businessType,
      upgradedAt: now.toISOString(),
    };

    let submission;
    if (existing && existing.status === KycStatus.draft) {
      submission = await prisma.businessKycSubmission.update({
        where: { id: existing.id },
        data: {
          schemaVersion: activeSchema.version,
          answers: answers as object,
        },
      });
    } else {
      submission = await prisma.businessKycSubmission.create({
        data: {
          userId,
          companyId,
          schemaVersion: activeSchema.version,
          status: KycStatus.draft,
          answers: answers as object,
          uploads: {} as object,
          submittedAt: null,
        },
      });
    }

    res.status(201).json({
      id: submission.id,
      status: submission.status,
      companyId: submission.companyId,
      schemaVersion: submission.schemaVersion,
      message: 'Business upgrade flow started',
    });
  } catch (err: unknown) {
    const status = err && typeof err === 'object' && 'status' in err
      ? (err as { status: number }).status
      : 500;
    const message = err instanceof Error ? err.message : 'Error starting upgrade';
    res.status(status).json({ error: message });
  }
});

// ─── POST /api/kyc/business/upload-license — Upload license document ──────

router.post('/upload-license', async (req: AuthRequest, res: Response) => {
  try {
    const parsed = uploadDocSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    }

    const { submissionId, fileUrl } = parsed.data;
    const userId = req.user!.userId;

    const submission = await prisma.businessKycSubmission.findUnique({
      where: { id: submissionId },
    });

    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    if (submission.userId !== userId) {
      return res.status(403).json({ error: 'Not your submission' });
    }

    if (submission.status === KycStatus.approved) {
      return res.status(400).json({ error: 'Already approved' });
    }

    // Update uploads with license document
    const existingUploads = (submission.uploads as Record<string, unknown>) ?? {};
    const updatedUploads = {
      ...existingUploads,
      licenseDocUrl: fileUrl,
      licenseUploadedAt: new Date().toISOString(),
    };

    const updated = await prisma.businessKycSubmission.update({
      where: { id: submissionId },
      data: {
        uploads: updatedUploads as unknown as object,
      },
    });

    // Also update BusinessVerification if it exists
    if (submission.companyId) {
      await prisma.businessVerification.upsert({
        where: { workspaceId: submission.companyId },
        update: { licenseDocUrl: fileUrl },
        create: {
          workspaceId: submission.companyId,
          licenseDocUrl: fileUrl,
        },
      });
    }

    res.json({
      id: updated.id,
      status: updated.status,
      message: 'License document uploaded',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error uploading license';
    res.status(500).json({ error: message });
  }
});

// ─── POST /api/kyc/business/upload-insurance — Upload insurance certificate ──

router.post('/upload-insurance', async (req: AuthRequest, res: Response) => {
  try {
    const parsed = uploadDocSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    }

    const { submissionId, fileUrl } = parsed.data;
    const userId = req.user!.userId;

    const submission = await prisma.businessKycSubmission.findUnique({
      where: { id: submissionId },
    });

    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    if (submission.userId !== userId) {
      return res.status(403).json({ error: 'Not your submission' });
    }

    if (submission.status === KycStatus.approved) {
      return res.status(400).json({ error: 'Already approved' });
    }

    // Update uploads with insurance document
    const existingUploads = (submission.uploads as Record<string, unknown>) ?? {};
    const updatedUploads = {
      ...existingUploads,
      insuranceDocUrl: fileUrl,
      insuranceUploadedAt: new Date().toISOString(),
    };

    const updated = await prisma.businessKycSubmission.update({
      where: { id: submissionId },
      data: {
        uploads: updatedUploads as unknown as object,
      },
    });

    // Also update BusinessVerification if it exists
    if (submission.companyId) {
      await prisma.businessVerification.upsert({
        where: { workspaceId: submission.companyId },
        update: { insuranceDocUrl: fileUrl },
        create: {
          workspaceId: submission.companyId,
          insuranceDocUrl: fileUrl,
        },
      });
    }

    res.json({
      id: updated.id,
      status: updated.status,
      message: 'Insurance certificate uploaded',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error uploading insurance';
    res.status(500).json({ error: message });
  }
});

// ─── GET /api/kyc/business/status — Get business KYC status ───────────────

router.get('/status', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    // Get all companies for this user
    const memberships = await prisma.companyUser.findMany({
      where: { userId },
      include: { company: true },
    });

    const owned = await prisma.company.findMany({
      where: { ownerId: userId },
    });

    const allCompanies = [
      ...memberships.map((m) => m.company),
      ...owned,
    ];

    // Deduplicate
    const seen = new Set<string>();
    const uniqueCompanies = allCompanies.filter((c) => {
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    });

    // Get latest business KYC submission for each company
    const statuses = await Promise.all(
      uniqueCompanies.map(async (company) => {
        const sub = await prisma.businessKycSubmission.findFirst({
          where: { userId, companyId: company.id },
          orderBy: { updatedAt: 'desc' },
        });

        const bizVerification = await prisma.businessVerification.findUnique({
          where: { workspaceId: company.id },
        });

        return {
          companyId: company.id,
          companyName: company.name,
          kycStatus: company.kycStatus,
          submission: sub
            ? {
                id: sub.id,
                status: sub.status,
                submittedAt: sub.submittedAt?.toISOString() ?? null,
                reviewedAt: sub.reviewedAt?.toISOString() ?? null,
                reviewNote: sub.reviewNote,
              }
            : null,
          businessVerification: bizVerification
            ? {
                requiresLicense: bizVerification.requiresLicense,
                licenseVerified: !!bizVerification.licenseVerifiedAt,
                insuranceVerified: !!bizVerification.insuranceVerifiedAt,
              }
            : null,
        };
      }),
    );

    res.json({ companies: statuses });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error fetching status';
    res.status(500).json({ error: message });
  }
});

// ─── GET /api/kyc/business/trust-score — Get trust score breakdown ────────

router.get('/trust-score', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const companyId = typeof req.query.companyId === 'string' ? req.query.companyId : '';

    if (!companyId) {
      return res.status(400).json({ error: 'companyId query parameter required' });
    }

    // Verify access
    try {
      await assertCompanyAccess(userId, companyId);
    } catch {
      return res.status(403).json({ error: 'Not allowed for this company' });
    }

    const trustScore = await prisma.businessTrustScore.findUnique({
      where: { workspaceId: companyId },
    });

    if (!trustScore) {
      return res.json({
        workspaceId: companyId,
        kycVerified: false,
        licenseVerified: false,
        insuranceVerified: false,
        avgRating: 0,
        totalScore: 0,
        message: 'Trust score not yet calculated',
      });
    }

    const businessVerification = await prisma.businessVerification.findUnique({
      where: { workspaceId: companyId },
    });

    res.json({
      workspaceId: trustScore.workspaceId,
      kycVerified: trustScore.kycVerified,
      licenseVerified: trustScore.licenseVerified,
      insuranceVerified: trustScore.insuranceVerified,
      avgRating: trustScore.avgRating,
      totalScore: trustScore.totalScore,
      details: {
        kycWeight: 30,
        licenseWeight: 25,
        insuranceWeight: 25,
        ratingWeight: 20,
        breakdown: {
          kycScore: trustScore.kycVerified ? 30 : 0,
          licenseScore: trustScore.licenseVerified ? 25 : 0,
          insuranceScore: trustScore.insuranceVerified ? 25 : 0,
          ratingScore: Math.round((trustScore.avgRating / 5) * 20),
        },
      },
      businessVerification: businessVerification
        ? {
            requiresLicense: businessVerification.requiresLicense,
            licenseVerifiedAt: businessVerification.licenseVerifiedAt?.toISOString() ?? null,
            insuranceVerifiedAt: businessVerification.insuranceVerifiedAt?.toISOString() ?? null,
          }
        : null,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error fetching trust score';
    res.status(500).json({ error: message });
  }
});

export default router;
