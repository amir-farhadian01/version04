import { Router, Response } from 'express';
import { ChatModerationStatus, Prisma } from '@prisma/client';
import prisma from '../lib/db.js';
import { authenticate, isAdmin, AuthRequest } from '../lib/auth.middleware.js';

const router = Router();

function parseDate(raw: unknown): Date | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function parseMetadataRecord(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return { ...(raw as Record<string, unknown>) };
  }
  return {};
}

function mergeMessageMetadata(
  existing: Prisma.JsonValue | null | undefined,
  patch: Record<string, unknown>,
): Prisma.InputJsonValue {
  const base = parseMetadataRecord(existing);
  return { ...base, ...patch } as Prisma.InputJsonValue;
}

function pickStr(body: unknown, key: string): string | undefined {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return undefined;
  const v = (body as Record<string, unknown>)[key];
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t.length ? t : undefined;
}

router.use(authenticate, isAdmin);

/** Read-only thread + messages for admin order drawer (no participant auth). */
router.get('/thread/:orderId', async (req: AuthRequest, res: Response) => {
  try {
    const { orderId } = req.params;
    if (!orderId?.trim()) {
      return res.status(400).json({ error: 'orderId is required' });
    }
    const thread = await prisma.orderChatThread.findUnique({
      where: { orderId: orderId.trim() },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 500,
        },
      },
    });
    if (!thread) {
      return res.status(404).json({ error: 'NO_THREAD' });
    }
    return res.json({
      thread: {
        id: thread.id,
        orderId: thread.orderId,
        customerId: thread.customerId,
        providerId: thread.providerId,
        isClosed: thread.isClosed,
        createdAt: thread.createdAt.toISOString(),
        updatedAt: thread.updatedAt.toISOString(),
      },
      messages: thread.messages.map((m) => ({
        id: m.id,
        threadId: m.threadId,
        senderId: m.senderId,
        senderRole: m.senderRole,
        type: m.type,
        originalText: m.originalText,
        displayText: m.displayText,
        moderationStatus: m.moderationStatus,
        createdAt: m.createdAt.toISOString(),
        editedAt: m.editedAt?.toISOString() ?? null,
      })),
    });
  } catch (err: unknown) {
    console.error(err);
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
  }
});

router.get('/flags', async (req: AuthRequest, res: Response) => {
  try {
    const from = parseDate(req.query.from);
    const to = parseDate(req.query.to);
    const providerId = typeof req.query.providerId === 'string' ? req.query.providerId : undefined;
    const customerId = typeof req.query.customerId === 'string' ? req.query.customerId : undefined;
    const senderId = typeof req.query.senderId === 'string' ? req.query.senderId : undefined;
    const participantId =
      typeof req.query.participantId === 'string' ? req.query.participantId : undefined;
    const workspaceId = typeof req.query.workspaceId === 'string' ? req.query.workspaceId : undefined;
    const statusRaw = typeof req.query.status === 'string' ? req.query.status : undefined;
    const statuses: ChatModerationStatus[] = statusRaw
      ? statusRaw
          .split(',')
          .map((s) => s.trim())
          .filter((s): s is ChatModerationStatus =>
            ['masked', 'flagged', 'blocked', 'clean'].includes(s),
          )
      : [ChatModerationStatus.masked, ChatModerationStatus.flagged, ChatModerationStatus.blocked];
    const limit = Math.max(
      1,
      Math.min(500, typeof req.query.limit === 'string' ? Number.parseInt(req.query.limit, 10) || 50 : 50),
    );

    const threadWhere: Prisma.OrderChatThreadWhereInput = {};
    if (providerId) threadWhere.providerId = providerId;
    if (customerId) threadWhere.customerId = customerId;
    if (workspaceId) threadWhere.order = { matchedWorkspaceId: workspaceId };
    if (participantId) {
      threadWhere.OR = [
        { customerId: participantId },
        { providerId: participantId },
        { messages: { some: { senderId: participantId } } },
      ];
    }

    const where: Prisma.OrderChatMessageWhereInput = {
      moderationStatus: { in: statuses },
      ...(senderId ? { senderId } : {}),
      ...(from || to
        ? {
            createdAt: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
      ...(Object.keys(threadWhere).length ? { thread: threadWhere } : {}),
    };

    const [total, rows] = await Promise.all([
      prisma.orderChatMessage.count({ where }),
      prisma.orderChatMessage.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: {
          thread: {
            select: {
              id: true,
              orderId: true,
              customerId: true,
              providerId: true,
              order: {
                select: {
                  matchedWorkspaceId: true,
                  matchedWorkspace: { select: { id: true, name: true } },
                  matchedPackageId: true,
                  serviceCatalogId: true,
                  status: true,
                },
              },
            },
          },
        },
      }),
    ]);

    return res.json({ items: rows, total, truncated: total > rows.length });
  } catch (err: unknown) {
    console.error(err);
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
  }
});

