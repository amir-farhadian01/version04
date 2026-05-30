import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticate, requireRole, AuthRequest } from '../lib/auth.middleware.js';
import prisma from '../lib/db.js';

const router = Router();

router.use(authenticate);
router.use(requireRole('platform_admin'));

// ─── Zod Schemas ───────────────────────────────────────────────────────────

const bannerSchema = z.object({
  title: z.string().min(1),
  subtitle: z.string().optional(),
  imageUrl: z.string().url().optional().nullable(),
  linkUrl: z.string().url().optional().nullable(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  startDate: z.string().datetime().optional().nullable(),
  endDate: z.string().datetime().optional().nullable(),
});

const bannerUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  subtitle: z.string().optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
  linkUrl: z.string().url().optional().nullable(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  startDate: z.string().datetime().optional().nullable(),
  endDate: z.string().datetime().optional().nullable(),
});

const newsArticleSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  summary: z.string().optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
  category: z.enum(['sports', 'community', 'events', 'city', 'promotions']),
  isActive: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  publishedAt: z.string().datetime().optional().nullable(),
  scheduledAt: z.string().datetime().optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
});

const newsArticleUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  body: z.string().min(1).optional(),
  summary: z.string().optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
  category: z.enum(['sports', 'community', 'events', 'city', 'promotions']).optional(),
  isActive: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  publishedAt: z.string().datetime().optional().nullable(),
  scheduledAt: z.string().datetime().optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
});

const weatherConfigSchema = z.object({
  apiKey: z.string().optional().nullable(),
  apiEndpoint: z.string().url().optional().nullable(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  units: z.enum(['metric', 'imperial']).optional(),
  isEnabled: z.boolean().optional(),
});

const trafficSourceSchema = z.object({
  name: z.string().min(1),
  apiEndpoint: z.string().url().optional().nullable(),
  apiKey: z.string().optional().nullable(),
  isEnabled: z.boolean().optional(),
  region: z.string().optional().nullable(),
});

const trafficSourceUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  apiEndpoint: z.string().url().optional().nullable(),
  apiKey: z.string().optional().nullable(),
  isEnabled: z.boolean().optional(),
  region: z.string().optional().nullable(),
});

const safetyAlertSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  severity: z.enum(['info', 'warning', 'critical']).optional(),
  location: z.string().optional().nullable(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  source: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  expiresAt: z.string().datetime().optional().nullable(),
});

const safetyAlertUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  severity: z.enum(['info', 'warning', 'critical']).optional(),
  location: z.string().optional().nullable(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  source: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  expiresAt: z.string().datetime().optional().nullable(),
});

const utilityLinkSchema = z.object({
  title: z.string().min(1),
  url: z.string().url(),
  category: z.enum(['banks', 'insurance', 'fuel', 'government', 'health', 'transit', 'custom']),
  iconUrl: z.string().url().optional().nullable(),
  description: z.string().optional().nullable(),
  commissionRate: z.number().min(0).max(100).optional().nullable(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

const utilityLinkUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  url: z.string().url().optional(),
  category: z.enum(['banks', 'insurance', 'fuel', 'government', 'health', 'transit', 'custom']).optional(),
  iconUrl: z.string().url().optional().nullable(),
  description: z.string().optional().nullable(),
  commissionRate: z.number().min(0).max(100).optional().nullable(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

const insightConfigUpdateSchema = z.object({
  isEnabled: z.boolean().optional(),
  minDataThreshold: z.number().int().min(1).optional(),
  granularity: z.enum(['city', 'neighbourhood', 'street']).optional(),
  refreshHours: z.number().int().min(1).optional(),
  displayPriority: z.number().int().optional(),
});

// ─── Helper ─────────────────────────────────────────────────────────────────

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

// ═══════════════════════════════════════════════════════════════════════════
// BANNERS
// ═══════════════════════════════════════════════════════════════════════════

// GET /api/admin/home/banners
router.get('/banners', async (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize ?? '20'), 10) || 20));
    const includeArchived = req.query.includeArchived === 'true';

    const where: Record<string, unknown> = {};
    if (!includeArchived) where.archivedAt = null;

    const [banners, total] = await Promise.all([
      prisma.homeBanner.findMany({
        where,
        orderBy: [{ sortOrder: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.homeBanner.count({ where }),
    ]);

    res.json({ data: banners, total, page, pageSize });
  } catch (error) {
    console.error('Error fetching banners:', error);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to fetch banners' });
  }
});

// POST /api/admin/home/banners
router.post('/banners', async (req: AuthRequest, res: Response) => {
  try {
    const parsed = bannerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'Invalid banner data',
        details: parsed.error.flatten(),
      });
    }

    const { title, subtitle, imageUrl, linkUrl, isActive, sortOrder, startDate, endDate } = parsed.data;

    const banner = await prisma.homeBanner.create({
      data: {
        title,
        subtitle: subtitle ?? null,
        imageUrl: imageUrl ?? null,
        linkUrl: linkUrl ?? null,
        isActive: isActive ?? true,
        sortOrder: sortOrder ?? 0,
        startDate: parseDate(startDate),
        endDate: parseDate(endDate),
      },
    });

    res.status(201).json({ data: banner });
  } catch (error) {
    console.error('Error creating banner:', error);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to create banner' });
  }
});

