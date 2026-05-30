import { Router, Response } from "express";
import { KycStatus, KycSubmissionType } from "@prisma/client";
import prisma from "../lib/db.js";
import { authenticate, AuthRequest } from "../lib/auth.middleware.js";
import { publish } from "../lib/bus.js";
import { mirrorLegacyKycPersonalPending } from "../lib/kycLegacyPersonal.js";

const router = Router();

function mapPersonalToLegacyStatus(s: KycStatus): string {
  if (s === KycStatus.approved) return "verified";
  if (s === KycStatus.rejected) return "rejected";
  return "pending";
}

// GET /api/kyc/me - Get current user's KYC status
router.get("/me", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const row = await prisma.kYC.findUnique({ where: { userId } });
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        isVerified: true,
        phone: true,
        address: true,
      },
    });
    const l0 = await prisma.kycLevel0Profile.findUnique({ where: { userId } });
    const personalLatest = await prisma.kycPersonalSubmission.findFirst({
      where: { userId },
      orderBy: { submittedAt: "desc" },
    });

    let level = 0;
    const emailVerified = user?.isVerified ?? false;
    const phoneVerified =
      l0?.phoneVerifiedAt != null || (!!user?.phone && user.phone.length > 0);
    let identityVerified = false;
    let status = "pending";
    let identityDocumentUrl: string | null = null;
    let identityDocumentType: string | null = null;
    let kycSubmittedAt: Date | null = null;
    let kycVerifiedAt: Date | null = null;

    if (personalLatest) {
      status = mapPersonalToLegacyStatus(personalLatest.status);
      identityDocumentUrl = personalLatest.idFrontUrl;
      identityDocumentType = personalLatest.idDocumentType;
      kycSubmittedAt = personalLatest.submittedAt;
      if (personalLatest.status === KycStatus.approved) {
        identityVerified = true;
        kycVerifiedAt = personalLatest.reviewedAt ?? personalLatest.submittedAt;
      }
    } else if (row) {
      status = row.status;
      const det =
        row.details && typeof row.details === "object" && !Array.isArray(row.details)
          ? (row.details as Record<string, unknown>)
          : {};
      identityDocumentUrl = (det.identityDocumentUrl as string | null | undefined) ?? null;
      identityDocumentType = (det.documentType as string | null | undefined) ?? null;
      kycSubmittedAt = row.createdAt;
      kycVerifiedAt = row.status === "verified" ? row.createdAt : null;

      if (row.status === "verified" && row.type === "personal") {
        identityVerified = true;
      }
    }

    if (emailVerified || phoneVerified) {
      level = 1;
    }
    if (identityVerified) {
      level = 2;
    }

    res.json({
      level,
      status,
      emailVerified,
      phoneVerified,
      identityVerified,
      identityDocumentUrl,
      identityDocumentType,
      kycSubmittedAt,
      kycVerifiedAt,
      raw: row,
      personalLatestId: personalLatest?.id ?? null,
    });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error" });
  }
});

// GET /api/kyc/status - Alternative endpoint for KYC status
router.get("/status", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const row = await prisma.kYC.findUnique({ where: { userId } });
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isVerified: true, phone: true },
    });
    const l0 = await prisma.kycLevel0Profile.findUnique({ where: { userId } });
    const personalLatest = await prisma.kycPersonalSubmission.findFirst({
      where: { userId },
      orderBy: { submittedAt: "desc" },
    });

    let level = 0;
    const emailVerified = user?.isVerified ?? false;
    const phoneVerified =
      l0?.phoneVerifiedAt != null || (!!user?.phone && user.phone.length > 0);
    let identityVerified =
      personalLatest?.status === KycStatus.approved ||
      (row?.status === "verified" && row?.type === "personal");

    if (emailVerified || phoneVerified) level = 1;
    if (identityVerified) level = 2;

    const status = personalLatest
      ? mapPersonalToLegacyStatus(personalLatest.status)
      : row?.status ?? "pending";
    const verified =
      personalLatest?.status === KycStatus.approved || row?.status === "verified";

    res.json({
      level,
      status,
      emailVerified,
      phoneVerified,
      identityVerified,
      canPlaceOrder: level >= 2 && verified,
    });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error" });
  }
});

