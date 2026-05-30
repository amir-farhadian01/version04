import { Router, Response } from 'express';
import prisma from '../lib/db.js';
import { authenticate, AuthRequest } from '../lib/auth.middleware.js';

const router = Router();

/**
 * Checks if a post has an active linked service that can be ordered from.
 */
async function checkOrderable(post: { serviceCatalogId: string | null; authorId: string }): Promise<boolean> {
  if (!post.serviceCatalogId) return false;
  try {
    const svc = await prisma.serviceCatalog.findFirst({
      where: {
        id: post.serviceCatalogId,
        isActive: true,
        archivedAt: null,
      },
      select: { id: true },
    });
    return svc !== null;
  } catch {
    return false;
  }
}

// GET /api/posts — public list (Explorer / Services without login)
router.get('/', async (req, res: Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(String(req.query.pageSize ?? '20'), 10) || 20));

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where: { archivedAt: null, moderationStatus: { in: ['approved', 'pending'] } },
        include: {
          author: { select: { id: true, displayName: true, avatarUrl: true } },
          media: { orderBy: { sortOrder: 'asc' }, take: 4 },
          _count: { select: { likes: true, comments: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.post.count({ where: { archivedAt: null } }),
    ]);

    // Enrich posts with orderable flag
    const enriched = await Promise.all(
      posts.map(async (post) => ({
        ...post,
        orderable: await checkOrderable(post),
      })),
    );

    res.json({ data: enriched, total, page, pageSize });
  } catch (error) {
    res.status(500).json({ code: 'POSTS_ERROR', message: 'Failed to load posts' });
  }
});

// GET /api/posts/:id — single post view
router.get('/:id', async (req, res: Response) => {
  try {
    const post = await prisma.post.findUnique({
      where: { id: req.params.id },
      include: {
        author: { select: { id: true, displayName: true, avatarUrl: true } },
        category: { select: { id: true, name: true } },
        location: true,
        media: { orderBy: { sortOrder: 'asc' } },
        _count: { select: { likes: true, comments: true } },
      },
    });

    if (!post || post.archivedAt) {
      return res.status(404).json({ code: 'POST_NOT_FOUND', message: 'Post not found' });
    }

    const orderable = await checkOrderable(post);

    res.json({ data: { ...post, orderable } });
  } catch (error) {
    res.status(500).json({ code: 'POST_ERROR', message: 'Failed to load post' });
  }
});

// POST /api/posts — create post
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { caption, categoryId, mediaAssetId } = req.body as Record<string, unknown>;

    if (!categoryId || typeof categoryId !== 'string') {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'categoryId is required' });
    }

    const category = await prisma.category.findUnique({
      where: { id: categoryId },
      select: { id: true, archivedAt: true },
    });
    if (!category || category.archivedAt) {
      return res.status(400).json({ code: 'INVALID_CATEGORY', message: 'Category not found' });
    }

    const post = await prisma.post.create({
      data: {
        authorId: req.user!.userId,
        categoryId,
        caption: typeof caption === 'string' ? caption : undefined,
        mediaAssetId: typeof mediaAssetId === 'string' ? mediaAssetId : undefined,
        moderationStatus: 'pending',
        publishedAt: new Date(),
        updatedAt: new Date(),
      },
      include: {
        author: { select: { id: true, displayName: true, avatarUrl: true } },
        category: { select: { id: true, name: true } },
        media: { orderBy: { sortOrder: 'asc' } },
        _count: { select: { likes: true, comments: true } },
      },
    });

    res.status(201).json({ data: post });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ code: 'CREATE_ERROR', message });
  }
});

// DELETE /api/posts/:id — soft-delete post
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const post = await prisma.post.findUnique({ where: { id: req.params.id } });
    if (!post) {
      return res.status(404).json({ code: 'POST_NOT_FOUND', message: 'Post not found' });
    }
    if (post.authorId !== req.user!.userId) {
      return res.status(403).json({ code: 'FORBIDDEN', message: 'Not authorized to delete this post' });
    }

    await prisma.post.update({
      where: { id: req.params.id },
      data: { archivedAt: new Date() },
    });

    res.json({ data: { id: req.params.id, archived: true } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ code: 'DELETE_ERROR', message });
  }
});