router.post('/flags/:id/review', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const note = pickStr(req.body, 'internalNote');
    const row = await prisma.orderChatMessage.findUnique({
      where: { id },
      include: { thread: { select: { orderId: true } } },
    });
    if (!row) {
      return res.status(404).json({ error: 'Message not found' });
    }
    const meta = parseMetadataRecord(row.metadata);
    const prevReview =
      meta.moderationReview && typeof meta.moderationReview === 'object' && !Array.isArray(meta.moderationReview)
        ? (meta.moderationReview as Record<string, unknown>)
        : {};
    const now = new Date().toISOString();
    const nextMeta = mergeMessageMetadata(row.metadata, {
      moderationReview: {
        ...prevReview,
        reviewedAt: now,
        reviewedById: req.user!.userId,
        ...(note ? { internalNote: note } : {}),
      },
    });
    const updated = await prisma.orderChatMessage.update({
      where: { id },
      data: { metadata: nextMeta },
      include: {
        thread: {
          select: {
            id: true,
            orderId: true,
            customerId: true,
            providerId: true,
            order: {
              select: {
                matchedWorkspaceId: true,
                matchedWorkspace: { select: { id: true, name: true } },
                matchedPackageId: true,
                serviceCatalogId: true,
                status: true,
              },
            },
          },
        },
      },
    });
    try {
      await prisma.auditLog.create({
        data: {
          actorId: req.user!.userId,
          action: 'CHAT_MODERATION_REVIEWED',
          resourceType: 'order_chat_message',
          resourceId: id,
          metadata: { orderId: row.thread.orderId } as Prisma.InputJsonValue,
        },
      });
    } catch {
      /* non-fatal */
    }
    return res.json(updated);
  } catch (err: unknown) {
    console.error(err);
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
  }
});

router.post('/flags/:id/note', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const note = pickStr(req.body, 'internalNote');
    if (!note) {
      return res.status(400).json({ error: 'internalNote is required' });
    }
    const row = await prisma.orderChatMessage.findUnique({ where: { id } });
    if (!row) {
      return res.status(404).json({ error: 'Message not found' });
    }
    const meta = parseMetadataRecord(row.metadata);
    const prevReview =
      meta.moderationReview && typeof meta.moderationReview === 'object' && !Array.isArray(meta.moderationReview)
        ? (meta.moderationReview as Record<string, unknown>)
        : {};
    const nextMeta = mergeMessageMetadata(row.metadata, {
      moderationReview: {
        ...prevReview,
        internalNote: note,
        noteUpdatedAt: new Date().toISOString(),
        noteUpdatedById: req.user!.userId,
      },
    });
    const updated = await prisma.orderChatMessage.update({
      where: { id },
      data: { metadata: nextMeta },
      include: {
        thread: {
          select: {
            id: true,
            orderId: true,
            customerId: true,
            providerId: true,
            order: {
              select: {
                matchedWorkspaceId: true,
                matchedWorkspace: { select: { id: true, name: true } },
                matchedPackageId: true,
                serviceCatalogId: true,
                status: true,
              },
            },
          },
        },
      },
    });
    return res.json(updated);
  } catch (err: unknown) {
    console.error(err);
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
  }
});

router.post('/flags/:id/escalate', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const note = pickStr(req.body, 'internalNote');
    const row = await prisma.orderChatMessage.findUnique({
      where: { id },
      include: { thread: { select: { orderId: true } } },
    });
    if (!row) {
      return res.status(404).json({ error: 'Message not found' });
    }
    const meta = parseMetadataRecord(row.metadata);
    const prevReview =
      meta.moderationReview && typeof meta.moderationReview === 'object' && !Array.isArray(meta.moderationReview)
        ? (meta.moderationReview as Record<string, unknown>)
        : {};
    const now = new Date().toISOString();
    const nextMeta = mergeMessageMetadata(row.metadata, {
      moderationReview: {
        ...prevReview,
        escalatedToSupport: true,
        escalatedAt: now,
        escalatedById: req.user!.userId,
        ...(note ? { internalNote: note } : {}),
      },
    });
    const updated = await prisma.orderChatMessage.update({
      where: { id },
      data: { metadata: nextMeta },
      include: {
        thread: {
          select: {
            id: true,
            orderId: true,
            customerId: true,
            providerId: true,
            order: {
              select: {
                matchedWorkspaceId: true,
                matchedWorkspace: { select: { id: true, name: true } },
                matchedPackageId: true,
                serviceCatalogId: true,
                status: true,
              },
            },
          },
        },
      },
    });
    try {
      await prisma.auditLog.create({
        data: {
          actorId: req.user!.userId,
          action: 'CHAT_MODERATION_ESCALATED',
          resourceType: 'order_chat_message',
          resourceId: id,
          metadata: { orderId: row.thread.orderId, note: note ?? null } as Prisma.InputJsonValue,
        },
      });
    } catch {
      /* non-fatal */
    }
    return res.json(updated);
  } catch (err: unknown) {
    console.error(err);
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
  }
});

