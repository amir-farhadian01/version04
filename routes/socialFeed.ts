import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../lib/db.js';
import { authenticate, AuthRequest } from '../lib/auth.middleware.js';
import { moderateMessage } from '../lib/chatModeration.js';
import { publish } from '../lib/bus.js';
import { verifyAccessToken, JwtPayload } from '../lib/jwt.js';

const router = Router();

// ─── Zod Schemas ───────────────────────────────────────────────────────────

const createPostSchema = z.object({
  caption: z.string().max(2000).optional(),
  categoryId: z.string().min(1, 'Category is required'),
  locationId: z.string().optional(),
  mediaUrls: z.array(z.string().url()).min(0).max(10),
  mediaTypes: z.array(z.enum(['image', 'video'])).min(0).max(10).optional(),
  serviceCatalogId: z.string().optional(),
  isBusinessPost: z.boolean().default(false),
});

const updatePostSchema = z.object({
  caption: z.string().max(2000).optional(),
  categoryId: z.string().min(1).optional(),
  locationId: z.string().nullable().optional(),
  serviceCatalogId: z.string().nullable().optional(),
  isBusinessPost: z.boolean().optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
});

const createCommentSchema = z.object({
  text: z.string().min(1).max(1000),
});

const createStorySchema = z.object({
  mediaUrl: z.string().url(),
  mediaType: z.enum(['image', 'video']),
  duration: z.number().int().positive().max(60).optional(),
});

const feedQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  categoryId: z.string().optional(),
  city: z.string().optional(),
  lat: z.coerce.number().optional(),
  lng: z.coerce.number().optional(),
  radiusKm: z.coerce.number().positive().max(500).default(50),
  sort: z.enum(['recent', 'popular', 'relevance']).default('recent'),
  businessOnly: z.coerce.boolean().optional(),
  followingOnly: z.coerce.boolean().optional(),
});

// ─── PII Moderation Helper ──────────────────────────────────────────────────

function moderatePostCaption(caption: string | null | undefined): {
  moderatedCaption: string | null;
  moderationStatus: 'pending' | 'approved' | 'flagged';
  moderationReasons: string[];
} {
  if (!caption) {
    return { moderatedCaption: null, moderationStatus: 'approved', moderationReasons: [] };
  }
  const result = moderateMessage(caption);

  if (result.action === 'block') {
    // Blocked messages get flagged for admin review
    return {
      moderatedCaption: null,
      moderationStatus: 'flagged',
      moderationReasons: result.reasons,
    };
  }

  if (result.action === 'flag') {
    return {
      moderatedCaption: result.displayText,
      moderationStatus: 'flagged',
      moderationReasons: result.reasons,
    };
  }

  if (result.action === 'mask') {
    return {
      moderatedCaption: result.displayText,
      moderationStatus: 'pending',
      moderationReasons: result.reasons,
    };
  }

  return {
    moderatedCaption: caption,
    moderationStatus: 'approved',
    moderationReasons: [],
  };
}

// ─── Optional Auth Middleware ──────────────────────────────────────────────

function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    try {
      req.user = verifyAccessToken(authHeader.slice(7));
    } catch {
      // token invalid — continue as unauthenticated
    }
  }
  next();
}

// ─── POSTS ─────────────────────────────────────────────────────────────────

