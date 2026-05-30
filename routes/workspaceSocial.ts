import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/db.js';
import { authenticate, AuthRequest } from '../lib/auth.middleware.js';
import { moderateMessage } from '../lib/chatModeration.js';
import { publish } from '../lib/bus.js';

const router = Router();

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

const createPostSchema = z.object({
  caption: z.string().max(2000).optional(),
  categoryId: z.string().min(1, 'Category is required'),
  mediaUrls: z.array(z.string().url()).min(0).max(10),
  mediaTypes: z.array(z.enum(['image', 'video'])).min(0).max(10).optional(),
  serviceCatalogId: z.string().optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
});

const updatePostSchema = z.object({
  caption: z.string().max(2000).optional(),
  categoryId: z.string().optional(),
  serviceCatalogId: z.string().nullable().optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
});

const createStorySchema = z.object({
  mediaUrl: z.string().url(),
  mediaType: z.enum(['image', 'video']),
  caption: z.string().max(500).optional(),
  duration: z.number().int().positive().max(60).optional(),
});

const replyCommentSchema = z.object({
  text: z.string().min(1).max(1000),
});

const roleSchema = z.object({
  userId: z.string().min(1),
});

// ─── Workspace Access Verification ──────────────────────────────────────────

async function verifyWorkspaceSocialAccess(
  req: AuthRequest,
  workspaceId: string,
  requireOwner: boolean = false,
): Promise<{ allowed: boolean; error?: { status: number; code: string; message: string } }> {
  const userId = req.user!.userId;

  // Check if user is workspace member
  const membership = await prisma.companyUser.findUnique({
    where: { companyId_userId: { companyId: workspaceId, userId } },
  });

  if (!membership) {
    return { allowed: false, error: { status: 403, code: 'FORBIDDEN', message: 'Not a member of this workspace' } };
  }

  if (requireOwner && membership.role !== 'owner') {
    return { allowed: false, error: { status: 403, code: 'FORBIDDEN', message: 'Only the workspace owner can manage social roles' } };
  }

  // Check if user has social media manager role OR is owner/admin
  const isOwner = membership.role === 'owner';
  const isAdmin = membership.role === 'admin';

  if (!isOwner && !isAdmin) {
    // Check for explicit social media role
    const socialRole = await prisma.workspaceSocialRole.findFirst({
      where: { workspaceId, userId, archivedAt: null },
    });
    if (!socialRole) {
      return { allowed: false, error: { status: 403, code: 'FORBIDDEN', message: 'No social media access for this workspace' } };
    }
  }

  return { allowed: true };
}

// ─── PII Moderation Helper ──────────────────────────────────────────────────

function moderateCaption(caption: string | null | undefined): {
  moderatedCaption: string | null;
  moderationStatus: 'pending' | 'approved' | 'flagged';
  moderationReasons: string[];
} {
  if (!caption) {
    return { moderatedCaption: null, moderationStatus: 'approved', moderationReasons: [] };
  }
  const result = moderateMessage(caption);
  if (result.action === 'block') {
    return { moderatedCaption: null, moderationStatus: 'flagged', moderationReasons: result.reasons };
  }
  if (result.action === 'flag') {
    return { moderatedCaption: result.displayText, moderationStatus: 'flagged', moderationReasons: result.reasons };
  }
  if (result.action === 'mask') {
    return { moderatedCaption: result.displayText, moderationStatus: 'pending', moderationReasons: result.reasons };
  }
  return { moderatedCaption: caption, moderationStatus: 'approved', moderationReasons: [] };
}

// ─── POSTS ──────────────────────────────────────────────────────────────────

