import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../lib/db.js';
import { verifyAccessToken } from '../lib/jwt.js';

const router = Router();

// ─── Types ────────────────────────────────────────────────────────────────

interface JwtPayload {
  userId: string;
  role: string;
  email: string;
}

// ─── Middleware ────────────────────────────────────────────────────────────

function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    try {
      (req as any).user = verifyAccessToken(authHeader.slice(7)) as JwtPayload;
    } catch {
      // token invalid — continue as unauthenticated
    }
  }
  next();
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function formatRelativeTime(date: Date): string {
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

// ─── GET /api/home/banner ──────────────────────────────────────────────────
// Returns the active home banner (highest sortOrder that is currently active)
router.get('/banner', optionalAuth, async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const banners = await prisma.homeBanner.findMany({
      where: {
        isActive: true,
        archivedAt: null,
        OR: [
          { startDate: null, endDate: null },
          { startDate: { lte: now }, endDate: null },
          { startDate: null, endDate: { gte: now } },
          { startDate: { lte: now }, endDate: { gte: now } },
        ],
      },
      orderBy: { sortOrder: 'desc' },
      take: 1,
    });

    res.json({ data: banners[0] ?? null });
  } catch (error) {
    console.error('Error fetching home banner:', error);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to fetch home banner' });
  }
});

// ─── GET /api/home/news ────────────────────────────────────────────────────
// Paginated list of published (active, non-expired) news articles
router.get('/news', optionalAuth, async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(String(req.query.pageSize ?? '10'), 10) || 10));
    const category = req.query.category as string | undefined;
    const featured = req.query.featured === 'true' ? true : undefined;

    const now = new Date();
    const where: Record<string, unknown> = {
      isActive: true,
      archivedAt: null,
      publishedAt: { not: null, lte: now },
      OR: [
        { expiresAt: null },
        { expiresAt: { gte: now } },
      ],
    };

    if (category) where.category = category;
    if (featured !== undefined) where.isFeatured = featured;

    const [articles, total] = await Promise.all([
      prisma.homeNewsArticle.findMany({
        where,
        orderBy: [{ isFeatured: 'desc' }, { publishedAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.homeNewsArticle.count({ where }),
    ]);

    res.json({ data: articles, total, page, pageSize });
  } catch (error) {
    console.error('Error fetching home news:', error);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to fetch home news' });
  }
});

// ─── GET /api/home/news/:id ────────────────────────────────────────────────
router.get('/news/:id', optionalAuth, async (req: Request, res: Response) => {
  try {
    const article = await prisma.homeNewsArticle.findUnique({
      where: { id: req.params.id },
    });

    if (!article || article.archivedAt) {
      return res.status(404).json({ code: 'NOT_FOUND', message: 'News article not found' });
    }

    res.json({ data: article });
  } catch (error) {
    console.error('Error fetching news article:', error);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to fetch news article' });
  }
});

// ─── GET /api/home/weather ─────────────────────────────────────────────────
router.get('/weather', optionalAuth, async (_req: Request, res: Response) => {
  try {
    const config = await prisma.weatherConfig.findFirst({
      where: { isEnabled: true },
    });

    if (!config) {
      return res.json({
        data: {
          temp: null,
          condition: 'Unavailable',
          icon: '❓',
          humidity: null,
          windSpeed: null,
          units: 'metric',
          enabled: false,
        },
      });
    }

    // If an external API endpoint is configured, the frontend can use it.
    // For now, return the config so the client knows where to fetch real data.
    res.json({
      data: {
        temp: null,
        condition: 'Configured',
        icon: '🌤️',
        humidity: null,
        windSpeed: null,
        units: config.units,
        enabled: true,
        apiEndpoint: config.apiEndpoint,
        latitude: config.latitude,
        longitude: config.longitude,
      },
    });
  } catch (error) {
    console.error('Error fetching weather config:', error);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to fetch weather config' });
  }
});

// ─── GET /api/home/alerts ──────────────────────────────────────────────────
// Returns active safety alerts (non-expired)
router.get('/alerts', optionalAuth, async (_req: Request, res: Response) => {
  try {
    const now = new Date();
    const alerts = await prisma.safetyAlert.findMany({
      where: {
        isActive: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gte: now } },
        ],
      },
      orderBy: [
        { severity: 'asc' }, // critical first, then warning, then info
        { createdAt: 'desc' },
      ],
      take: 20,
    });

    res.json({ data: alerts });
  } catch (error) {
    console.error('Error fetching safety alerts:', error);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to fetch safety alerts' });
  }
});

