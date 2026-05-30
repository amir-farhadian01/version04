import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../lib/db.js';
import { verifyAccessToken, JwtPayload } from '../lib/jwt.js';
import { isDataSafe } from '../lib/privacyThreshold.js';

const router = Router();

/**
 * Optional auth middleware — attaches user if token present, continues regardless.
 */
function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    try {
      (req as any).user = verifyAccessToken(authHeader.slice(7));
    } catch {
      // token invalid — continue as unauthenticated
    }
  }
  next();
}

/**
 * Format a relative time string (e.g., "2h ago", "45m ago").
 */
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

/**
 * Get category color for news items (matching the Flutter/React UI).
 */
function getCategoryColor(category: string): string {
  switch (category) {
    case 'weather': return 'var(--warn)';
    case 'police': return 'var(--warn)';
    case 'events': return 'var(--secondary)';
    case 'business': return 'var(--purple)';
    case 'market': return 'var(--primary)';
    default: return 'var(--primary)';
  }
}

/**
 * Get event gradient based on category.
 */
function getEventGradient(category: string): [string, string] {
  switch (category) {
    case 'events': return ['rgba(15,201,138,0.33)', '#001105'] as [string, string];
    case 'business': return ['rgba(255,122,43,0.33)', '#210a00'] as [string, string];
    case 'market': return ['rgba(43,110,255,0.33)', '#000a21'] as [string, string];
    default: return ['rgba(43,110,255,0.33)', '#000a21'] as [string, string];
  }
}

// GET /api/home — aggregated Home screen data
router.get('/', optionalAuth, async (req: Request, res: Response) => {
  try {
    const city = (req.query.city as string) || 'Vaughan';
    const neighborhood = req.query.neighborhood as string | undefined;
    const lat = req.query.lat ? parseFloat(req.query.lat as string) : undefined;
    const lng = req.query.lng ? parseFloat(req.query.lng as string) : undefined;

    // ── 1. News Articles ──────────────────────────────────────────────
    const newsArticles = await prisma.homeNewsArticle.findMany({
      where: {
        publishedAt: { not: null, lte: new Date() },
        archivedAt: null,
        isActive: true,
      },
      orderBy: [{ publishedAt: 'desc' }],
      take: 10,
    });

    const news = newsArticles.map((a) => ({
      id: a.id,
      title: a.title,
      summary: a.summary ?? a.body.substring(0, 120),
      body: a.body,
      category: a.category,
      color: getCategoryColor(a.category),
      time: a.publishedAt ? formatRelativeTime(a.publishedAt) : '',
      imageUrl: a.imageUrl,
    }));

    // Separate events from news
    const events = newsArticles
      .filter((a) => a.category === 'events')
      .map((a) => ({
        id: a.id,
        name: a.title,
        date: a.summary ?? a.publishedAt?.toLocaleDateString() ?? '',
        gradient: getEventGradient(a.category),
      }));

    // ── 2. Utility Links ──────────────────────────────────────────────
    const utilityLinks = await prisma.utilityLink.findMany({
      where: { isActive: true, archivedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const services = utilityLinks.map((l) => ({
      id: l.id,
      title: l.title,
      url: l.url,
      description: l.description,
      category: l.category,
      iconUrl: l.iconUrl,
    }));

    // ── 3. Service Rates (if available for location) ──────────────────
    let serviceRates: Array<{
      serviceName: string;
      avgPrice: number;
      minPrice: number;
      maxPrice: number;
      sampleSize: number;
    }> = [];

    if (city) {
      const ratesWhere: Record<string, unknown> = { city };
      if (neighborhood) ratesWhere.neighborhood = neighborhood;

      const rates = await prisma.serviceRateByLocation.findMany({
        where: ratesWhere,
        orderBy: { serviceName: 'asc' },
        take: 10,
      });

      serviceRates = rates
        .filter((r) => isDataSafe(r.sampleSize))
        .map((r) => ({
          serviceName: r.serviceName,
          avgPrice: Number(r.avgPrice),
          minPrice: Number(r.minPrice),
          maxPrice: Number(r.maxPrice),
          sampleSize: r.sampleSize,
        }));
    }

    // ── 4. Market Data ────────────────────────────────────────────────
    let marketData: Record<string, unknown> = {
      avgServicePrice: null,
      activeProviders: null,
      topCategories: [],
    };

    if (city) {
      const demandWhere: Record<string, unknown> = {
        city,
        periodEnd: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      };
      if (neighborhood) demandWhere.neighborhood = neighborhood;

      const recentDemand = await prisma.demandAnalytics.findMany({
        where: demandWhere,
        orderBy: { periodStart: 'desc' },
        take: 1,
      });

      const safeRates = serviceRates.filter((r) => isDataSafe(r.sampleSize));
      const avgPrice = safeRates.length > 0
        ? safeRates.reduce((sum, r) => sum + r.avgPrice, 0) / safeRates.length
        : null;

      marketData = {
        avgServicePrice: avgPrice ? Math.round(avgPrice * 100) / 100 : null,
        activeProviders: recentDemand.length > 0 ? recentDemand[0].uniqueClients : null,
        topCategories: [], // Could be enriched from demand analytics
      };
    }

    // ── 5. Weather (placeholder — real API integration TBD) ───────────
    const weather = {
      temp: 13,
      condition: 'Sunny',
      icon: '☀️',
      humidity: null as number | null,
      windSpeed: null as number | null,
    };

    // ── 6. Police Alerts (placeholder — real API integration TBD) ─────
    const policeAlerts: Array<{
      title: string;
      description: string;
      severity: string;
      time: string;
    }> = [];

    // ── 7. Location Info ──────────────────────────────────────────────
    const location = {
      city,
      neighborhood: neighborhood ?? null,
      shortLocation: `${city}${city ? ', ON' : ''}`,
    };

    res.json({
      location,
      weather,
      policeAlerts,
      news,
      events,
      marketData,
      serviceRates,
      utilityLinks: services,
    });
  } catch (error) {
    console.error('Error fetching home screen data:', error);
    res.status(500).json({ error: 'Failed to fetch home screen data' });
  }
});

export default router;