// GET /api/workspace/social/posts — All published posts for this workspace
router.get('/social/posts', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const workspaceId = req.query.workspaceId as string;
    if (!workspaceId) {
      return res.status(400).json({ code: 'MISSING_WORKSPACE', message: 'workspaceId query param is required' });
    }

    const access = await verifyWorkspaceSocialAccess(req, workspaceId);
    if (!access.allowed) {
      return res.status(access.error!.status).json({ code: access.error!.code, message: access.error!.message });
    }

    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(String(req.query.pageSize ?? '20'), 10) || 20));
    const statusFilter = req.query.status as string | undefined; // 'published' | 'scheduled' | 'archived'

    const where: Record<string, unknown> = {
      authorId: { in: await getWorkspaceMemberIds(workspaceId) },
      isBusinessPost: true,
    };

    if (statusFilter === 'scheduled') {
      where.scheduledAt = { not: null };
      where.publishedAt = null;
      where.archivedAt = null;
    } else if (statusFilter === 'archived') {
      where.archivedAt = { not: null };
    } else {
      // Default: published posts
      where.publishedAt = { not: null };
      where.archivedAt = null;
    }

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where: where as any,
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
      prisma.post.count({ where: where as any }),
    ]);

    res.json({ data: posts, total, page, pageSize });
  } catch (error) {
    console.error(error);
    res.status(500).json({ code: 'POSTS_ERROR', message: 'Failed to load workspace posts' });
  }
});

// POST /api/workspace/social/posts — Schedule/create a new post for workspace
router.post('/social/posts', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const workspaceId = req.query.workspaceId as string;
    if (!workspaceId) {
      return res.status(400).json({ code: 'MISSING_WORKSPACE', message: 'workspaceId query param is required' });
    }

    const access = await verifyWorkspaceSocialAccess(req, workspaceId);
    if (!access.allowed) {
      return res.status(access.error!.status).json({ code: access.error!.code, message: access.error!.message });
    }

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

    // PII moderation
    const { moderatedCaption, moderationStatus, moderationReasons } = moderateCaption(input.caption);

    // Determine if scheduling or publishing now
    const isScheduled = !!input.scheduledAt;

    const post = await prisma.post.create({
      data: {
        authorId: userId,
        categoryId: input.categoryId,
        caption: moderationStatus === 'flagged' ? null : moderatedCaption,
        serviceCatalogId: input.serviceCatalogId ?? null,
        isBusinessPost: true,
        moderationStatus,
        scheduledAt: isScheduled ? new Date(input.scheduledAt!) : null,
        publishedAt: isScheduled ? null : new Date(),
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
        media: { orderBy: { sortOrder: 'asc' } },
        _count: { select: { likes: true, comments: true } },
      },
    });

    publish('social.post.created', {
      postId: post.id,
      authorId: userId,
      categoryId: input.categoryId,
      isBusinessPost: true,
      moderationStatus,
      workspaceId,
    }).catch(() => {});

    res.status(201).json({
      data: post,
      moderationWarnings: moderationReasons.length > 0 ? moderationReasons : undefined,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: error.issues[0].message, details: error.issues });
    }
    console.error(error);
    res.status(500).json({ code: 'CREATE_ERROR', message: 'Failed to create post' });
  }
});

// PUT /api/workspace/social/posts/:id — Edit post
router.put('/social/posts/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const workspaceId = req.query.workspaceId as string;
    if (!workspaceId) {
      return res.status(400).json({ code: 'MISSING_WORKSPACE', message: 'workspaceId query param is required' });
    }

    const access = await verifyWorkspaceSocialAccess(req, workspaceId);
    if (!access.allowed) {
      return res.status(access.error!.status).json({ code: access.error!.code, message: access.error!.message });
    }

    const postId = req.params.id;
    const input = updatePostSchema.parse(req.body);

    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post) {
      return res.status(404).json({ code: 'POST_NOT_FOUND', message: 'Post not found' });
    }

    // Verify post belongs to workspace
    const memberIds = await getWorkspaceMemberIds(workspaceId);
    if (!memberIds.includes(post.authorId)) {
      return res.status(403).json({ code: 'FORBIDDEN', message: 'Post does not belong to this workspace' });
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
      const { moderatedCaption, moderationStatus } = moderateCaption(input.caption);
      updateData.caption = moderatedCaption;
      updateData.moderationStatus = moderationStatus;
    }

    if (input.serviceCatalogId !== undefined) {
      updateData.serviceCatalogId = input.serviceCatalogId;
    }

    if (input.scheduledAt !== undefined) {
      updateData.scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : null;
      if (input.scheduledAt) {
        updateData.publishedAt = null;
      }
    }

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
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: error.issues[0].message });
    }
    console.error(error);
    res.status(500).json({ code: 'UPDATE_ERROR', message: 'Failed to update post' });
  }
});