// GET /api/social/posts/feed — Public/authenticated feed
router.get('/posts/feed', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const query = feedQuerySchema.parse(req.query);
    const userId = req.user?.userId;
    const now = new Date();

    const where: Record<string, unknown> = {
      archivedAt: null,
      moderationStatus: { in: ['approved', 'pending'] },
      publishedAt: { lte: now },
    };

    // Business-only filter
    if (query.businessOnly) {
      where.isBusinessPost = true;
    }

    // Following filter
    if (query.followingOnly && userId) {
      const followingIds = await prisma.follow.findMany({
        where: { followerId: userId },
        select: { followeeId: true },
      });
      where.authorId = { in: [userId, ...followingIds.map(f => f.followeeId)] };
    }

    // Category filter
    if (query.categoryId) {
      where.categoryId = query.categoryId;
    }

    // Location filter (radius-based)
    let locationFilter: Record<string, unknown> | undefined;
    if (query.lat !== undefined && query.lng !== undefined) {
      // Use raw SQL for geo distance or simpler city match
      const postLocations = await prisma.postLocation.findMany({
        where: {
          latitude: { gte: query.lat - 1, lte: query.lat + 1 },
          longitude: { gte: query.lng - 1, lte: query.lng + 1 },
        },
        select: { id: true },
      });
      where.locationId = { in: postLocations.map(l => l.id) };
    }

    // City filter
    if (query.city) {
      const cityLocations = await prisma.postLocation.findMany({
        where: { city: { equals: query.city, mode: 'insensitive' } },
        select: { id: true },
      });
      if (cityLocations.length > 0) {
        where.locationId = { in: cityLocations.map(l => l.id) };
      }
    }

    // Sort
    let orderBy: Record<string, string>;
    switch (query.sort) {
      case 'popular':
        orderBy = { likeCount: 'desc' };
        break;
      case 'relevance':
        orderBy = { publishedAt: 'desc' };
        break;
      default:
        orderBy = { publishedAt: 'desc' };
    }

    const page = query.page;
    const pageSize = query.pageSize;

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where: where as any,
        include: {
          author: { select: { id: true, displayName: true, avatarUrl: true } },
          category: { select: { id: true, name: true } },
          location: true,
          media: { orderBy: { sortOrder: 'asc' }, take: 4 },
          linkedService: { select: { id: true, name: true } },
          _count: { select: { likes: true, comments: true } },
        },
        orderBy: orderBy as any,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.post.count({ where: where as any }),
    ]);

    // Check if current user liked/saved each post
    let enrichedPosts;
    if (userId) {
      const postIds = posts.map(p => p.id);
      const [likes, saves] = await Promise.all([
        prisma.postLike.findMany({
          where: { postId: { in: postIds }, userId },
          select: { postId: true },
        }),
        prisma.postSave.findMany({
          where: { postId: { in: postIds }, userId },
          select: { postId: true },
        }),
      ]);
      const likedSet = new Set(likes.map(l => l.postId));
      const savedSet = new Set(saves.map(s => s.postId));
      enrichedPosts = posts.map(p => ({
        ...p,
        isLiked: likedSet.has(p.id),
        isSaved: savedSet.has(p.id),
      }));
    } else {
      enrichedPosts = posts.map(p => ({ ...p, isLiked: false, isSaved: false }));
    }

    res.json({
      data: enrichedPosts,
      total,
      page,
      pageSize,
    });
  } catch (error) {
    res.status(500).json({ code: 'FEED_ERROR', message: 'Failed to load feed' });
  }
});

// GET /api/social/posts/my — Current user's posts
router.get('/posts/my', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(String(req.query.pageSize ?? '20'), 10) || 20));

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where: { authorId: userId, archivedAt: null },
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
      prisma.post.count({ where: { authorId: userId, archivedAt: null } }),
    ]);

    res.json({ data: posts, total, page, pageSize });
  } catch (error) {
    res.status(500).json({ code: 'POSTS_ERROR', message: 'Failed to load posts' });
  }
});

// GET /api/social/posts/saved — Current user's saved posts
router.get('/posts/saved', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(String(req.query.pageSize ?? '20'), 10) || 20));

    const savedRecords = await prisma.postSave.findMany({
      where: { userId },
      include: {
        post: {
          include: {
            author: { select: { id: true, displayName: true, avatarUrl: true } },
            category: { select: { id: true, name: true } },
            location: true,
            media: { orderBy: { sortOrder: 'asc' }, take: 4 },
            _count: { select: { likes: true, comments: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    const total = await prisma.postSave.count({ where: { userId } });

    const posts = savedRecords
      .filter(s => s.post.archivedAt === null)
      .map(s => ({ ...s.post, isSaved: true, savedAt: s.createdAt }));

    res.json({ data: posts, total, page, pageSize });
  } catch (error) {
    res.status(500).json({ code: 'SAVED_ERROR', message: 'Failed to load saved posts' });
  }
});

// GET /api/social/posts/:id — Single post with comments
router.get('/posts/:id', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const postId = req.params.id;
    const userId = req.user?.userId;

    // Increment view count
    await prisma.post.update({
      where: { id: postId },
      data: { viewCount: { increment: 1 } },
    }).catch(() => {});

    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: {
        author: {
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
            bio: true,
          },
        },
        category: { select: { id: true, name: true } },
        location: true,
        media: { orderBy: { sortOrder: 'asc' } },
        linkedService: { select: { id: true, name: true, slug: true } },
        comments: {
          where: { archivedAt: null },
          include: {
            author: { select: { id: true, displayName: true, avatarUrl: true } },
          },
          orderBy: { createdAt: 'asc' },
          take: 50,
        },
        _count: { select: { likes: true, comments: true, saves: true } },
      },
    });

    if (!post || post.archivedAt) {
      return res.status(404).json({ code: 'POST_NOT_FOUND', message: 'Post not found' });
    }

    let isLiked = false;
    let isSaved = false;
    if (userId) {
      const [like, save] = await Promise.all([
        prisma.postLike.findUnique({ where: { postId_userId: { postId, userId } } }),
        prisma.postSave.findUnique({ where: { postId_userId: { postId, userId } } }),
      ]);
      isLiked = !!like;
      isSaved = !!save;
    }

    res.json({ data: { ...post, isLiked, isSaved } });
  } catch (error) {
    res.status(500).json({ code: 'POST_ERROR', message: 'Failed to load post' });
  }
});