// PUT /api/admin/home/banners/:id
router.put('/banners/:id', async (req: AuthRequest, res: Response) => {
  try {
    const parsed = bannerUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'Invalid banner data',
        details: parsed.error.flatten(),
      });
    }

    const existing = await prisma.homeBanner.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ code: 'NOT_FOUND', message: 'Banner not found' });
    }

    const data: Record<string, unknown> = {};
    const { title, subtitle, imageUrl, linkUrl, isActive, sortOrder, startDate, endDate } = parsed.data;
    if (title !== undefined) data.title = title;
    if (subtitle !== undefined) data.subtitle = subtitle;
    if (imageUrl !== undefined) data.imageUrl = imageUrl;
    if (linkUrl !== undefined) data.linkUrl = linkUrl;
    if (isActive !== undefined) data.isActive = isActive;
    if (sortOrder !== undefined) data.sortOrder = sortOrder;
    if (startDate !== undefined) data.startDate = parseDate(startDate);
    if (endDate !== undefined) data.endDate = parseDate(endDate);

    const banner = await prisma.homeBanner.update({
      where: { id: req.params.id },
      data,
    });

    res.json({ data: banner });
  } catch (error) {
    console.error('Error updating banner:', error);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to update banner' });
  }
});

// DELETE /api/admin/home/banners/:id — archive (soft delete)
router.delete('/banners/:id', async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.homeBanner.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ code: 'NOT_FOUND', message: 'Banner not found' });
    }

    const banner = await prisma.homeBanner.update({
      where: { id: req.params.id },
      data: { archivedAt: new Date(), isActive: false },
    });

    res.json({ data: banner });
  } catch (error) {
    console.error('Error archiving banner:', error);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to archive banner' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// NEWS
// ═══════════════════════════════════════════════════════════════════════════

// GET /api/admin/home/news
router.get('/news', async (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize ?? '20'), 10) || 20));
    const category = req.query.category as string | undefined;
    const includeArchived = req.query.includeArchived === 'true';

    const where: Record<string, unknown> = {};
    if (!includeArchived) where.archivedAt = null;
    if (category) where.category = category;

    const [articles, total] = await Promise.all([
      prisma.homeNewsArticle.findMany({
        where,
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.homeNewsArticle.count({ where }),
    ]);

    res.json({ data: articles, total, page, pageSize });
  } catch (error) {
    console.error('Error fetching news articles:', error);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to fetch news articles' });
  }
});