// DELETE /api/workspace/social/posts/:id — Archive post (soft-delete)
router.delete('/social/posts/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const workspaceId = req.query.workspaceId as string;
    if (!workspaceId) {
      return res.status(400).json({ code: 'MISSING_WORKSPACE', message: 'workspaceId query param is required' });
    }

    const access = await verifyWorkspaceSocialAccess(req, workspaceId);
    if (!access.allowed) {
      return res.status(access.error!.status).json({ code: access.error!.code, message: access.error!.message });
    }

    const postId = req.params.id;
    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post) {
      return res.status(404).json({ code: 'POST_NOT_FOUND', message: 'Post not found' });
    }

    const memberIds = await getWorkspaceMemberIds(workspaceId);
    if (!memberIds.includes(post.authorId)) {
      return res.status(403).json({ code: 'FORBIDDEN', message: 'Post does not belong to this workspace' });
    }

    await prisma.post.update({
      where: { id: postId },
      data: { archivedAt: new Date() },
    });

    res.json({ data: { id: postId, archived: true } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ code: 'DELETE_ERROR', message: 'Failed to archive post' });
  }
});

// ─── STORIES ────────────────────────────────────────────────────────────────

// GET /api/workspace/social/stories — All stories for this workspace
router.get('/social/stories', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const workspaceId = req.query.workspaceId as string;
    if (!workspaceId) {
      return res.status(400).json({ code: 'MISSING_WORKSPACE', message: 'workspaceId query param is required' });
    }

    const access = await verifyWorkspaceSocialAccess(req, workspaceId);
    if (!access.allowed) {
      return res.status(access.error!.status).json({ code: access.error!.code, message: access.error!.message });
    }

    const memberIds = await getWorkspaceMemberIds(workspaceId);
    const now = new Date();
    const includeExpired = req.query.includeExpired === 'true';

    const stories = await prisma.story.findMany({
      where: {
        authorId: { in: memberIds },
        archivedAt: null,
        ...(includeExpired ? {} : { expiresAt: { gt: now } }),
      },
      include: {
        author: { select: { id: true, displayName: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const items = stories.map((s) => ({
      id: s.id,
      mediaUrl: s.mediaUrl,
      mediaType: s.mediaType,
      thumbnailUrl: s.thumbnailUrl,
      caption: s.caption,
      views: s.views,
      isActive: s.expiresAt > now,
      author: s.author,
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
    }));

    res.json({ data: items });
  } catch (error) {
    console.error(error);
    res.status(500).json({ code: 'STORIES_ERROR', message: 'Failed to load stories' });
  }
});

// POST /api/workspace/social/stories — Create story for workspace
router.post('/social/stories', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const workspaceId = req.query.workspaceId as string;
    if (!workspaceId) {
      return res.status(400).json({ code: 'MISSING_WORKSPACE', message: 'workspaceId query param is required' });
    }

    const access = await verifyWorkspaceSocialAccess(req, workspaceId);
    if (!access.allowed) {
      return res.status(access.error!.status).json({ code: access.error!.code, message: access.error!.message });
    }

    const userId = req.user!.userId;
    const input = createStorySchema.parse(req.body);

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const story = await prisma.story.create({
      data: {
        authorId: userId,
        mediaUrl: input.mediaUrl,
        mediaType: input.mediaType,
        caption: input.caption,
        duration: input.duration ?? 15,
        visibility: 'PUBLIC',
        expiresAt,
      },
      include: {
        author: { select: { id: true, displayName: true, avatarUrl: true } },
      },
    });

    publish('social.story.created', { storyId: story.id, authorId: userId, workspaceId }).catch(() => {});

    res.status(201).json({ data: story });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: error.issues[0].message });
    }
    console.error(error);
    res.status(500).json({ code: 'STORY_ERROR', message: 'Failed to create story' });
  }
});