// ─── User Moderation Actions ────────────────────────────────────────────────

/** POST /api/admin/chat/users/:userId/warn — Log a warning to the user about PII sharing */
router.post('/users/:userId/warn', async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    if (!userId?.trim()) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId.trim() } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Create a notification warning the user
    await prisma.notification.create({
      data: {
        userId: userId.trim(),
        title: 'Moderation Warning',
        message:
          'You have received a warning about sharing contact information. Please keep all communication within the app. Repeated violations may result in a temporary chat mute.',
        type: 'system',
        link: '/settings',
      },
    });

    // Log audit trail
    try {
      await prisma.auditLog.create({
        data: {
          actorId: req.user!.userId,
          action: 'CHAT_MODERATION_WARNED_USER',
          resourceType: 'user',
          resourceId: userId.trim(),
          metadata: { reason: 'PII sharing warning issued by admin' } as Prisma.InputJsonValue,
        },
      });
    } catch {
      /* non-fatal */
    }

    return res.json({ success: true, message: 'Warning sent to user' });
  } catch (err: unknown) {
    console.error(err);
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
  }
});

/** POST /api/admin/chat/users/:userId/mute — Temporarily mute a user from sending chat messages (24h) */
router.post('/users/:userId/mute', async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    if (!userId?.trim()) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId.trim() } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Set chatMutedUntil to 24 hours from now
    const mutedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Since chatMutedUntil may not exist on the User model yet,
    // we store it in accountPreferences JSON field
    const prefs = (user.accountPreferences as Record<string, unknown>) || {};
    const updatedPrefs = { ...prefs, chatMutedUntil: mutedUntil.toISOString() };

    await prisma.user.update({
      where: { id: userId.trim() },
      data: { accountPreferences: updatedPrefs as Prisma.InputJsonValue },
    });

    // Create notification
    await prisma.notification.create({
      data: {
        userId: userId.trim(),
        title: 'Chat Temporarily Muted',
        message:
          'Your ability to send messages has been temporarily restricted for 24 hours due to repeated contact information sharing. This restriction will automatically expire.',
        type: 'system',
        link: '/settings',
      },
    });

    // Log audit trail
    try {
      await prisma.auditLog.create({
        data: {
          actorId: req.user!.userId,
          action: 'CHAT_MODERATION_MUTED_USER',
          resourceType: 'user',
          resourceId: userId.trim(),
          metadata: {
            mutedUntil: mutedUntil.toISOString(),
            reason: 'Repeated PII sharing — muted by admin',
          } as Prisma.InputJsonValue,
        },
      });
    } catch {
      /* non-fatal */
    }

    return res.json({
      success: true,
      message: 'User muted for 24 hours',
      mutedUntil: mutedUntil.toISOString(),
    });
  } catch (err: unknown) {
    console.error(err);
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
  }
});

/** GET /api/admin/chat/stats — Return moderation statistics */
router.get('/stats', async (req: AuthRequest, res: Response) => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [totalFlagged, flaggedToday, allFlaggedMessages] = await Promise.all([
      prisma.orderChatMessage.count({
        where: {
          moderationStatus: { in: ['flagged', 'masked', 'blocked'] },
        },
      }),
      prisma.orderChatMessage.count({
        where: {
          moderationStatus: { in: ['flagged', 'masked', 'blocked'] },
          createdAt: { gte: todayStart },
        },
      }),
      prisma.orderChatMessage.findMany({
        where: {
          moderationStatus: { in: ['flagged', 'masked', 'blocked'] },
        },
        select: {
          moderationReasons: true,
          senderId: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 1000,
      }),
    ]);

    // Compute most common PII type
    const reasonCounts: Record<string, number> = {};
    for (const msg of allFlaggedMessages) {
      const reasons = (msg.moderationReasons as string[]) || [];
      for (const r of reasons) {
        reasonCounts[r] = (reasonCounts[r] || 0) + 1;
      }
    }
    const mostCommonPiiType = Object.entries(reasonCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'N/A';

    // Compute top offenders
    const senderCounts: Record<string, number> = {};
    for (const msg of allFlaggedMessages) {
      senderCounts[msg.senderId] = (senderCounts[msg.senderId] || 0) + 1;
    }
    const topOffenderIds = Object.entries(senderCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([userId]) => userId);

    // Fetch display names for top offenders
    const offenders = topOffenderIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: topOffenderIds } },
          select: { id: true, displayName: true },
        })
      : [];

    const topOffenders = topOffenderIds.map((id) => {
      const user = offenders.find((o) => o.id === id);
      return {
        userId: id,
        displayName: user?.displayName ?? 'Unknown',
        count: senderCounts[id],
      };
    });

    return res.json({
      totalFlagged,
      flaggedToday,
      mostCommonPiiType,
      topOffenders,
      avgResponseTime: 'N/A', // Would require tracking review timestamps
    });
  } catch (err: unknown) {
    console.error(err);
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
  }
});

export default router;