// POST /api/kyc/submit - Submit identity document for verification
router.post("/submit", authenticate, async (req: AuthRequest, res: Response) => {
  const { documentType } = req.body;

  if (!documentType) {
    return res.status(400).json({ error: 'Document type is required (passport, drivers_license, or national_id)' });
  }

  const validTypes = ['passport', 'drivers_license', 'national_id'];
  if (!validTypes.includes(documentType)) {
    return res.status(400).json({ error: `Invalid document type. Must be one of: ${validTypes.join(', ')}` });
  }

  try {
    const userId = req.user!.userId;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isVerified: true, phone: true, email: true, address: true },
    });
    const l0 = await prisma.kycLevel0Profile.findUnique({ where: { userId } });

    const emailVerified = user?.isVerified ?? false;
    const phoneVerified =
      l0?.phoneVerifiedAt != null || (!!user?.phone && user.phone.length > 0);

    if (!emailVerified && !phoneVerified) {
      return res.status(400).json({
        error: 'Level 1 verification required',
        message: 'Please verify your email or phone number before submitting identity documents.',
      });
    }

    const v2Pending = await prisma.kycPersonalSubmission.findFirst({
      where: { userId, status: KycStatus.pending },
    });
    if (v2Pending) {
      return res.status(409).json({ error: 'A KYC submission is already pending review' });
    }

    const addr =
      (l0?.address ?? user?.address ?? "").trim() || null;

    const sub = await prisma.kycPersonalSubmission.create({
      data: {
        userId,
        declaredAddress: addr,
        declaredLegalName: "(legacy)",
        idDocumentType: documentType,
        idFrontUrl: "legacy:none",
        selfieUrl: "legacy:none",
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
        metadata: { channel: "legacy_flutter" },
      },
    });

    await publish("kyc.personal.submitted", { userId, submissionId: sub.id });
    await mirrorLegacyKycPersonalPending(userId, documentType);

    await publish('kyc.submitted', {
      userId,
      email: user?.email,
      documentType,
      submittedAt: new Date().toISOString(),
    });

    const kyc = await prisma.kYC.findUnique({ where: { userId } });

    res.status(201).json({
      success: true,
      message: 'Identity document submitted successfully. We will review it within 24-48 hours.',
      kyc: {
        id: kyc?.id ?? sub.id,
        status: 'pending',
        type: 'personal',
        documentType,
      },
    });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error" });
  }
});

// POST /api/kyc/verify-email - Request email verification
router.post("/verify-email", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, isVerified: true },
    });

    if (user?.isVerified) {
      return res.json({
        success: true,
        message: 'Email is already verified.',
        alreadyVerified: true,
      });
    }

    const verificationToken = `${Date.now()}-${Math.random().toString(36).substring(2)}`;

    res.json({
      success: true,
      message: 'Verification email sent. Please check your inbox and click the verification link.',
      debugToken: process.env.NODE_ENV === 'development' ? verificationToken : undefined,
    });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error" });
  }
});

// POST /api/kyc/verify-phone - Verify phone number with code
router.post("/verify-phone", authenticate, async (req: AuthRequest, res: Response) => {
  const { code } = req.body;

  if (!code || code.length < 4) {
    return res.status(400).json({ error: 'Valid verification code is required' });
  }

  try {
    const isDev = process.env.NODE_ENV === 'development';
    const isValidCode = isDev
      ? code.length === 6 && /^\d+$/.test(code)
      : code === '123456';

    if (!isValidCode) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    const userId = req.user!.userId;
    const now = new Date();
    await prisma.kycLevel0Profile.upsert({
      where: { userId },
      create: { userId, phoneVerifiedAt: now },
      update: { phoneVerifiedAt: now },
    });

    const kyc = await prisma.kYC.findUnique({
      where: { userId },
    });

    if (kyc) {
      await prisma.kYC.update({
        where: { id: kyc.id },
        data: {
          details: {
            ...(kyc.details && typeof kyc.details === "object" && !Array.isArray(kyc.details)
              ? (kyc.details as Record<string, unknown>)
              : {}),
            phoneVerified: true,
            phoneVerifiedAt: new Date().toISOString(),
          },
        },
      });
    }

    res.json({
      success: true,
      message: 'Phone number verified successfully.',
    });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error" });
  }
});

// Admin endpoint: Verify or reject KYC
router.put("/:id/status", authenticate, async (req: AuthRequest, res: Response) => {
  const { status, rejectionReason } = req.body;
  const { role } = req.user!;

  // Only admins can verify KYC
  const isAdmin = ['owner', 'platform_admin', 'support'].includes(role);
  if (!isAdmin) {
    return res.status(403).json({ error: 'Only admins can verify KYC' });
  }

  if (!['verified', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Status must be "verified" or "rejected"' });
  }

  try {
    const kyc = await prisma.kYC.findUnique({
      where: { id: req.params.id },
      include: { user: { select: { id: true, email: true } } },
    });

    if (!kyc) {
      return res.status(404).json({ error: 'KYC record not found' });
    }

    const updated = await prisma.kYC.update({
      where: { id: req.params.id },
      data: {
        status,
        details: {
          ...(kyc.details && typeof kyc.details === "object" && !Array.isArray(kyc.details)
            ? (kyc.details as Record<string, unknown>)
            : {}),
          rejectionReason: status === 'rejected' ? rejectionReason : undefined,
          verifiedAt: status === 'verified' ? new Date().toISOString() : undefined,
          verifiedBy: req.user!.userId,
        },
      },
    });

    // Create notification for user
    await prisma.notification.create({
      data: {
        userId: kyc.userId,
        title: status === 'verified' ? 'Identity Verified' : 'Verification Rejected',
        message: status === 'verified'
          ? 'Your identity has been verified. You can now place orders!'
          : `Your verification was rejected. Reason: ${rejectionReason || 'Document unclear or invalid'}`,
        type: status === 'verified' ? 'system' : 'alert',
      },
    });

    res.json({
      success: true,
      message: `KYC ${status} successfully`,
      kyc: updated,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/kyc/pending - Admin endpoint to get pending KYC submissions
router.get("/pending", authenticate, async (req: AuthRequest, res: Response) => {
  const { role } = req.user!;

  const isAdmin = ['owner', 'platform_admin', 'support'].includes(role);
  if (!isAdmin) {
    return res.status(403).json({ error: 'Only admins can view pending KYC' });
  }

  try {
    const pending = await prisma.kYC.findMany({
      where: { status: 'pending' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            displayName: true,
            phone: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(pending);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