// ─── COMMENTS ───────────────────────────────────────────────────────────────

// GET /api/workspace/social/comments — Comments from all workspace posts
router.get('/social/comments', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const workspaceId = req.query.workspaceId as string;
    if (!workspaceId) {
      return res.status(400).json({ code: 'MISSING_WORKSPACE', message: 'workspaceId query param is required' });
    }

    const access = await verifyWorkspaceSocialAccess(req, workspaceId);
    if (!access.allowed) {
      return res.status(access.error!.status).json({ code: access.error!.code, message: access.error!.message });
    }

    const memberIds = await getWorkspaceMemberIds(workspaceId);
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(String(req.query.pageSize ?? '20'), 10) || 20));

    // Get comments on workspace posts
    const workspacePosts = await prisma.post.findMany({
      where: { authorId: { in: memberIds }, archivedAt: null },
      select: { id: true },
    });
    const postIds = workspacePosts.map((p) => p.id);

    const [comments, total] = await Promise.all([
      prisma.postComment.findMany({
        where: { postId: { in: postIds }, archivedAt: null },
        include: {
          author: { select: { id: true, displayName: true, avatarUrl: true } },
          post: { select: { id: true, caption: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.postComment.count({ where: { postId: { in: postIds }, archivedAt: null } }),
    ]);

    res.json({ data: comments, total, page, pageSize });
  } catch (error) {
    console.error(error);
    res.status(500).json({ code: 'COMMENTS_ERROR', message: 'Failed to load comments' });
  }
});

// POST /api/workspace/social/comments/:id/reply — Reply to a comment on a workspace post
router.post('/social/comments/:id/reply', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const workspaceId = req.query.workspaceId as string;
    if (!workspaceId) {
      return res.status(400).json({ code: 'MISSING_WORKSPACE', message: 'workspaceId query param is required' });
    }

    const access = await verifyWorkspaceSocialAccess(req, workspaceId);
    if (!access.allowed) {
      return res.status(access.error!.status).json({ code: access.error!.code, message: access.error!.message });
    }

    const userId = req.user!.userId;
    const commentId = req.params.id;
    const input = replyCommentSchema.parse(req.body);

    // Find the original comment and its post
    const originalComment = await prisma.postComment.findUnique({
      where: { id: commentId },
      include: { post: true },
    });
    if (!originalComment || originalComment.archivedAt) {
      return res.status(404).json({ code: 'COMMENT_NOT_FOUND', message: 'Comment not found' });
    }

    // Verify the post belongs to the workspace
    const memberIds = await getWorkspaceMemberIds(workspaceId);
    if (!memberIds.includes(originalComment.post.authorId)) {
      return res.status(403).json({ code: 'FORBIDDEN', message: 'Post does not belong to this workspace' });
    }

    // PII moderation
    const moderationResult = moderateMessage(input.text);
    let moderationStatus: 'pending' | 'approved' | 'flagged' = 'approved';
    if (moderationResult.action === 'block' || moderationResult.action === 'flag') {
      moderationStatus = 'flagged';
    } else if (moderationResult.action === 'mask') {
      moderationStatus = 'pending';
    }

    const reply = await prisma.postComment.create({
      data: {
        postId: originalComment.postId,
        authorId: userId,
        text: moderationResult.displayText,
        moderationStatus,
      },
      include: {
        author: { select: { id: true, displayName: true, avatarUrl: true } },
      },
    });

    // Increment comment count
    await prisma.post.update({
      where: { id: originalComment.postId },
      data: { commentCount: { increment: 1 } },
    });

    res.status(201).json({
      data: reply,
      moderationWarnings: moderationResult.reasons.length > 0 ? moderationResult.reasons : undefined,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: error.issues[0].message });
    }
    console.error(error);
    res.status(500).json({ code: 'REPLY_ERROR', message: 'Failed to send reply' });
  }
});

