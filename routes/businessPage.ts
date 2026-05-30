import { Router, Response } from 'express';
import prisma from '../lib/db.js';
import { authenticate, AuthRequest } from '../lib/auth.middleware.js';
import {
  hasContractedOrderWithWorkspace,
  isAdminRole,
  CONTACT_FIELDS,
} from '../lib/profileVisibility.js';

const router = Router();

/**
 * Masks contact fields on a company object if the viewer has no contracted order.
 * Mutates the company object in place.
 */
async function maskContactFieldsIfNeeded(
  company: Record<string, unknown>,
  viewerId: string | undefined,
  viewerRole: string | undefined,
): Promise<void> {
  if (viewerId && isAdminRole(viewerRole)) {
    return;
  }
  if (!viewerId) {
    for (const field of CONTACT_FIELDS) {
      company[field] = null;
    }
    company.contactHidden = true;
    return;
  }
  const hasContract = await hasContractedOrderWithWorkspace(viewerId, company.id as string);
  if (!hasContract) {
    for (const field of CONTACT_FIELDS) {
      company[field] = null;
    }
    company.contactHidden = true;
  }
}

/**
 * Calculate experience years from experienceDate.
 */
function calcExperienceYears(experienceDate: Date | string | null | undefined): number | null {
  if (!experienceDate) return null;
  const start = new Date(experienceDate);
  const now = new Date();
  const years = (now.getTime() - start.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  return Math.floor(years);
}

// GET /api/business-page/:companyId — Full public business profile
router.get('/:companyId', async (req: AuthRequest, res: Response) => {
  try {
    const { companyId } = req.params;

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      include: {
        owner: {
          select: { id: true, displayName: true, avatarUrl: true },
        },
        members: {
          include: {
            user: {
              select: { id: true, displayName: true, firstName: true, lastName: true, avatarUrl: true },
            },
          },
        },
      },
    });

    if (!company) {
      return res.status(404).json({ error: 'Business not found' });
    }

    // Fetch trust data
    const verification = await prisma.businessVerification.findUnique({
      where: { workspaceId: companyId },
    });

    const trustScore = await prisma.businessTrustScore.findUnique({
      where: { workspaceId: companyId },
    });

    // Fetch portfolio
    const portfolio = await prisma.businessPortfolio.findUnique({
      where: { companyId },
    });

    // Calculate stats
    const [totalServices, totalStaff, totalReviews, totalOrders] = await Promise.all([
      prisma.providerServicePackage.count({
        where: { workspaceId: companyId, isActive: true, archivedAt: null },
      }),
      prisma.companyUser.count({
        where: { companyId, role: { in: ['staff', 'member', 'admin', 'owner'] } },
      }),
      prisma.orderReview.count({
        where: {
          order: { matchedWorkspaceId: companyId },
        },
      }),
      prisma.order.count({
        where: { matchedWorkspaceId: companyId },
      }),
    ]);

    // Build response
    const result: Record<string, unknown> = {
      company: {
        id: company.id,
        name: company.name,
        slug: company.slug,
        slogan: company.slogan,
        about: company.about,
        logoUrl: company.logoUrl,
        coverImageUrl: company.coverImageUrl,
        address: company.address,
        phone: company.phone,
        website: company.website,
        type: company.type,
        kycStatus: company.kycStatus,
        location: company.location,
      },
      trust: {
        licenseNumber: verification?.licenseNumber ?? null,
        licenseVerified: verification?.licenseVerifiedAt != null,
        hasLiabilityInsurance: verification?.hasLiabilityInsurance ?? false,
        insuranceVerified: verification?.insuranceVerifiedAt != null,
        experienceYears: calcExperienceYears(company.experienceDate),
        avgRating: trustScore?.avgRating ?? 0,
        totalScore: trustScore?.totalScore ?? 0,
        kycVerified: trustScore?.kycVerified ?? false,
      },
      portfolio: {
        history: portfolio?.history ?? null,
        mission: portfolio?.mission ?? null,
        galleryUrls: portfolio?.galleryUrls ?? [],
        businessHours: portfolio?.businessHours ?? null,
        tags: portfolio?.tags ?? [],
      },
      stats: {
        totalServices,
        totalStaff,
        totalReviews,
        totalOrders,
      },
    };

    // Mask contact fields
    const viewerId = (req as any).user?.userId;
    const viewerRole = (req as any).user?.role;
    await maskContactFieldsIfNeeded(result.company as Record<string, unknown>, viewerId, viewerRole);

    res.json(result);
  } catch (err: unknown) {
    console.error(err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
  }
});

// GET /api/business-page/:companyId/trust — Trust layer data only
router.get('/:companyId/trust', async (req: AuthRequest, res: Response) => {
  try {
    const { companyId } = req.params;

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, experienceDate: true },
    });

    if (!company) {
      return res.status(404).json({ error: 'Business not found' });
    }

    const verification = await prisma.businessVerification.findUnique({
      where: { workspaceId: companyId },
    });

    const trustScore = await prisma.businessTrustScore.findUnique({
      where: { workspaceId: companyId },
    });

    res.json({
      licenseNumber: verification?.licenseNumber ?? null,
      licenseVerified: verification?.licenseVerifiedAt != null,
      hasLiabilityInsurance: verification?.hasLiabilityInsurance ?? false,
      insuranceVerified: verification?.insuranceVerifiedAt != null,
      experienceYears: calcExperienceYears(company.experienceDate),
      avgRating: trustScore?.avgRating ?? 0,
      totalScore: trustScore?.totalScore ?? 0,
      kycVerified: trustScore?.kycVerified ?? false,
    });
  } catch (err: unknown) {
    console.error(err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
  }
});