// POST /api/admin/home/news
router.post('/news', async (req: AuthRequest, res: Response) => {
  try {
    const parsed = newsArticleSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'Invalid news article data',
        details: parsed.error.flatten(),
      });
    }

    const { title, body, summary, imageUrl, category, isActive, isFeatured, publishedAt, scheduledAt, expiresAt } = parsed.data;

    const article = await prisma.homeNewsArticle.create({
      data: {
        title,
        body,
        summary: summary ?? null,
        imageUrl: imageUrl ?? null,
        category,
        isActive: isActive ?? true,
        isFeatured: isFeatured ?? false,
        publishedAt: parseDate(publishedAt),
        scheduledAt: parseDate(scheduledAt),
        expiresAt: parseDate(expiresAt),
      },
    });

    res.status(201).json({ data: article });
  } catch (error) {
    console.error('Error creating news article:', error);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to create news article' });
  }
});

// PUT /api/admin/home/news/:id
router.put('/news/:id', async (req: AuthRequest, res: Response) => {
  try {
    const parsed = newsArticleUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'Invalid news article data',
        details: parsed.error.flatten(),
      });
    }

    const existing = await prisma.homeNewsArticle.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ code: 'NOT_FOUND', message: 'News article not found' });
    }

    const data: Record<string, unknown> = {};
    const { title, body, summary, imageUrl, category, isActive, isFeatured, publishedAt, scheduledAt, expiresAt } = parsed.data;
    if (title !== undefined) data.title = title;
    if (body !== undefined) data.body = body;
    if (summary !== undefined) data.summary = summary;
    if (imageUrl !== undefined) data.imageUrl = imageUrl;
    if (category !== undefined) data.category = category;
    if (isActive !== undefined) data.isActive = isActive;
    if (isFeatured !== undefined) data.isFeatured = isFeatured;
    if (publishedAt !== undefined) data.publishedAt = parseDate(publishedAt);
    if (scheduledAt !== undefined) data.scheduledAt = parseDate(scheduledAt);
    if (expiresAt !== undefined) data.expiresAt = parseDate(expiresAt);

    const article = await prisma.homeNewsArticle.update({
      where: { id: req.params.id },
      data,
    });

    res.json({ data: article });
  } catch (error) {
    console.error('Error updating news article:', error);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to update news article' });
  }
});

// DELETE /api/admin/home/news/:id — archive (soft delete)
router.delete('/news/:id', async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.homeNewsArticle.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ code: 'NOT_FOUND', message: 'News article not found' });
    }

    const article = await prisma.homeNewsArticle.update({
      where: { id: req.params.id },
      data: { archivedAt: new Date(), isActive: false },
    });

    res.json({ data: article });
  } catch (error) {
    console.error('Error archiving news article:', error);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to archive news article' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// WEATHER CONFIG
// ═══════════════════════════════════════════════════════════════════════════

// GET /api/admin/home/weather-config
router.get('/weather-config', async (_req: AuthRequest, res: Response) => {
  try {
    const config = await prisma.weatherConfig.findFirst();
    // Auto-create default config if none exists
    if (!config) {
      const newConfig = await prisma.weatherConfig.create({ data: {} });
      return res.json({ data: newConfig });
    }
    res.json({ data: config });
  } catch (error) {
    console.error('Error fetching weather config:', error);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to fetch weather config' });
  }
});

// PUT /api/admin/home/weather-config
router.put('/weather-config', async (req: AuthRequest, res: Response) => {
  try {
    const parsed = weatherConfigSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'Invalid weather config data',
        details: parsed.error.flatten(),
      });
    }

    const data: Record<string, unknown> = {};
    const { apiKey, apiEndpoint, latitude, longitude, units, isEnabled } = parsed.data;
    if (apiKey !== undefined) data.apiKey = apiKey;
    if (apiEndpoint !== undefined) data.apiEndpoint = apiEndpoint;
    if (latitude !== undefined) data.latitude = latitude;
    if (longitude !== undefined) data.longitude = longitude;
    if (units !== undefined) data.units = units;
    if (isEnabled !== undefined) data.isEnabled = isEnabled;

    let config = await prisma.weatherConfig.findFirst();
    if (config) {
      config = await prisma.weatherConfig.update({
        where: { id: config.id },
        data,
      });
    } else {
      config = await prisma.weatherConfig.create({ data });
    }

    res.json({ data: config });
  } catch (error) {
    console.error('Error updating weather config:', error);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to update weather config' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// TRAFFIC SOURCES
// ═══════════════════════════════════════════════════════════════════════════

// GET /api/admin/home/traffic-sources
router.get('/traffic-sources', async (_req: AuthRequest, res: Response) => {
  try {
    const sources = await prisma.trafficAlertSource.findMany({
      orderBy: { name: 'asc' },
    });
    res.json({ data: sources });
  } catch (error) {
    console.error('Error fetching traffic sources:', error);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to fetch traffic sources' });
  }
});

// POST /api/admin/home/traffic-sources
router.post('/traffic-sources', async (req: AuthRequest, res: Response) => {
  try {
    const parsed = trafficSourceSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'Invalid traffic source data',
        details: parsed.error.flatten(),
      });
    }

    const { name, apiEndpoint, apiKey, isEnabled, region } = parsed.data;

    const source = await prisma.trafficAlertSource.create({
      data: {
        name,
        apiEndpoint: apiEndpoint ?? null,
        apiKey: apiKey ?? null,
        isEnabled: isEnabled ?? false,
        region: region ?? null,
      },
    });

    res.status(201).json({ data: source });
  } catch (error) {
    console.error('Error creating traffic source:', error);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to create traffic source' });
  }
});