// ─── SOCIAL ROLES ───────────────────────────────────────────────────────────

// GET /api/workspace/social/roles — Get social media roles for workspace
router.get('/social/roles', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const workspaceId = req.query.workspaceId as string;
    if (!workspaceId) {
      return res.status(400).json({ code: 'MISSING_WORKSPACE', message: 'workspaceId query param is required' });
    }

    const access = await verifyWorkspaceSocialAccess(req, workspaceId);
    if (!access.allowed) {
      return res.status(access.error!.status).json({ code: access.error!.code, message: access.error!.message });
    }

    const roles = await prisma.workspaceSocialRole.findMany({
      where: { workspaceId, archivedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    // The WorkspaceSocialRole model uses plain string fields (userId, grantedById)
    // without Prisma relations, so we resolve user info via separate queries.
    const enrichedRoles = await Promise.all(
      roles.map(async (role) => {
        const [user, grantedBy] = await Promise.all([
          prisma.user.findUnique({
            where: { id: role.userId },
            select: { id: true, displayName: true, firstName: true, lastName: true, avatarUrl: true },
          }),
          prisma.user.findUnique({
            where: { id: role.grantedById },
            select: { id: true, displayName: true },
          }),
        ]);
        return {
          id: role.id,
          workspaceId: role.workspaceId,
          userId: role.userId,
          user,
          grantedById: role.grantedById,
          grantedBy,
          createdAt: role.createdAt,
        };
      }),
    );

    res.json({ data: enrichedRoles });
  } catch (error) {
    console.error(error);
    res.status(500).json({ code: 'ROLES_ERROR', message: 'Failed to load social roles' });
  }
});

// PUT /api/workspace/social/roles/:userId — Grant/revoke social media manager role
router.put('/social/roles/:userId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const workspaceId = req.query.workspaceId as string;
    if (!workspaceId) {
      return res.status(400).json({ code: 'MISSING_WORKSPACE', message: 'workspaceId query param is required' });
    }

    // Only owner can manage roles
    const access = await verifyWorkspaceSocialAccess(req, workspaceId, true);
    if (!access.allowed) {
      return res.status(access.error!.status).json({ code: access.error!.code, message: access.error!.message });
    }

    const targetUserId = req.params.userId;
    const { grant } = req.body; // true = grant, false = revoke

    // Verify target user is workspace member
    const targetMembership = await prisma.companyUser.findUnique({
      where: { companyId_userId: { companyId: workspaceId, userId: targetUserId } },
    });
    if (!targetMembership) {
      return res.status(404).json({ code: 'USER_NOT_FOUND', message: 'User is not a member of this workspace' });
    }

    if (grant === false) {
      // Revoke: archive all active social roles for this user in this workspace
      await prisma.workspaceSocialRole.updateMany({
        where: { workspaceId, userId: targetUserId, archivedAt: null },
        data: { archivedAt: new Date() },
      });
      return res.json({ data: { userId: targetUserId, role: 'revoked' } });
    }

    // Grant: check if already has an active role
    const existing = await prisma.workspaceSocialRole.findFirst({
      where: { workspaceId, userId: targetUserId, archivedAt: null },
    });

    if (existing) {
      return res.json({ data: { userId: targetUserId, role: 'already_granted', since: existing.createdAt } });
    }

    const role = await prisma.workspaceSocialRole.create({
      data: {
        workspaceId,
        userId: targetUserId,
        grantedById: req.user!.userId,
      },
    });

    res.status(201).json({ data: { userId: targetUserId, role: 'granted', id: role.id, createdAt: role.createdAt } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ code: 'ROLE_ERROR', message: 'Failed to update social role' });
  }
});

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Returns all user IDs that are members of a workspace.
 */
async function getWorkspaceMemberIds(workspaceId: string): Promise<string[]> {
  const members = await prisma.companyUser.findMany({
    where: { companyId: workspaceId },
    select: { userId: true },
  });
  return members.map((m) => m.userId);
}

export default router;