// POST /api/social/posts — Create post
router.post('/posts', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const input = createPostSchema.parse(req.body);

    // Validate category exists
    const category = await prisma.category.findUnique({
      where: { id: input.categoryId },
      select: { id: true, archivedAt: true },
    });
    if (!category || category.archivedAt) {
      return res.status(400).json({ code: 'INVALID_CATEGORY', message: 'Category not found or archived' });
    }

    // Validate location if provided
    if (input.locationId) {
      const loc = await prisma.postLocation.findUnique({ where: { id: input.locationId } });
      if (!loc) {
        return res.status(400).json({ code: 'INVALID_LOCATION', message: 'Location not found' });
      }
    }

    // Validate serviceCatalogId if provided
    if (input.serviceCatalogId) {
      const svc = await prisma.serviceCatalog.findUnique({
        where: { id: input.serviceCatalogId },
        select: { id: true, isActive: true },
      });
      if (!svc || !svc.isActive) {
        return res.status(400).json({ code: 'INVALID_SERVICE', message: 'Service not found or inactive' });
      }
    }

    // PII moderation on caption
    const { moderatedCaption, moderationStatus, moderationReasons } = moderatePostCaption(input.caption);

    const post = await prisma.post.create({
      data: {
        authorId: userId,
        categoryId: input.categoryId,
        caption: moderationStatus === 'flagged' ? null : moderatedCaption,
        locationId: input.locationId ?? null,
        serviceCatalogId: input.serviceCatalogId ?? null,
        isBusinessPost: input.isBusinessPost,
        moderationStatus,
        publishedAt: new Date(),
        updatedAt: new Date(),
        media: {
          create: input.mediaUrls.map((url, i) => ({
            type: input.mediaTypes?.[i] ?? 'image',
            url,
            sortOrder: i,
          })),
        },
      },
      include: {
        author: { select: { id: true, displayName: true, avatarUrl: true } },
        category: { select: { id: true, name: true } },
        location: true,
        media: { orderBy: { sortOrder: 'asc' } },
        _count: { select: { likes: true, comments: true } },
      },
    });

    // Publish NATS event
    publish('social.post.created', {
      postId: post.id,
      authorId: userId,
      categoryId: input.categoryId,
      isBusinessPost: input.isBusinessPost,
      moderationStatus,
    }).catch(() => {});

    res.status(201).json({
      data: post,
      moderationWarnings: moderationReasons.length > 0 ? moderationReasons : undefined,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: error.issues[0].message, details: error.issues });
    }
    res.status(500).json({ code: 'CREATE_ERROR', message: 'Failed to create post' });
  }
});