// PUT /api/admin/home/traffic-sources/:id
router.put('/traffic-sources/:id', async (req: AuthRequest, res: Response) => {
  try {
    const parsed = trafficSourceUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'Invalid traffic source data',
        details: parsed.error.flatten(),
      });
    }

    const existing = await prisma.trafficAlertSource.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ code: 'NOT_FOUND', message: 'Traffic source not found' });
    }

    const data: Record<string, unknown> = {};
    const { name, apiEndpoint, apiKey, isEnabled, region } = parsed.data;
    if (name !== undefined) data.name = name;
    if (apiEndpoint !== undefined) data.apiEndpoint = apiEndpoint;
    if (apiKey !== undefined) data.apiKey = apiKey;
    if (isEnabled !== undefined) data.isEnabled = isEnabled;
    if (region !== undefined) data.region = region;

    const source = await prisma.trafficAlertSource.update({
      where: { id: req.params.id },
      data,
    });

    res.json({ data: source });
  } catch (error) {
    console.error('Error updating traffic source:', error);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to update traffic source' });
  }
});

// DELETE /api/admin/home/traffic-sources/:id — hard delete
router.delete('/traffic-sources/:id', async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.trafficAlertSource.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ code: 'NOT_FOUND', message: 'Traffic source not found' });
    }

    await prisma.trafficAlertSource.delete({ where: { id: req.params.id } });

    res.json({ data: null });
  } catch (error) {
    console.error('Error deleting traffic source:', error);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to delete traffic source' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// SAFETY ALERTS
// ═══════════════════════════════════════════════════════════════════════════

// GET /api/admin/home/safety-alerts
router.get('/safety-alerts', async (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize ?? '20'), 10) || 20));
    const severity = req.query.severity as string | undefined;

    const where: Record<string, unknown> = {};
    if (severity) where.severity = severity;

    const [alerts, total] = await Promise.all([
      prisma.safetyAlert.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.safetyAlert.count({ where }),
    ]);

    res.json({ data: alerts, total, page, pageSize });
  } catch (error) {
    console.error('Error fetching safety alerts:', error);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to fetch safety alerts' });
  }
});

