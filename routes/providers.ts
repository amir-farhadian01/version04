import { Router, Response } from 'express';
import prisma from '../lib/db.js';
import { authenticate, AuthRequest } from '../lib/auth.middleware.js';
import { getNearbyProviders } from '../lib/locationCache.js';

const router = Router();

/**
 * GET /api/providers/nearby
 *
 * Query params:
 *   lat    (number, required for geo-filtering) — user's latitude
 *   lng    (number, required for geo-filtering) — user's longitude
 *   radius (number, optional, default 10) — search radius in km
 *   limit  (number, optional, default 20, max 50)
 *
 * When lat/lng are provided, uses Redis GEO to find nearby providers
 * and returns real distance values. Results are cached for 60 seconds.
 *
 * When lat/lng are NOT provided, falls back to returning all active
 * providers sorted by rating (legacy behavior).
 */
router.get('/nearby', async (req: AuthRequest, res: Response) => {
  try {
    const lat = parseFloat(String(req.query.lat ?? ''));
    const lng = parseFloat(String(req.query.lng ?? ''));
    const radius = parseFloat(String(req.query.radius ?? '10'));
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10)));

    const hasCoords = !isNaN(lat) && !isNaN(lng);

    if (hasCoords) {
      // Use Redis GEO for real geo-filtering
      const providers = await getNearbyProviders(lat, lng, radius, limit);
      return res.json(providers);
    }

    // Fallback: no lat/lng provided — return all active providers sorted by rating
    const providers = await prisma.user.findMany({
      where: {
        role: 'provider',
        status: 'active',
        services: { some: {} }, // must have at least one service
      },
      select: {
        id: true,
        displayName: true,
        avatarUrl: true,
        role: true,
        locationLat: true,
        locationLng: true,
        services: {
          select: {
            id: true,
            title: true,
            category: true,
            price: true,
            rating: true,
            reviewsCount: true,
          },
          orderBy: { rating: 'desc' },
          take: 3,
        },
      },
      take: limit,
    });

    const result = providers.map((p) => {
      const topService = p.services[0] ?? null;
      return {
        id: p.id,
        displayName: p.displayName,
        avatarUrl: p.avatarUrl,
        category: topService?.category ?? 'General',
        rating: topService?.rating ?? 0,
        reviewsCount: topService?.reviewsCount ?? 0,
        distance: null, // unknown without lat/lng
        services: p.services,
      };
    });

    res.json(result);
  } catch (error) {
    console.error('[providers/nearby]', error);
    res.status(500).json({ error: 'Failed to fetch nearby providers' });
  }
});

/** GET /api/providers/:id/reviews — Public provider reviews (customer → provider) */
router.get('/:id/reviews', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const provider = await prisma.user.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!provider || provider.status !== 'active') {
      return res.status(404).json({ error: 'Provider not found' });
    }
    const reviews = await prisma.orderReview.findMany({
      where: {
        customerId: id,
        reviewType: 'customer',
      },
      include: {
        order: {
          select: {
            serviceCatalog: {
              select: { id: true, name: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const result = reviews.map((r) => ({
      id: r.id,
      orderId: r.orderId,
      rating: r.rating,
      reviewText: r.reviewText,
      serviceName: r.order?.serviceCatalog?.name ?? null,
      createdAt: r.createdAt.toISOString(),
    }));

    const avgRating = reviews.length > 0
      ? Math.round((reviews.reduce((sum: number, r: { rating: number }) => sum + r.rating, 0) / reviews.length) * 10) / 10
      : 0;

    res.json({
      data: {
        providerId: id,
        averageRating: avgRating,
        reviewCount: reviews.length,
        reviews: result,
      },
    });
  } catch (err: unknown) {
    console.error('[providers/reviews]', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
  }
});

/** GET /api/customers/:id/reviews — Customer reviews (provider → customer) */
router.get('/customer/:id/reviews', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const customer = await prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    const reviews = await prisma.orderReview.findMany({
      where: {
        customerId: id,
        reviewType: 'provider',
      },
      include: {
        reviewer: {
          select: { id: true, displayName: true, firstName: true, lastName: true, avatarUrl: true },
        },
        order: {
          select: {
            serviceCatalog: {
              select: { id: true, name: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const result = reviews.map((r) => ({
      id: r.id,
      orderId: r.orderId,
      rating: r.rating,
      reviewText: r.reviewText,
      reviewer: r.reviewer
        ? {
            id: r.reviewer.id,
            displayName: r.reviewer.displayName,
            firstName: r.reviewer.firstName,
            lastName: r.reviewer.lastName,
            avatarUrl: r.reviewer.avatarUrl,
          }
        : null,
      serviceName: r.order?.serviceCatalog?.name ?? null,
      createdAt: r.createdAt.toISOString(),
    }));

    const avgRating = reviews.length > 0
      ? Math.round((reviews.reduce((sum: number, r: { rating: number }) => sum + r.rating, 0) / reviews.length) * 10) / 10
      : 0;

    res.json({
      data: {
        customerId: id,
        averageRating: avgRating,
        reviewCount: reviews.length,
        reviews: result,
      },
    });
  } catch (err: unknown) {
    console.error('[customers/reviews]', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
  }
});

export default router;