// PUT /api/social/posts/:id — Edit post (owner only)
router.put('/posts/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const postId = req.params.id;
    const input = updatePostSchema.parse(req.body);

    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post || post.archivedAt) {
      return res.status(404).json({ code: 'POST_NOT_FOUND', message: 'Post not found' });
    }
    if (post.authorId !== userId) {
      return res.status(403).json({ code: 'FORBIDDEN', message: 'Not your post' });
    }

    const updateData: Record<string, unknown> = {};

    if (input.categoryId) {
      const category = await prisma.category.findUnique({
        where: { id: input.categoryId },
        select: { id: true, archivedAt: true },
      });
      if (!category || category.archivedAt) {
        return res.status(400).json({ code: 'INVALID_CATEGORY', message: 'Category not found' });
      }
      updateData.categoryId = input.categoryId;
    }

    if (input.caption !== undefined) {
      const { moderatedCaption, moderationStatus } = moderatePostCaption(input.caption);
      updateData.caption = moderatedCaption;
      updateData.moderationStatus = moderationStatus;
    }

    if (input.locationId !== undefined) {
      updateData.locationId = input.locationId;
    }

    if (input.serviceCatalogId !== undefined) {
      updateData.serviceCatalogId = input.serviceCatalogId;
    }

    if (input.isBusinessPost !== undefined) {
      updateData.isBusinessPost = input.isBusinessPost;
    }

    if (input.scheduledAt !== undefined) {
      updateData.scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : null;
      if (input.scheduledAt) {
        updateData.publishedAt = null; // clear publishedAt when scheduling
      }
    }

    const updated = await prisma.post.update({
      where: { id: postId },
      data: updateData,
      include: {
        author: { select: { id: true, displayName: true, avatarUrl: true } },
        category: { select: { id: true, name: true } },
        location: true,
        media: { orderBy: { sortOrder: 'asc' } },
        _count: { select: { likes: true, comments: true } },
      },
    });

    res.json({ data: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: error.issues[0].message });
    }
    res.status(500).json({ code: 'UPDATE_ERROR', message: 'Failed to update post' });
  }
});

// DELETE /api/social/posts/:id — Archive post (soft delete)
router.delete('/posts/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const postId = req.params.id;

    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post) {
      return res.status(404).json({ code: 'POST_NOT_FOUND', message: 'Post not found' });
    }
    if (post.authorId !== userId) {
      return res.status(403).json({ code: 'FORBIDDEN', message: 'Not your post' });
    }

    await prisma.post.update({
      where: { id: postId },
      data: { archivedAt: new Date() },
    });

    res.json({ data: { id: postId, archived: true } });
  } catch (error) {
    res.status(500).json({ code: 'DELETE_ERROR', message: 'Failed to archive post' });
  }
});

// ─── LIKES ─────────────────────────────────────────────────────────────────

// POST /api/social/posts/:id/like — Toggle like
router.post('/posts/:id/like', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const postId = req.params.id;

    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, authorId: true, archivedAt: true },
    });
    if (!post || post.archivedAt) {
      return res.status(404).json({ code: 'POST_NOT_FOUND', message: 'Post not found' });
    }

    const existing = await prisma.postLike.findUnique({
      where: { postId_userId: { postId, userId } },
    });

    if (existing) {
      // Unlike
      await prisma.postLike.delete({ where: { id: existing.id } });
      await prisma.post.update({
        where: { id: postId },
        data: { likeCount: { decrement: 1 } },
      });
      return res.json({ data: { liked: false, postId } });
    }

    // Like
    await prisma.postLike.create({ data: { postId, userId } });
    await prisma.post.update({
      where: { id: postId },
      data: { likeCount: { increment: 1 } },
    });

    publish('social.post.liked', { postId, userId }).catch(() => {});

    res.status(201).json({ data: { liked: true, postId } });
  } catch (error) {
    res.status(500).json({ code: 'LIKE_ERROR', message: 'Failed to toggle like' });
  }
});

// ─── SAVES ─────────────────────────────────────────────────────────────────

// POST /api/social/posts/:id/save — Toggle save/bookmark
router.post('/posts/:id/save', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const postId = req.params.id;

    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, archivedAt: true },
    });
    if (!post || post.archivedAt) {
      return res.status(404).json({ code: 'POST_NOT_FOUND', message: 'Post not found' });
    }

    const existing = await prisma.postSave.findUnique({
      where: { postId_userId: { postId, userId } },
    });

    if (existing) {
      // Unsave
      await prisma.postSave.delete({ where: { id: existing.id } });
      await prisma.post.update({
        where: { id: postId },
        data: { saveCount: { decrement: 1 } },
      });
      return res.json({ data: { saved: false, postId } });
    }

    // Save
    await prisma.postSave.create({ data: { postId, userId } });
    await prisma.post.update({
      where: { id: postId },
      data: { saveCount: { increment: 1 } },
    });

    res.status(201).json({ data: { saved: true, postId } });
  } catch (error) {
    res.status(500).json({ code: 'SAVE_ERROR', message: 'Failed to toggle save' });
  }
});

// ─── COMMENTS ──────────────────────────────────────────────────────────────