// POST /api/posts/:id/like — toggle like
router.post('/:id/like', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const postId = req.params.id;
    const userId = req.user!.userId;

    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, archivedAt: true },
    });
    if (!post || post.archivedAt) {
      return res.status(404).json({ code: 'POST_NOT_FOUND', message: 'Post not found' });
    }

    const existing = await prisma.postLike.findUnique({
      where: { postId_userId: { postId, userId } },
    });

    if (existing) {
      await prisma.postLike.delete({ where: { id: existing.id } });
      await prisma.post.update({
        where: { id: postId },
        data: { likeCount: { decrement: 1 } },
      });
      return res.json({ data: { liked: false } });
    }

    await prisma.postLike.create({ data: { postId, userId } });
    await prisma.post.update({
      where: { id: postId },
      data: { likeCount: { increment: 1 } },
    });

    res.status(201).json({ data: { liked: true } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ code: 'LIKE_ERROR', message });
  }
});

// POST /api/posts/:id/comments — add comment
router.post('/:id/comments', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const postId = req.params.id;
    const userId = req.user!.userId;
    const { text } = req.body as { text?: string };

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'text is required' });
    }

    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, archivedAt: true },
    });
    if (!post || post.archivedAt) {
      return res.status(404).json({ code: 'POST_NOT_FOUND', message: 'Post not found' });
    }

    const comment = await prisma.postComment.create({
      data: { postId, authorId: userId, text: text.trim(), moderationStatus: 'pending' },
      include: {
        author: { select: { id: true, displayName: true, avatarUrl: true } },
      },
    });

    await prisma.post.update({
      where: { id: postId },
      data: { commentCount: { increment: 1 } },
    });

    res.status(201).json({ data: comment });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ code: 'COMMENT_ERROR', message });
  }
});

// GET /api/posts/:id/comments — list comments
router.get('/:id/comments', async (req, res: Response) => {
  try {
    const postId = req.params.id;
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(String(req.query.pageSize ?? '20'), 10) || 20));

    const [comments, total] = await Promise.all([
      prisma.postComment.findMany({
        where: { postId, archivedAt: null },
        include: {
          author: { select: { id: true, displayName: true, avatarUrl: true } },
        },
        orderBy: { createdAt: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.postComment.count({ where: { postId, archivedAt: null } }),
    ]);

    res.json({ data: comments, total, page, pageSize });
  } catch (error) {
    res.status(500).json({ code: 'COMMENTS_ERROR', message: 'Failed to load comments' });
  }
});

// GET /api/posts/my — user's own posts
router.get('/my/list', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(String(req.query.pageSize ?? '20'), 10) || 20));

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where: { authorId: userId, archivedAt: null },
        include: {
          category: { select: { id: true, name: true } },
          media: { orderBy: { sortOrder: 'asc' }, take: 4 },
          _count: { select: { likes: true, comments: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.post.count({ where: { authorId: userId, archivedAt: null } }),
    ]);

    res.json({ data: posts, total, page, pageSize });
  } catch (error) {
    res.status(500).json({ code: 'POSTS_ERROR', message: 'Failed to load posts' });
  }
});

// PUT /api/posts/:id — edit post
router.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const postId = req.params.id;
    const userId = req.user!.userId;
    const { caption, categoryId } = req.body as Record<string, unknown>;

    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post || post.archivedAt) {
      return res.status(404).json({ code: 'POST_NOT_FOUND', message: 'Post not found' });
    }
    if (post.authorId !== userId) {
      return res.status(403).json({ code: 'FORBIDDEN', message: 'Not your post' });
    }

    const updateData: Record<string, unknown> = {};
    if (caption !== undefined) updateData.caption = caption;
    if (categoryId !== undefined) updateData.categoryId = categoryId;

    const updated = await prisma.post.update({
      where: { id: postId },
      data: updateData,
      include: {
        author: { select: { id: true, displayName: true, avatarUrl: true } },
        category: { select: { id: true, name: true } },
        media: { orderBy: { sortOrder: 'asc' } },
        _count: { select: { likes: true, comments: true } },
      },
    });

    res.json({ data: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ code: 'UPDATE_ERROR', message });
  }
});

export default router;