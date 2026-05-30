import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../lib/db.js';
import { verifyAccessToken, JwtPayload } from '../lib/jwt.js';
import { isDataSafe, anonymizeData } from '../lib/privacyThreshold.js';

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

// GET /api/home-intelligence/market-data — aggregate market overview for a city/neighborhood
router.get('/market-data', optionalAuth, async (req: Request, res: Response) => {
  try {
    const city = (req.query.city as string) || '';
    const neighborhood = req.query.neighborhood as string | undefined;

    if (!city) {
      return res.status(400).json({ error: 'city query parameter is required' });
    }

    const where: Record<string, unknown> = { city };
    if (neighborhood) where.neighborhood = neighborhood;

    // Get service rates for the location
    const serviceRates = await prisma.serviceRateByLocation.findMany({
      where,
      orderBy: { computedAt: 'desc' },
    });

    // Get demand analytics for the location
    const demandAnalytics = await prisma.demandAnalytics.findMany({
      where: {
        ...where,
        periodEnd: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }, // last 30 days
      },
      orderBy: { periodStart: 'desc' },
      take: 1,
    });

    // Compute aggregate stats
    const safeRates = serviceRates.filter((r) => isDataSafe(r.sampleSize));
    const avgPrice = safeRates.length > 0
      ? safeRates.reduce((sum, r) => sum + Number(r.avgPrice), 0) / safeRates.length
      : null;

    const totalProviders = demandAnalytics.length > 0
      ? demandAnalytics[0].uniqueClients
      : null;

    // Top categories by order count
    const topCategories = await prisma.demandAnalytics.groupBy({
      by: ['categoryId'],
      where: {
        city,
        ...(neighborhood ? { neighborhood } : {}),
        categoryId: { not: null },
      },
      _sum: { orderCount: true },
      orderBy: { _sum: { orderCount: 'desc' } },
      take: 5,
    });

    const topCategoryNames = await Promise.all(
      topCategories.map(async (c) => {
        if (!c.categoryId) return { name: 'Unknown', count: c._sum.orderCount ?? 0 };
        const cat = await prisma.category.findUnique({ where: { id: c.categoryId } });
        return { name: cat?.name ?? 'Unknown', count: c._sum.orderCount ?? 0 };
      }),
    );

    res.json({
      city,
      neighborhood: neighborhood ?? null,
      avgServicePrice: avgPrice ? Math.round(avgPrice * 100) / 100 : null,
      activeProviders: totalProviders,
      topCategories: topCategoryNames,
      serviceRateCount: safeRates.length,
      dataFreshness: safeRates.length > 0 ? safeRates[0].computedAt : null,
    });
  } catch (error) {
    console.error('Error fetching market data:', error);
    res.status(500).json({ error: 'Failed to fetch market data' });
  }
});

// GET /api/home-intelligence/service-rates — service rates by location
router.get('/service-rates', optionalAuth, async (req: Request, res: Response) => {
  try {
    const city = (req.query.city as string) || '';
    const neighborhood = req.query.neighborhood as string | undefined;
    const categoryId = req.query.categoryId as string | undefined;

    if (!city) {
      return res.status(400).json({ error: 'city query parameter is required' });
    }

    const where: Record<string, unknown> = { city };
    if (neighborhood) where.neighborhood = neighborhood;
    if (categoryId) where.categoryId = categoryId;

    const rates = await prisma.serviceRateByLocation.findMany({
      where,
      orderBy: { serviceName: 'asc' },
    });

    // Apply privacy threshold — only return rates with enough data points
    const safeRates = rates
      .filter((r) => isDataSafe(r.sampleSize))
      .map((r) => ({
        serviceName: r.serviceName,
        avgPrice: Number(r.avgPrice),
        minPrice: Number(r.minPrice),
        maxPrice: Number(r.maxPrice),
        sampleSize: r.sampleSize,
        categoryId: r.categoryId,
        computedAt: r.computedAt,
      }));

    res.json({
      city,
      neighborhood: neighborhood ?? null,
      rates: safeRates,
      total: safeRates.length,
    });
  } catch (error) {
    console.error('Error fetching service rates:', error);
    res.status(500).json({ error: 'Failed to fetch service rates' });
  }
});