// GET /api/social/posts/:id/comments — List comments (paginated)
router.get('/posts/:id/comments', async (req: AuthRequest, res: Response) => {
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

// POST /api/social/posts/:id/comments — Add comment
router.post('/posts/:id/comments', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const postId = req.params.id;
    const input = createCommentSchema.parse(req.body);

    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, authorId: true, archivedAt: true },
    });
    if (!post || post.archivedAt) {
      return res.status(404).json({ code: 'POST_NOT_FOUND', message: 'Post not found' });
    }

    // PII moderation on comment
    const moderationResult = moderateMessage(input.text);
    let moderationStatus: 'pending' | 'approved' | 'flagged' = 'approved';
    if (moderationResult.action === 'block') {
      moderationStatus = 'flagged';
    } else if (moderationResult.action === 'flag') {
      moderationStatus = 'flagged';
    } else if (moderationResult.action === 'mask') {
      moderationStatus = 'pending';
    }

    const comment = await prisma.postComment.create({
      data: {
        postId,
        authorId: userId,
        text: moderationResult.displayText,
        moderationStatus,
      },
      include: {
        author: { select: { id: true, displayName: true, avatarUrl: true } },
      },
    });

    // Update comment count on post
    await prisma.post.update({
      where: { id: postId },
      data: { commentCount: { increment: 1 } },
    });

    publish('social.post.commented', {
      postId,
      commentId: comment.id,
      userId,
      postAuthorId: post.authorId,
    }).catch(() => {});

    res.status(201).json({
      data: comment,
      moderationWarnings: moderationResult.reasons.length > 0 ? moderationResult.reasons : undefined,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: error.issues[0].message });
    }
    res.status(500).json({ code: 'COMMENT_ERROR', message: 'Failed to add comment' });
  }
});

// DELETE /api/social/posts/:id/comments/:commentId — Delete comment
router.delete('/posts/:id/comments/:commentId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const commentId = req.params.commentId;

    const comment = await prisma.postComment.findUnique({
      where: { id: commentId },
      include: { post: { select: { authorId: true } } },
    });

    if (!comment) {
      return res.status(404).json({ code: 'COMMENT_NOT_FOUND', message: 'Comment not found' });
    }

    // Only comment author or post author can delete
    if (comment.authorId !== userId && comment.post.authorId !== userId) {
      return res.status(403).json({ code: 'FORBIDDEN', message: 'Not authorized to delete this comment' });
    }

    await prisma.postComment.update({
      where: { id: commentId },
      data: { archivedAt: new Date() },
    });

    // Decrement comment count
    await prisma.post.update({
      where: { id: comment.postId },
      data: { commentCount: { decrement: 1 } },
    });

    res.json({ data: { id: commentId, deleted: true } });
  } catch (error) {
    res.status(500).json({ code: 'DELETE_COMMENT_ERROR', message: 'Failed to delete comment' });
  }
});

// ─── STORIES ───────────────────────────────────────────────────────────────

// GET /api/social/stories/feed — Stories from followed users + nearby
router.get('/stories/feed', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const now = new Date();

    let authorIds: string[] | undefined;
    if (userId) {
      const following = await prisma.follow.findMany({
        where: { followerId: userId },
        select: { followeeId: true },
      });
      authorIds = [userId, ...following.map(f => f.followeeId)];
    }

    const stories = await prisma.story.findMany({
      where: {
        archivedAt: null,
        expiresAt: { gt: now },
        ...(authorIds ? { authorId: { in: authorIds } } : { visibility: 'PUBLIC' }),
      },
      include: {
        author: { select: { id: true, displayName: true, avatarUrl: true } },
        viewers: userId ? { where: { userId }, take: 1 } : false,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // Group by author for feed display
    const byAuthor = new Map<string, typeof stories>();
    for (const story of stories) {
      const existing = byAuthor.get(story.authorId);
      if (existing) {
        existing.push(story);
      } else {
        byAuthor.set(story.authorId, [story]);
      }
    }

    const feed = Array.from(byAuthor.entries()).map(([authorId, authorStories]) => ({
      author: authorStories[0].author,
      stories: authorStories.map(s => ({
        id: s.id,
        mediaUrl: s.mediaUrl,
        thumbnailUrl: s.thumbnailUrl,
        mediaType: s.mediaType || 'image',
        duration: s.duration ?? 15,
        viewCount: s.views,
        createdAt: s.createdAt,
        expiresAt: s.expiresAt,
        viewed: userId ? (Array.isArray(s.viewers) ? s.viewers.length > 0 : false) : false,
      })),
    }));

    res.json({ data: feed });
  } catch (error) {
    res.status(500).json({ code: 'STORIES_ERROR', message: 'Failed to load stories' });
  }
});

// POST /api/social/stories — Create story
router.post('/stories', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const input = createStorySchema.parse(req.body);

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const story = await prisma.story.create({
      data: {
        authorId: userId,
        mediaUrl: input.mediaUrl,
        mediaType: input.mediaType,
        duration: input.duration ?? 15,
        visibility: 'PUBLIC',
        expiresAt,
      },
      include: {
        author: { select: { id: true, displayName: true, avatarUrl: true } },
      },
    });

    publish('social.story.created', { storyId: story.id, authorId: userId }).catch(() => {});

    res.status(201).json({ data: story });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: error.issues[0].message });
    }
    res.status(500).json({ code: 'STORY_ERROR', message: 'Failed to create story' });
  }
});

