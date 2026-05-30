import { Router, Response } from 'express';
import prisma from '../lib/db.js';
import { authenticate, AuthRequest } from '../lib/auth.middleware.js';

const router = Router();

// POST /api/follow/:userId — follow a user
router.post('/:userId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const followerId = req.user!.userId;
    const followeeId = req.params.userId;

    if (followerId === followeeId) {
      return res.status(400).json({ error: 'Cannot follow yourself' });
    }

    // Check if target user exists
    const targetUser = await prisma.user.findUnique({ where: { id: followeeId } });
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if already following
    const existing = await prisma.follow.findUnique({
      where: { followerId_followeeId: { followerId, followeeId } },
    });

    if (existing) {
      return res.json({ following: true, message: 'Already following this user' });
    }

    await prisma.follow.create({
      data: { followerId, followeeId },
    });

    // Create notification for the followed user
    await prisma.notification.create({
      data: {
        userId: followeeId,
        title: 'New Follower',
        message: 'Someone started following you',
        type: 'follow',
        link: `/profile/${followerId}`,
      },
    });

    res.status(201).json({ following: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// DELETE /api/follow/:userId — unfollow a user
router.delete('/:userId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const followerId = req.user!.userId;
    const followeeId = req.params.userId;

    const existing = await prisma.follow.findUnique({
      where: { followerId_followeeId: { followerId, followeeId } },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Not following this user' });
    }

    await prisma.follow.delete({
      where: { id: existing.id },
    });

    res.json({ following: false });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// GET /api/follow/:userId/followers — get followers of a user
router.get('/:userId/followers', async (req, res: Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(String(req.query.pageSize ?? '20'), 10) || 20));

    const [follows, total] = await Promise.all([
      prisma.follow.findMany({
        where: { followeeId: req.params.userId },
        include: {
          follower: { select: { id: true, displayName: true, avatarUrl: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.follow.count({ where: { followeeId: req.params.userId } }),
    ]);

    const followers = follows.map((f) => f.follower);

    res.json({ data: followers, total, page, pageSize });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// GET /api/follow/:userId/following — get who a user is following
router.get('/:userId/following', async (req, res: Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(String(req.query.pageSize ?? '20'), 10) || 20));

    const [follows, total] = await Promise.all([
      prisma.follow.findMany({
        where: { followerId: req.params.userId },
        include: {
          followee: { select: { id: true, displayName: true, avatarUrl: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.follow.count({ where: { followerId: req.params.userId } }),
    ]);

    const following = follows.map((f) => f.followee);

    res.json({ data: following, total, page, pageSize });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// GET /api/follow/me/following — get current user's following list
router.get('/me/following', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const follows = await prisma.follow.findMany({
      where: { followerId: req.user!.userId },
      include: {
        followee: { select: { id: true, displayName: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const following = follows.map((f) => f.followee);
    res.json({ data: following });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// GET /api/follow/me/followers — get current user's followers
router.get('/me/followers', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const follows = await prisma.follow.findMany({
      where: { followeeId: req.user!.userId },
      include: {
        follower: { select: { id: true, displayName: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const followers = follows.map((f) => f.follower);
    res.json({ data: followers });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// GET /api/follow/status/:userId — check if current user follows target user
router.get('/status/:userId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const followerId = req.user!.userId;
    const followeeId = req.params.userId;

    const existing = await prisma.follow.findUnique({
      where: { followerId_followeeId: { followerId, followeeId } },
    });

    res.json({ following: !!existing });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

export default router;