// ─── GET /api/home/utility-links ───────────────────────────────────────────
// Paginated utility links by category
router.get('/utility-links', optionalAuth, async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize ?? '20'), 10) || 20));
    const category = req.query.category as string | undefined;

    const where: Record<string, unknown> = {
      isActive: true,
      archivedAt: null,
    };
    if (category) where.category = category;

    const [links, total] = await Promise.all([
      prisma.utilityLink.findMany({
        where,
        orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.utilityLink.count({ where }),
    ]);

    res.json({ data: links, total, page, pageSize });
  } catch (error) {
    console.error('Error fetching utility links:', error);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to fetch utility links' });
  }
});

// ─── POST /api/home/utility-links/:id/click ────────────────────────────────
const clickBodySchema = z.object({
  ipHash: z.string().optional(),
});

router.post('/utility-links/:id/click', optionalAuth, async (req: Request, res: Response) => {
  try {
    const parsed = clickBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'Invalid request body',
        details: parsed.error.flatten(),
      });
    }

    const link = await prisma.utilityLink.findUnique({
      where: { id: req.params.id },
    });

    if (!link || link.archivedAt) {
      return res.status(404).json({ code: 'NOT_FOUND', message: 'Utility link not found' });
    }

    const userId = (req as any).user?.userId ?? null;
    const ipHash = parsed.data.ipHash ?? null;

    // Check if this is a unique click (by userId or ipHash)
    let isUnique = false;
    if (userId || ipHash) {
      const existingClick = await prisma.utilityLinkClick.findFirst({
        where: {
          linkId: req.params.id,
          ...(userId ? { userId } : {}),
          ...(ipHash && !userId ? { ipHash } : {}),
        },
      });
      isUnique = !existingClick;
    }

    // Increment clickCount always, uniqueClicks only if unique
    await prisma.utilityLink.update({
      where: { id: req.params.id },
      data: {
        clickCount: { increment: 1 },
        ...(isUnique ? { uniqueClicks: { increment: 1 } } : {}),
      },
    });

    await prisma.utilityLinkClick.create({
      data: {
        linkId: req.params.id,
        userId,
        ipHash,
      },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error tracking utility link click:', error);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to track click' });
  }
});

// ─── GET /api/home/search ──────────────────────────────────────────────────
// Public search endpoint — searches services and categories
const searchQuerySchema = z.object({
  q: z.string().trim().min(2, 'Search query must be at least 2 characters'),
});

router.get('/search', async (req: Request, res: Response): Promise<void> => {
  try {
    const { q } = searchQuerySchema.parse(req.query);

    // Search services
    const services = await prisma.serviceCatalog.findMany({
      where: {
        isActive: true,
        archivedAt: null,
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
          { slug: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        name: true,
        category_: { select: { name: true } },
      },
      take: 8,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    // Search categories
    const categories = await prisma.category.findMany({
      where: {
        name: { contains: q, mode: 'insensitive' },
        archivedAt: null,
      },
      select: { id: true, name: true },
      take: 3,
      orderBy: { name: 'asc' },
    });

    const results: Array<{
      id: string;
      type: 'service' | 'business' | 'category' | 'skill';
      title: string;
      subtitle: string | null;
      imageUrl: string | null;
      rating?: number;
      price?: number;
      distance?: number;
      availableNow?: boolean;
    }> = [];

    for (const s of services) {
      results.push({
        id: s.id,
        type: 'service',
        title: s.name,
        subtitle: s.category_?.name ?? null,
        imageUrl: null,
      });
    }

    for (const c of categories) {
      results.push({
        id: c.id,
        type: 'category',
        title: c.name,
        subtitle: null,
        imageUrl: null,
      });
    }

    res.json({ data: results });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: error.issues.map((e: z.ZodIssue) => e.message).join(', '),
      });
      return;
    }
    console.error('Error in /home/search:', error);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Search failed' });
  }
});

export default router;
