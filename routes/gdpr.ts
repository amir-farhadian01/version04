// ---------------------------------------------------------------------------
// GDPR Compliance Endpoints
// - POST /auth/gdpr/export  — Export all user data
// - POST /auth/gdpr/delete  — Schedule account deletion (soft delete + anonymize)
// ---------------------------------------------------------------------------
import { Router, Response } from 'express';
import prisma from '../lib/db.js';
import { authenticate, AuthRequest } from '../lib/auth.middleware.js';

const router = Router();

// ─── GDPR Data Export ────────────────────────────────────────────────────────
router.post('/gdpr/export', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    const [
      user,
      orders,
      contracts,
      payments,
      kyc,
      notifications,
    ] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true, email: true, phone: true, displayName: true, role: true,
          status: true, isVerified: true, address: true, bio: true,
          location: true, avatarUrl: true, birthDate: true, gender: true,
          createdAt: true, lastLoginAt: true, lastIp: true, lastDevice: true,
          registrationIp: true, accountPreferences: true,
        },
      }),
      prisma.order.findMany({
        where: { customerId: userId },
        select: { id: true, status: true, phase: true, description: true, address: true,
          scheduledAt: true, createdAt: true, updatedAt: true },
      }),
      prisma.contract.findMany({
        where: { OR: [{ customerId: userId }, { providerId: userId }] },
        select: { id: true, status: true, amount: true, createdAt: true, updatedAt: true },
      }),
      prisma.payment.findMany({
        where: { order: { customerId: userId } },
        select: { id: true, status: true, amount: true, createdAt: true },
      }),
      prisma.kYC.findUnique({
        where: { userId },
        select: { status: true, createdAt: true },
      }),
      prisma.notification.findMany({
        where: { userId },
        select: { id: true, title: true, message: true, type: true, createdAt: true },
        take: 500,
      }),
    ]);

    // Log the export
    await prisma.auditLog.create({
      data: {
        actorId: userId,
        action: 'GDPR_EXPORT',
        resourceType: 'User',
        resourceId: userId,
        metadata: { exportedAt: new Date().toISOString() },
      },
    });

    res.json({
      data: {
        profile: user,
        orders,
        contracts,
        payments,
        kyc,
        notifications,
        exportedAt: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    res.status(500).json({ code: 'EXPORT_FAILED', message: err.message });
  }
});

// ─── GDPR Account Deletion ───────────────────────────────────────────────────
router.post('/gdpr/delete', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    // Check if already scheduled for deletion
    const existing = await prisma.user.findUnique({ where: { id: userId } });
    if (!existing) {
      return res.status(404).json({ code: 'USER_NOT_FOUND', message: 'User not found' });
    }

    // Schedule deletion 30 days from now
    const scheduledDeletionAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    // Anonymize PII and soft-delete
    await prisma.user.update({
      where: { id: userId },
      data: {
        email: `deleted-${userId}@anonymized.local`,
        normalizedEmail: `deleted-${userId}@anonymized.local`,
        phone: null,
        displayName: 'Deleted User',
        normalizedDisplayName: `deleted-user-${userId}`,
        password: null,
        firstName: null,
        lastName: null,
        address: null,
        bio: null,
        avatarUrl: null,
        birthDate: null,
        gender: null,
        location: null,
        refreshToken: null,
        googleId: null,
        accountPreferences: null,
        status: 'suspended' as any,
      },
    });

    // Log the deletion request
    await prisma.auditLog.create({
      data: {
        actorId: userId,
        action: 'GDPR_DELETE_SCHEDULED',
        resourceType: 'User',
        resourceId: userId,
        metadata: { scheduledDeletionAt: scheduledDeletionAt.toISOString() },
      },
    });

    res.json({
      success: true,
      message: 'Account deletion scheduled. Your data will be permanently deleted after 30 days.',
      scheduledDeletionAt: scheduledDeletionAt.toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ code: 'DELETE_FAILED', message: err.message });
  }
});

export default router;