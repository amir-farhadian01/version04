import { Router, Response } from 'express';
import { authenticate, requireRole, AuthRequest } from '../lib/auth.middleware.js';
import prisma from '../lib/db.js';

const router = Router();

router.use(authenticate);
router.use(requireRole('platform_admin'));

// GET /api/admin/utility-links — list all utility links (including archived)
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize ?? '20'), 10) || 20));
    const category = req.query.category as string | undefined;
    const includeArchived = req.query.includeArchived === 'true';

    const where: Record<string, unknown> = {};
    if (!includeArchived) where.archivedAt = null;
    if (category) where.category = category;

    const [links, total] = await Promise.all([
      prisma.utilityLink.findMany({
        where,
        include: { _count: { select: { clicks: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.utilityLink.count({ where }),
    ]);

    res.json({ data: links, total, page, pageSize });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch utility links' });
  }
});

// GET /api/admin/utility-links/stats — aggregate click stats
router.get('/stats', async (_req: AuthRequest, res: Response) => {
  try {
    const [totalLinks, activeLinks, totalClicks, categoryCounts] = await Promise.all([
      prisma.utilityLink.count({ where: { archivedAt: null } }),
      prisma.utilityLink.count({ where: { isActive: true, archivedAt: null } }),
      prisma.utilityLink.aggregate({ _sum: { clickCount: true } }),
      prisma.utilityLink.groupBy({
        by: ['category'],
        where: { archivedAt: null },
        _count: { id: true },
      }),
    ]);

    res.json({
      totalLinks,
      activeLinks,
      totalClicks: totalClicks._sum.clickCount ?? 0,
      categoryCounts: categoryCounts.map((c) => ({
        category: c.category,
        count: c._count.id,
      })),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch utility link stats' });
  }
});

// POST /api/admin/utility-links — create a new utility link
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { title, url, description, category, iconUrl, commissionRate, isActive } = req.body as {
      title?: string;
      url?: string;
      description?: string;
      category?: string;
      iconUrl?: string;
      commissionRate?: number;
      isActive?: boolean;
    };

    if (!title || !url || !category) {
      return res.status(400).json({ error: 'title, url, and category are required' });
    }

    const link = await prisma.utilityLink.create({
      data: {
        title,
        url,
        description: description ?? null,
        category,
        iconUrl: iconUrl ?? null,
        commissionRate: commissionRate ?? null,
        isActive: isActive ?? true,
      },
    });

    res.status(201).json(link);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create utility link' });
  }
});

// PUT /api/admin/utility-links/:id — update a utility link
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { title, url, description, category, iconUrl, commissionRate, isActive } = req.body as {
      title?: string;
      url?: string;
      description?: string;
      category?: string;
      iconUrl?: string;
      commissionRate?: number;
      isActive?: boolean;
    };

    const existing = await prisma.utilityLink.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ error: 'Utility link not found' });
    }

    const link = await prisma.utilityLink.update({
      where: { id: req.params.id },
      data: {
        ...(title !== undefined && { title }),
        ...(url !== undefined && { url }),
        ...(description !== undefined && { description }),
        ...(category !== undefined && { category }),
        ...(iconUrl !== undefined && { iconUrl }),
        ...(commissionRate !== undefined && { commissionRate }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    res.json(link);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update utility link' });
  }
});

// POST /api/admin/utility-links/:id/archive — soft-delete a utility link
router.post('/:id/archive', async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.utilityLink.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ error: 'Utility link not found' });
    }

    const link = await prisma.utilityLink.update({
      where: { id: req.params.id },
      data: { archivedAt: new Date(), isActive: false },
    });

    res.json(link);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to archive utility link' });
  }
});

// POST /api/admin/utility-links/:id/restore — restore an archived utility link
router.post('/:id/restore', async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.utilityLink.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ error: 'Utility link not found' });
    }

    const link = await prisma.utilityLink.update({
      where: { id: req.params.id },
      data: { archivedAt: null, isActive: true },
    });

    res.json(link);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to restore utility link' });
  }
});

export default router;
