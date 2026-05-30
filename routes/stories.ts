import { Router, Response } from 'express';
import prisma from '../lib/db.js';
import { authenticate, AuthRequest } from '../lib/auth.middleware.js';

const router = Router();

// POST /api/stories — create a story (24h expiry auto-set)
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { mediaUrl, thumbnailUrl, caption, linkUrl, linkLabel, visibility } = req.body as Record<string, unknown>;

    if (!mediaUrl || typeof mediaUrl !== 'string') {
      return res.status(400).json({ error: 'mediaUrl is required' });
    }

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const story = await prisma.story.create({
      data: {
        authorId: req.user!.userId,
        mediaUrl,
        thumbnailUrl: typeof thumbnailUrl === 'string' ? thumbnailUrl : undefined,
        caption: typeof caption === 'string' ? caption : undefined,
        linkUrl: typeof linkUrl === 'string' ? linkUrl : undefined,
        linkLabel: typeof linkLabel === 'string' ? linkLabel : undefined,
        visibility: visibility === 'FOLLOWERS_ONLY' ? 'FOLLOWERS_ONLY' : 'PUBLIC',
        expiresAt,
      },
      include: {
        author: { select: { id: true, displayName: true, avatarUrl: true } },
      },
    });

    res.status(201).json(story);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// GET /api/stories/active — get active (non-expired) stories
router.get('/active', async (req, res: Response) => {
  try {
    const userId = (req as any).user?.userId;

    const where: Record<string, unknown> = {
      expiresAt: { gt: new Date() },
      archivedAt: null,
    };

    const stories = await prisma.story.findMany({
      where,
      include: {
        author: { select: { id: true, displayName: true, avatarUrl: true } },
        _count: { select: { viewers: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // If authenticated, mark which stories the user has viewed
    let viewedStoryIds = new Set<string>();
    if (userId) {
      const viewerRecords = await prisma.storyViewer.findMany({
        where: { userId, storyId: { in: stories.map((s) => s.id) } },
        select: { storyId: true },
      });
      viewedStoryIds = new Set(viewerRecords.map((v) => v.storyId));
    }

    const result = stories.map((story) => ({
      ...story,
      viewed: viewedStoryIds.has(story.id),
    }));

    res.json({ data: result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// GET /api/stories/user/:userId — get active stories for a specific user
router.get('/user/:userId', async (req, res: Response) => {
  try {
    const stories = await prisma.story.findMany({
      where: {
        authorId: req.params.userId,
        expiresAt: { gt: new Date() },
        archivedAt: null,
      },
      include: {
        author: { select: { id: true, displayName: true, avatarUrl: true } },
        _count: { select: { viewers: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ data: stories });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// GET /api/stories/:id — get single story with viewer count
router.get('/:id', async (req, res: Response) => {
  try {
    const story = await prisma.story.findUnique({
      where: { id: req.params.id },
      include: {
        author: { select: { id: true, displayName: true, avatarUrl: true } },
        _count: { select: { viewers: true } },
      },
    });

    if (!story || story.archivedAt) {
      return res.status(404).json({ error: 'Story not found' });
    }

    // Increment view count
    await prisma.story.update({
      where: { id: story.id },
      data: { views: { increment: 1 } },
    });

    res.json({ ...story, views: story.views + 1 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// DELETE /api/stories/:id — delete a story (owner only)
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const story = await prisma.story.findUnique({ where: { id: req.params.id } });
    if (!story) {
      return res.status(404).json({ error: 'Story not found' });
    }
    if (story.authorId !== req.user!.userId) {
      return res.status(403).json({ error: 'Not authorized to delete this story' });
    }

    await prisma.story.update({
      where: { id: req.params.id },
      data: { archivedAt: new Date() },
    });

    res.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// POST /api/stories/:id/view — mark story as viewed
router.post('/:id/view', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const story = await prisma.story.findUnique({ where: { id: req.params.id } });
    if (!story || story.archivedAt) {
      return res.status(404).json({ error: 'Story not found' });
    }

    const userId = req.user!.userId;

    // Check if already viewed
    const existing = await prisma.storyViewer.findUnique({
      where: { storyId_userId: { storyId: req.params.id, userId } },
    });

    if (!existing) {
      await prisma.storyViewer.create({
        data: { storyId: req.params.id, userId },
      });
    }

    res.json({ viewed: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

export default router;
