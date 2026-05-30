import { Router, Response } from 'express';
import prisma from '../lib/db.js';
import { authenticate, AuthRequest } from '../lib/auth.middleware.js';
import { setWorkspaceLocation } from '../lib/locationCache.js';
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
  // Admins always see full info
  if (viewerId && isAdminRole(viewerRole)) {
    return;
  }

  // Unauthenticated users never see contact info
  if (!viewerId) {
    for (const field of CONTACT_FIELDS) {
      company[field] = null;
    }
    company.contactHidden = true;
    return;
  }

  // Check if viewer has a contracted order with this workspace
  const hasContract = await hasContractedOrderWithWorkspace(viewerId, company.id as string);

  if (!hasContract) {
    for (const field of CONTACT_FIELDS) {
      company[field] = null;
    }
    company.contactHidden = true;
  }
}

// GET /api/companies
router.get('/', async (req: AuthRequest, res: Response) => {
  const { kycStatus, search } = req.query as any;
  try {
    const where: any = {};
    if (kycStatus) where.kycStatus = kycStatus;
    if (search) where.name = { contains: search, mode: 'insensitive' };

    const companies = await prisma.company.findMany({
      where,
      include: {
        owner: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
        members: { include: { user: { select: { id: true, displayName: true, email: true, avatarUrl: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Mask contact info for each company
    const viewerId = (req as any).user?.userId;
    const viewerRole = (req as any).user?.role;
    for (const company of companies) {
      await maskContactFieldsIfNeeded(company as unknown as Record<string, unknown>, viewerId, viewerRole);
    }

    res.json(companies);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/companies/:id
router.get('/:id', async (req, res: Response) => {
  try {
    const company = await prisma.company.findUnique({
      where: { id: req.params.id },
      include: {
        owner: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
        members: { include: { user: { select: { id: true, displayName: true, email: true, avatarUrl: true, role: true } } } },
      },
    });
    if (!company) return res.status(404).json({ error: 'Not found' });

    // Mask contact info based on viewer's relationship
    const viewerId = (req as any).user?.userId;
    const viewerRole = (req as any).user?.role;
    await maskContactFieldsIfNeeded(company as unknown as Record<string, unknown>, viewerId, viewerRole);

    res.json(company);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/companies/by-slug/:slug
router.get('/by-slug/:slug', async (req, res: Response) => {
  try {
    const company = await prisma.company.findUnique({
      where: { slug: req.params.slug },
      include: {
        owner: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
        members: { include: { user: { select: { id: true, displayName: true, email: true, avatarUrl: true } } } },
      },
    });
    if (!company) return res.status(404).json({ error: 'Not found' });

    // Mask contact info based on viewer's relationship
    const viewerId = (req as any).user?.userId;
    const viewerRole = (req as any).user?.role;
    await maskContactFieldsIfNeeded(company as unknown as Record<string, unknown>, viewerId, viewerRole);

    res.json(company);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/companies
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  const { name, slug, type, about, phone, address, website, socialLinks } = req.body;
  if (!name) return res.status(400).json({ error: 'Missing name' });

  try {
    const existing = await prisma.company.findUnique({ where: { ownerId: req.user!.userId } });
    if (existing) return res.status(409).json({ error: 'Already have a company' });

    const company = await prisma.company.create({
      data: { name, slug, type: type || 'solo', about, phone, address, website, socialLinks, ownerId: req.user!.userId },
    });

    // Update user companyId
    await prisma.user.update({ where: { id: req.user!.userId }, data: { companyId: company.id } });

    res.status(201).json(company);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/companies/:id
router.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const company = await prisma.company.findUnique({ where: { id: req.params.id } });
    if (!company) return res.status(404).json({ error: 'Not found' });

    const isOwner = company.ownerId === req.user!.userId;
    const isAdmin = ['owner', 'platform_admin'].includes(req.user!.role);
    if (!isOwner && !isAdmin) return res.status(403).json({ error: 'Forbidden' });

    const { id: _id, ownerId: _ownerId, createdAt: _c, updatedAt: _u, ...data } = req.body;
    const updated = await prisma.company.update({ where: { id: req.params.id }, data });

    // If location was updated, sync to Redis cache and GEO index
    if (data.location != null) {
      const loc = data.location as Record<string, unknown> | null;
      if (loc && typeof loc.lat === 'number' && typeof loc.lng === 'number') {
        await setWorkspaceLocation(req.params.id, loc.lat, loc.lng);
      }
    }

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/companies/:id/members
router.post('/:id/members', authenticate, async (req: AuthRequest, res: Response) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'Missing userId' });

  try {
    await prisma.companyUser.create({ data: { companyId: req.params.id, userId } });
    await prisma.user.update({ where: { id: userId }, data: { companyId: req.params.id } });
    res.status(201).json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/companies/:id/members/:userId
router.delete('/:id/members/:userId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.companyUser.delete({
      where: { companyId_userId: { companyId: req.params.id, userId: req.params.userId } },
    });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/companies/:id/staff — List company staff with profile photos
router.get('/:id/staff', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const members = await prisma.companyUser.findMany({
      where: { companyId: req.params.id },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            kycLevel0Profile: { select: { id: true } },
          },
        },
      },
    });
    res.json(
      members.map((m) => ({
        id: m.user.id,
        displayName: m.user.displayName,
        firstName: m.user.firstName,
        lastName: m.user.lastName,
        avatarUrl: m.user.avatarUrl,
        role: m.role,
        hasProfilePhoto: !!m.user.avatarUrl,
        kycLevel0Complete: !!m.user.kycLevel0Profile,
      })),
    );
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/companies/:id/portfolio — Update business portfolio (supplementary content only)
router.put('/:id/portfolio', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const company = await prisma.company.findUnique({ where: { id: req.params.id } });
    if (!company) return res.status(404).json({ error: 'Not found' });

    const isOwner = company.ownerId === req.user!.userId;
    const isAdmin = ['platform_admin', 'owner', 'support', 'finance'].includes(req.user!.role);
    if (!isOwner && !isAdmin) return res.status(403).json({ error: 'Forbidden' });

    // Only allow editing supplementary fields — reject KYC-critical fields
    const { slogan, about, logoUrl, coverImageUrl, website, socialLinks, history, mission, galleryUrls, businessHours, tags } = req.body;

    // Update Company editable fields
    const companyData: Record<string, unknown> = {};
    if (slogan !== undefined) companyData.slogan = slogan;
    if (about !== undefined) companyData.about = about;
    if (logoUrl !== undefined) companyData.logoUrl = logoUrl;
    if (coverImageUrl !== undefined) companyData.coverImageUrl = coverImageUrl;
    if (website !== undefined) companyData.website = website;
    if (socialLinks !== undefined) companyData.socialLinks = socialLinks;

    if (Object.keys(companyData).length > 0) {
      await prisma.company.update({
        where: { id: req.params.id },
        data: companyData,
      });
    }

    // Update BusinessPortfolio
    const portfolioData: Record<string, unknown> = {};
    if (history !== undefined) portfolioData.history = history;
    if (mission !== undefined) portfolioData.mission = mission;
    if (galleryUrls !== undefined) portfolioData.galleryUrls = galleryUrls;
    if (businessHours !== undefined) portfolioData.businessHours = businessHours;
    if (tags !== undefined) portfolioData.tags = tags;

    if (Object.keys(portfolioData).length > 0) {
      await prisma.businessPortfolio.upsert({
        where: { companyId: req.params.id },
        update: portfolioData,
        create: {
          companyId: req.params.id,
          ...portfolioData,
        },
      });
    }

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
