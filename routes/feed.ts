import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../lib/db.js';
import { verifyAccessToken, JwtPayload } from '../lib/jwt.js';

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

// GET /api/feed — personalized feed with filtering (auth optional)
router.get('/', optionalAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JwtPayload | undefined;
    const userId = user?.userId;
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(String(req.query.pageSize ?? '20'), 10) || 20));

    const { city, neighborhood, interest, categoryId, following } = req.query as Record<string, string | undefined>;

    const where: Record<string, unknown> = { archivedAt: null };

    // Filter by following — only show posts from users the current user follows
    if (following === 'true' && userId) {
      const followedUserIds = await prisma.follow.findMany({
        where: { followerId: userId },
        select: { followeeId: true },
      });
      const ids = followedUserIds.map((f) => f.followeeId);
      // Include the user's own posts
      ids.push(userId);
      where.authorId = { in: ids };
    }

    // Filter by category
    if (categoryId) {
      where.categoryId = categoryId;
    }

    // Filter by interest tag via PostLocation or category name
    if (interest) {
      // Search by category name containing the interest
      const matchingCategories = await prisma.category.findMany({
        where: { name: { contains: interest, mode: 'insensitive' } },
        select: { id: true },
      });
      if (matchingCategories.length > 0) {
        where.categoryId = { in: matchingCategories.map(c => c.id) };
      }
    }

    // Filter by location (city)
    if (city) {
      const cityLocations = await prisma.postLocation.findMany({
        where: { city: { equals: city, mode: 'insensitive' } },
        select: { id: true },
      });
      if (cityLocations.length > 0) {
        where.locationId = { in: cityLocations.map(l => l.id) };
      }
    }

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        include: {
          author: { select: { id: true, displayName: true, avatarUrl: true } },
          category: { select: { id: true, name: true } },
          location: true,
          media: { orderBy: { sortOrder: 'asc' }, take: 4 },
          _count: { select: { likes: true, comments: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.post.count({ where }),
    ]);

    res.json({ data: posts, total, page, pageSize });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch feed' });
  }
});

// GET /api/feed/public — public feed (no auth)
router.get('/public', async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(String(req.query.pageSize ?? '20'), 10) || 20));

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where: { archivedAt: null, moderationStatus: { in: ['approved', 'pending'] } },
        include: {
          author: { select: { id: true, displayName: true, avatarUrl: true } },
          category: { select: { id: true, name: true } },
          media: { orderBy: { sortOrder: 'asc' }, take: 4 },
          _count: { select: { likes: true, comments: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.post.count({ where: { archivedAt: null } }),
    ]);

    res.json({ data: posts, total, page, pageSize });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch public feed' });
  }
});

export default router;