// POST /api/admin/home/safety-alerts
router.post('/safety-alerts', async (req: AuthRequest, res: Response) => {
  try {
    const parsed = safetyAlertSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'Invalid safety alert data',
        details: parsed.error.flatten(),
      });
    }

    const { title, description, severity, location, latitude, longitude, source, isActive, expiresAt } = parsed.data;

    const alert = await prisma.safetyAlert.create({
      data: {
        title,
        description: description ?? null,
        severity: severity ?? 'info',
        location: location ?? null,
        latitude: latitude ?? null,
        longitude: longitude ?? null,
        source: source ?? null,
        isActive: isActive ?? true,
        expiresAt: parseDate(expiresAt),
      },
    });

    res.status(201).json({ data: alert });
  } catch (error) {
    console.error('Error creating safety alert:', error);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to create safety alert' });
  }
});

// PUT /api/admin/home/safety-alerts/:id
router.put('/safety-alerts/:id', async (req: AuthRequest, res: Response) => {
  try {
    const parsed = safetyAlertUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'Invalid safety alert data',
        details: parsed.error.flatten(),
      });
    }

    const existing = await prisma.safetyAlert.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ code: 'NOT_FOUND', message: 'Safety alert not found' });
    }

    const data: Record<string, unknown> = {};
    const { title, description, severity, location, latitude, longitude, source, isActive, expiresAt } = parsed.data;
    if (title !== undefined) data.title = title;
    if (description !== undefined) data.description = description;
    if (severity !== undefined) data.severity = severity;
    if (location !== undefined) data.location = location;
    if (latitude !== undefined) data.latitude = latitude;
    if (longitude !== undefined) data.longitude = longitude;
    if (source !== undefined) data.source = source;
    if (isActive !== undefined) data.isActive = isActive;
    if (expiresAt !== undefined) data.expiresAt = parseDate(expiresAt);

    const alert = await prisma.safetyAlert.update({
      where: { id: req.params.id },
      data,
    });

    res.json({ data: alert });
  } catch (error) {
    console.error('Error updating safety alert:', error);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to update safety alert' });
  }
});

// DELETE /api/admin/home/safety-alerts/:id — archive (set isActive=false)
router.delete('/safety-alerts/:id', async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.safetyAlert.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ code: 'NOT_FOUND', message: 'Safety alert not found' });
    }

    const alert = await prisma.safetyAlert.update({
      where: { id: req.params.id },
      data: { isActive: false, expiresAt: new Date() },
    });

    res.json({ data: alert });
  } catch (error) {
    console.error('Error archiving safety alert:', error);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to archive safety alert' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// UTILITY LINKS
// ═══════════════════════════════════════════════════════════════════════════

// GET /api/admin/home/utility-links
router.get('/utility-links', async (req: AuthRequest, res: Response) => {
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

// POST /api/admin/home/utility-links
router.post('/utility-links', async (req: AuthRequest, res: Response) => {
  try {
    const parsed = utilityLinkSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'Invalid utility link data',
        details: parsed.error.flatten(),
      });
    }

    const { title, url, category, iconUrl, description, commissionRate, isActive, sortOrder } = parsed.data;

    const link = await prisma.utilityLink.create({
      data: {
        title,
        url,
        category,
        iconUrl: iconUrl ?? null,
        description: description ?? null,
        commissionRate: commissionRate ?? null,
        isActive: isActive ?? true,
        sortOrder: sortOrder ?? 0,
      },
    });

    res.status(201).json({ data: link });
  } catch (error) {
    console.error('Error creating utility link:', error);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to create utility link' });
  }
});

// PUT /api/admin/home/utility-links/:id
router.put('/utility-links/:id', async (req: AuthRequest, res: Response) => {
  try {
    const parsed = utilityLinkUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'Invalid utility link data',
        details: parsed.error.flatten(),
      });
    }

    const existing = await prisma.utilityLink.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ code: 'NOT_FOUND', message: 'Utility link not found' });
    }

    const data: Record<string, unknown> = {};
    const { title, url, category, iconUrl, description, commissionRate, isActive, sortOrder } = parsed.data;
    if (title !== undefined) data.title = title;
    if (url !== undefined) data.url = url;
    if (category !== undefined) data.category = category;
    if (iconUrl !== undefined) data.iconUrl = iconUrl;
    if (description !== undefined) data.description = description;
    if (commissionRate !== undefined) data.commissionRate = commissionRate;
    if (isActive !== undefined) data.isActive = isActive;
    if (sortOrder !== undefined) data.sortOrder = sortOrder;

    const link = await prisma.utilityLink.update({
      where: { id: req.params.id },
      data,
    });

    res.json({ data: link });
  } catch (error) {
    console.error('Error updating utility link:', error);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to update utility link' });
  }
});