// DELETE /api/social/stories/:id — Delete story (owner only)
router.delete('/stories/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const storyId = req.params.id;

    const story = await prisma.story.findUnique({ where: { id: storyId } });
    if (!story) {
      return res.status(404).json({ code: 'STORY_NOT_FOUND', message: 'Story not found' });
    }
    if (story.authorId !== userId) {
      return res.status(403).json({ code: 'FORBIDDEN', message: 'Not your story' });
    }

    await prisma.story.update({
      where: { id: storyId },
      data: { archivedAt: new Date() },
    });

    res.json({ data: { id: storyId, deleted: true } });
  } catch (error) {
    res.status(500).json({ code: 'STORY_DELETE_ERROR', message: 'Failed to delete story' });
  }
});

// ─── FOLLOWS ───────────────────────────────────────────────────────────────

// POST /api/social/users/:userId/follow — Follow/unfollow toggle
router.post('/users/:userId/follow', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const followerId = req.user!.userId;
    const followeeId = req.params.userId;

    if (followerId === followeeId) {
      return res.status(400).json({ code: 'SELF_FOLLOW', message: 'Cannot follow yourself' });
    }

    const targetUser = await prisma.user.findUnique({ where: { id: followeeId } });
    if (!targetUser) {
      return res.status(404).json({ code: 'USER_NOT_FOUND', message: 'User not found' });
    }

    const existing = await prisma.follow.findUnique({
      where: { followerId_followeeId: { followerId, followeeId } },
    });

    if (existing) {
      // Unfollow
      await prisma.follow.delete({ where: { id: existing.id } });
      return res.json({ data: { following: false, userId: followeeId } });
    }

    // Follow
    await prisma.follow.create({ data: { followerId, followeeId } });

    publish('social.user.followed', { followerId, followeeId }).catch(() => {});

    res.status(201).json({ data: { following: true, userId: followeeId } });
  } catch (error) {
    res.status(500).json({ code: 'FOLLOW_ERROR', message: 'Failed to toggle follow' });
  }
});

// GET /api/social/users/:userId/followers — List followers
router.get('/users/:userId/followers', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.params.userId;
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(String(req.query.pageSize ?? '20'), 10) || 20));

    const [followers, total] = await Promise.all([
      prisma.follow.findMany({
        where: { followeeId: userId },
        include: {
          follower: { select: { id: true, displayName: true, avatarUrl: true, bio: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.follow.count({ where: { followeeId: userId } }),
    ]);

    res.json({
      data: followers.map(f => f.follower),
      total,
      page,
      pageSize,
    });
  } catch (error) {
    res.status(500).json({ code: 'FOLLOWERS_ERROR', message: 'Failed to load followers' });
  }
});

// GET /api/social/users/:userId/following — List following
router.get('/users/:userId/following', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.params.userId;
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(String(req.query.pageSize ?? '20'), 10) || 20));

    const [following, total] = await Promise.all([
      prisma.follow.findMany({
        where: { followerId: userId },
        include: {
          followee: { select: { id: true, displayName: true, avatarUrl: true, bio: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.follow.count({ where: { followerId: userId } }),
    ]);

    res.json({
      data: following.map(f => f.followee),
      total,
      page,
      pageSize,
    });
  } catch (error) {
    res.status(500).json({ code: 'FOLLOWING_ERROR', message: 'Failed to load following' });
  }
});

export default router;