// GET /api/business-page/:companyId/services — Services with staff assignments
router.get('/:companyId/services', async (req: AuthRequest, res: Response) => {
  try {
    const { companyId } = req.params;

    const packages = await prisma.providerServicePackage.findMany({
      where: { workspaceId: companyId, isActive: true, archivedAt: null },
      orderBy: [{ sortOrder: 'asc' }, { finalPrice: 'asc' }],
      include: {
        staffAssignments: {
          include: {
            staff: {
              select: {
                id: true,
                displayName: true,
                firstName: true,
                lastName: true,
                avatarUrl: true,
              },
            },
          },
        },
        bom: {
          orderBy: { sortOrder: 'asc' },
          select: {
            quantity: true,
            snapshotUnitPrice: true,
            snapshotCurrency: true,
            snapshotProductName: true,
          },
        },
      },
    });

    const rows = packages.map((pkg) => ({
      id: pkg.id,
      name: pkg.name,
      description: pkg.description,
      price: pkg.finalPrice,
      currency: pkg.currency,
      durationMinutes: pkg.durationMinutes,
      breakTimeMinutes: pkg.breakTimeMinutes,
      bookingMode: pkg.bookingMode,
      photoRequired: pkg.photoRequired,
      assignedStaff: pkg.staffAssignments.map((a) => ({
        id: a.staff.id,
        displayName: a.staff.displayName,
        firstName: a.staff.firstName,
        lastName: a.staff.lastName,
        avatarUrl: a.staff.avatarUrl,
        isPrimary: a.isPrimary,
      })),
      bomLines: pkg.bom.map((b) => ({
        productName: b.snapshotProductName,
        quantity: b.quantity,
        unitPrice: b.snapshotUnitPrice,
        currency: b.snapshotCurrency,
      })),
    }));

    res.json({ items: rows });
  } catch (err: unknown) {
    console.error(err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
  }
});

// GET /api/business-page/:companyId/staff — Staff directory with profiles
router.get('/:companyId/staff', async (req: AuthRequest, res: Response) => {
  try {
    const { companyId } = req.params;

    const members = await prisma.companyUser.findMany({
      where: { companyId, role: { in: ['staff', 'member', 'admin', 'owner'] } },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            bio: true,
            role: true,
          },
        },
      },
    });

    // Get staff assignment counts
    const staffIds = members.map((m) => m.user.id);
    const assignmentCounts = await prisma.packageStaffAssignment.groupBy({
      by: ['staffId'],
      where: { staffId: { in: staffIds } },
      _count: true,
    });
    const countMap = new Map(assignmentCounts.map((a) => [a.staffId, a._count]));

    const staff = members.map((m) => ({
      id: m.user.id,
      displayName: m.user.displayName,
      firstName: m.user.firstName,
      lastName: m.user.lastName,
      avatarUrl: m.user.avatarUrl,
      bio: m.user.bio,
      role: m.role,
      staffRole: (m as any).staffRole ?? null,
      assignedServiceCount: countMap.get(m.user.id) ?? 0,
    }));

    res.json({ staff });
  } catch (err: unknown) {
    console.error(err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
  }
});

// GET /api/business-page/:companyId/reviews — Customer reviews
router.get('/:companyId/reviews', async (req: AuthRequest, res: Response) => {
  try {
    const { companyId } = req.params;

    const reviews = await prisma.orderReview.findMany({
      where: {
        order: { matchedWorkspaceId: companyId },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        customer: {
          select: {
            id: true,
            displayName: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
        order: {
          select: {
            id: true,
            description: true,
            matchedPackage: {
              select: { name: true },
            },
          },
        },
      },
    });

    const items = reviews.map((r) => ({
      id: r.id,
      rating: r.rating,
      reviewText: r.reviewText,
      createdAt: r.createdAt,
      customer: r.customer,
      serviceName: r.order.matchedPackage?.name ?? null,
    }));

    res.json({ items });
  } catch (err: unknown) {
    console.error(err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
  }
});

// PUT /api/business-page/:companyId/portfolio — Update portfolio (auth: owner/admin)
router.put('/:companyId/portfolio', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { companyId } = req.params;

    // Verify ownership
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, ownerId: true },
    });

    if (!company) {
      return res.status(404).json({ error: 'Business not found' });
    }

    const isOwner = company.ownerId === req.user!.userId;
    const isAdmin = ['platform_admin', 'owner', 'support', 'finance'].includes(req.user!.role);
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Only allow editing supplementary fields (NOT KYC-critical fields)
    const { history, mission, galleryUrls, businessHours, tags } = req.body;

    const portfolio = await prisma.businessPortfolio.upsert({
      where: { companyId },
      update: {
        ...(history !== undefined && { history }),
        ...(mission !== undefined && { mission }),
        ...(galleryUrls !== undefined && { galleryUrls }),
        ...(businessHours !== undefined && { businessHours }),
        ...(tags !== undefined && { tags }),
      },
      create: {
        companyId,
        history: history ?? null,
        mission: mission ?? null,
        galleryUrls: galleryUrls ?? [],
        businessHours: businessHours ?? null,
        tags: tags ?? [],
      },
    });

    res.json(portfolio);
  } catch (err: unknown) {
    console.error(err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
  }
});

export default router;