// DELETE /api/admin/home/utility-links/:id — archive (soft delete)
router.delete('/utility-links/:id', async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.utilityLink.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ code: 'NOT_FOUND', message: 'Utility link not found' });
    }

    const link = await prisma.utilityLink.update({
      where: { id: req.params.id },
      data: { archivedAt: new Date(), isActive: false },
    });

    res.json({ data: link });
  } catch (error) {
    console.error('Error archiving utility link:', error);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to archive utility link' });
  }
});

// GET /api/admin/home/utility-links/stats — click statistics
router.get('/utility-links/stats', async (_req: AuthRequest, res: Response) => {
  try {
    const [totalLinks, activeLinks, totalClicks, uniqueClicks, totalRevenue, categoryCounts] = await Promise.all([
      prisma.utilityLink.count({ where: { archivedAt: null } }),
      prisma.utilityLink.count({ where: { isActive: true, archivedAt: null } }),
      prisma.utilityLink.aggregate({ _sum: { clickCount: true } }),
      prisma.utilityLink.aggregate({ _sum: { uniqueClicks: true } }),
      prisma.utilityLink.aggregate({ _sum: { revenue: true } }),
      prisma.utilityLink.groupBy({
        by: ['category'],
        where: { archivedAt: null },
        _count: { id: true },
        _sum: { clickCount: true, revenue: true },
      }),
    ]);

    res.json({
      data: {
        totalLinks,
        activeLinks,
        totalClicks: totalClicks._sum.clickCount ?? 0,
        uniqueClicks: uniqueClicks._sum.uniqueClicks ?? 0,
        totalRevenue: totalRevenue._sum.revenue ?? 0,
        categoryCounts: categoryCounts.map((c) => ({
          category: c.category,
          count: c._count.id,
          clickCount: c._sum.clickCount ?? 0,
          revenue: c._sum.revenue ?? 0,
        })),
      },
    });
  } catch (error) {
    console.error('Error fetching utility link stats:', error);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to fetch utility link stats' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// INSIGHTS CONFIG
// ═══════════════════════════════════════════════════════════════════════════

// GET /api/admin/home/insights-config
router.get('/insights-config', async (_req: AuthRequest, res: Response) => {
  try {
    const configs = await prisma.localInsightConfig.findMany({
      orderBy: { displayPriority: 'asc' },
    });

    res.json({ data: configs });
  } catch (error) {
    console.error('Error fetching insights config:', error);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to fetch insights config' });
  }
});

// PUT /api/admin/home/insights-config/:id
router.put('/insights-config/:id', async (req: AuthRequest, res: Response) => {
  try {
    const parsed = insightConfigUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'Invalid insights config data',
        details: parsed.error.flatten(),
      });
    }

    const existing = await prisma.localInsightConfig.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ code: 'NOT_FOUND', message: 'Insight config not found' });
    }

    const data: Record<string, unknown> = {};
    const { isEnabled, minDataThreshold, granularity, refreshHours, displayPriority } = parsed.data;
    if (isEnabled !== undefined) data.isEnabled = isEnabled;
    if (minDataThreshold !== undefined) data.minDataThreshold = minDataThreshold;
    if (granularity !== undefined) data.granularity = granularity;
    if (refreshHours !== undefined) data.refreshHours = refreshHours;
    if (displayPriority !== undefined) data.displayPriority = displayPriority;

    const config = await prisma.localInsightConfig.update({
      where: { id: req.params.id },
      data,
    });

    res.json({ data: config });
  } catch (error) {
    console.error('Error updating insights config:', error);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to update insights config' });
  }
});

export default router;