import { Router, Response } from 'express';
import { authenticate, requireRole, AuthRequest } from '../lib/auth.middleware.js';
import prisma from '../lib/db.js';

const router = Router();

router.use(authenticate);
router.use(requireRole('platform_admin'));

// GET /api/admin/media — all uploaded media with audit status
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize ?? '20'), 10) || 20));
    const status = req.query.status as string | undefined;
    const uploaderType = req.query.uploaderType as string | undefined;

    const where: Record<string, unknown> = { archivedAt: null };
    if (status) where.moderationStatus = status;

    const [media, total] = await Promise.all([
      prisma.mediaAsset.findMany({
        where,
        include: {
          uploader: { select: { id: true, displayName: true, email: true } },
          post: { select: { id: true, caption: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.mediaAsset.count({ where }),
    ]);

    res.json({ data: media, total, page, pageSize });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch media' });
  }
});

// GET /api/admin/media/stats — engagement metrics
router.get('/stats', async (_req: AuthRequest, res: Response) => {
  try {
    const [totalMedia, pendingReview, flaggedContent, totalViews] = await Promise.all([
      prisma.mediaAsset.count({ where: { archivedAt: null } }),
      prisma.mediaAsset.count({ where: { moderationStatus: 'PENDING', archivedAt: null } }),
      prisma.mediaAsset.count({ where: { flagCount: { gt: 0 }, archivedAt: null } }),
      prisma.mediaAsset.aggregate({ _sum: { views: true } }),
    ]);

    res.json({
      totalMedia,
      pendingReview,
      flaggedContent,
      totalViews: totalViews._sum.views ?? 0,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch media stats' });
  }
});

// POST /api/admin/media/:id/moderate — approve/remove/warn
router.post('/:id/moderate', async (req: AuthRequest, res: Response) => {
  try {
    const { action, note } = req.body as { action?: string; note?: string };
    if (!action || !['APPROVED', 'REMOVED', 'WARNED'].includes(action)) {
      return res.status(400).json({ error: 'action must be APPROVED, REMOVED, or WARNED' });
    }

    const media = await prisma.mediaAsset.update({
      where: { id: req.params.id },
      data: {
        moderationStatus: action as 'APPROVED' | 'REMOVED' | 'WARNED',
        moderationNote: note ?? null,
        moderatedById: req.user!.userId,
        moderatedAt: new Date(),
      },
    });

    res.json(media);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to moderate media' });
  }
});

export default router;