// GET /api/home-intelligence/demand-analytics — demand analytics with privacy thresholds
router.get('/demand-analytics', optionalAuth, async (req: Request, res: Response) => {
  try {
    const city = (req.query.city as string) || '';
    const neighborhood = req.query.neighborhood as string | undefined;
    const period = (req.query.period as string) || '30d'; // 7d, 30d, 90d

    if (!city) {
      return res.status(400).json({ error: 'city query parameter is required' });
    }

    // Calculate period start
    const periodDays = period === '7d' ? 7 : period === '90d' ? 90 : 30;
    const periodStart = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

    const where: Record<string, unknown> = {
      city,
      periodStart: { gte: periodStart },
    };
    if (neighborhood) where.neighborhood = neighborhood;

    const analytics = await prisma.demandAnalytics.findMany({
      where,
      orderBy: { periodStart: 'desc' },
    });

    // Aggregate by category
    const byCategory = new Map<string, { searchCount: number; orderCount: number; uniqueClients: number }>();
    for (const a of analytics) {
      const key = a.categoryId || 'uncategorized';
      const existing = byCategory.get(key) || { searchCount: 0, orderCount: 0, uniqueClients: 0 };
      existing.searchCount += a.searchCount;
      existing.orderCount += a.orderCount;
      existing.uniqueClients = Math.max(existing.uniqueClients, a.uniqueClients);
      byCategory.set(key, existing);
    }

    const categoryBreakdown = await Promise.all(
      Array.from(byCategory.entries()).map(async ([catId, stats]) => {
        let name = 'Uncategorized';
        if (catId !== 'uncategorized') {
          const cat = await prisma.category.findUnique({ where: { id: catId } });
          name = cat?.name ?? 'Unknown';
        }
        return { categoryId: catId === 'uncategorized' ? null : catId, categoryName: name, ...stats };
      }),
    );

    // Total aggregates with privacy check
    const totalSearchCount = analytics.reduce((s, a) => s + a.searchCount, 0);
    const totalOrderCount = analytics.reduce((s, a) => s + a.orderCount, 0);
    const totalUniqueClients = analytics.length > 0
      ? Math.max(...analytics.map((a) => a.uniqueClients))
      : 0;

    const safeTotalSearch = anonymizeData(totalSearchCount, totalSearchCount);
    const safeTotalOrders = anonymizeData(totalOrderCount, totalOrderCount);

    res.json({
      city,
      neighborhood: neighborhood ?? null,
      period,
      totalSearches: safeTotalSearch,
      totalOrders: safeTotalOrders,
      uniqueClients: totalUniqueClients,
      categoryBreakdown,
      dataPoints: analytics.length,
    });
  } catch (error) {
    console.error('Error fetching demand analytics:', error);
    res.status(500).json({ error: 'Failed to fetch demand analytics' });
  }
});

// GET /api/home-intelligence/neighborhood-comparison — compare neighborhoods on key metrics
router.get('/neighborhood-comparison', optionalAuth, async (req: Request, res: Response) => {
  try {
    const city = (req.query.city as string) || '';

    if (!city) {
      return res.status(400).json({ error: 'city query parameter is required' });
    }

    // Get all neighborhoods in this city with service rates
    const neighborhoods = await prisma.serviceRateByLocation.findMany({
      where: {
        city,
        neighborhood: { not: null },
      },
      select: { neighborhood: true },
      distinct: ['neighborhood'],
    });

    const comparison = await Promise.all(
      neighborhoods.map(async (n) => {
        const hood = n.neighborhood!;
        const rates = await prisma.serviceRateByLocation.findMany({
          where: { city, neighborhood: hood },
        });

        const safeRates = rates.filter((r) => isDataSafe(r.sampleSize));
        const avgPrice = safeRates.length > 0
          ? safeRates.reduce((sum, r) => sum + Number(r.avgPrice), 0) / safeRates.length
          : null;

        const demand = await prisma.demandAnalytics.findMany({
          where: { city, neighborhood: hood },
          orderBy: { periodStart: 'desc' },
          take: 1,
        });

        return {
          neighborhood: hood,
          avgServicePrice: avgPrice ? Math.round(avgPrice * 100) / 100 : null,
          serviceCount: safeRates.length,
          activeClients: demand.length > 0 ? demand[0].uniqueClients : 0,
          orderCount: demand.length > 0 ? demand[0].orderCount : 0,
        };
      }),
    );

    // Sort by avg price descending
    comparison.sort((a, b) => (b.avgServicePrice ?? 0) - (a.avgServicePrice ?? 0));

    // Add rank
    const withRank = comparison.map((item, index) => ({
      ...item,
      rank: index + 1,
      totalNeighborhoods: comparison.length,
    }));

    res.json({
      city,
      neighborhoods: withRank,
      total: withRank.length,
    });
  } catch (error) {
    console.error('Error fetching neighborhood comparison:', error);
    res.status(500).json({ error: 'Failed to fetch neighborhood comparison' });
  }
});

export default router;
