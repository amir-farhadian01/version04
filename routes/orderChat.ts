import { Router, Response } from 'express';
import { ChatMessageType, ChatModerationStatus, MatchAttemptStatus, OrderStatus, Prisma } from '@prisma/client';
import prisma from '../lib/db.js';
import { publish } from '../lib/bus.js';
import { authenticate, AuthRequest } from '../lib/auth.middleware.js';
import { moderateMessage } from '../lib/chatModeration.js';
import { translateText } from '../lib/chatTranslate.js';
import { assertWorkspaceMember, WorkspaceAccessError } from '../lib/workspaceAccess.js';
import { userHasActiveInboxAttemptForOrder } from '../lib/orderNegotiationAccess.js';

const router = Router({ mergeParams: true });

const MESSAGE_LIMIT_MAX = 100;
const OPEN_CHAT_STATUSES = new Set<OrderStatus>([
  OrderStatus.matching,
  OrderStatus.matched,
  OrderStatus.contracted,
  OrderStatus.paid,
  OrderStatus.in_progress,
  OrderStatus.completed,
]);

type RoleKind = 'customer' | 'provider' | 'admin' | 'invited_provider' | 'forbidden';

function parseLimit(raw: unknown, fallback: number): number {
  const n = typeof raw === 'string' ? Number.parseInt(raw, 10) : Number.NaN;
  if (Number.isNaN(n)) return fallback;
  return Math.max(1, Math.min(MESSAGE_LIMIT_MAX, n));
}

function parseText(body: unknown): string {
  const text = (body as Record<string, unknown>)?.text;
  return typeof text === 'string' ? text.trim() : '';
}

async function provisionalProviderIdForPreMatch(orderId: string): Promise<string | null> {
  const attempt = await prisma.offerMatchAttempt.findFirst({
    where: {
      offerId: orderId,
      status: {
        in: [
          MatchAttemptStatus.invited,
          MatchAttemptStatus.accepted,
          MatchAttemptStatus.matched,
        ],
      },
    },
    orderBy: { invitedAt: 'desc' },
    select: { providerId: true },
  });
  return attempt?.providerId ?? null;
}

async function resolveChatRole(
  order: {
    customerId: string;
    matchedProviderId: string | null;
    matchedWorkspaceId: string | null;
  },
  req: AuthRequest,
  opts: { preMatchInviteReader: boolean },
): Promise<RoleKind> {
  const uid = req.user?.userId;
  const role = req.user?.role;
  if (!uid || !role) return 'forbidden';
  if (['owner', 'platform_admin', 'support', 'finance'].includes(role)) return 'admin';
  if (uid === order.customerId) return 'customer';
  if (order.matchedProviderId && uid === order.matchedProviderId) return 'provider';
  if (order.matchedWorkspaceId) {
    try {
      await assertWorkspaceMember(uid, order.matchedWorkspaceId);
      return 'provider';
    } catch (e) {
      if (e instanceof WorkspaceAccessError) {
        // fall through
      } else {
        throw e;
      }
    }
  }
  if (opts.preMatchInviteReader) return 'invited_provider';
  return 'forbidden';
}

async function ensureThread(
  orderId: string,
  req: AuthRequest,
): Promise<
  | {
      thread: Awaited<ReturnType<typeof prisma.orderChatThread.upsert>>;
      order: {
        id: string;
        customerId: string;
        matchedProviderId: string | null;
        status: OrderStatus;
        matchedWorkspaceId: string | null;
        serviceCatalogId: string;
      };
      roleKind: RoleKind;
    }
  | { error: { status: number; body: Record<string, unknown> } }
> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      customerId: true,
      matchedProviderId: true,
      status: true,
      matchedWorkspaceId: true,
      serviceCatalogId: true,
    },
  });
  if (!order) return { error: { status: 404, body: { error: 'Order not found' } } as const };

  const uid = req.user!.userId;
  const preMatchReader = !order.matchedProviderId && (await userHasActiveInboxAttemptForOrder(uid, orderId));
  const threadProviderId = order.matchedProviderId ?? (await provisionalProviderIdForPreMatch(orderId));

  if (!threadProviderId) {
    return {
      error: {
        status: 400,
        body: {
          error: 'Chat opens once a provider is invited or matched on this order.',
          code: 'NO_MATCHED_PROVIDER',
        },
      },
    };
  }

  const roleKind = await resolveChatRole(order, req, { preMatchInviteReader: preMatchReader });
  if (roleKind === 'forbidden') {
    return { error: { status: 403, body: { error: 'Forbidden' } } };
  }

  const thread = await prisma.orderChatThread.upsert({
    where: { orderId },
    create: {
      orderId,
      customerId: order.customerId,
      providerId: threadProviderId,
    },
    update: {
      customerId: order.customerId,
      ...(order.matchedProviderId ? { providerId: order.matchedProviderId } : {}),
    },
  });
  return { thread, order, roleKind };
}

router.use(authenticate);

router.get('/thread', async (req: AuthRequest, res: Response) => {
  try {
    const orderId = req.params.orderId;
    if (!orderId) return res.status(400).json({ error: 'orderId is required' });
    const result = await ensureThread(orderId, req);
    if ('error' in result) return res.status(result.error.status).json(result.error.body);

    const messages = await prisma.orderChatMessage.findMany({
      where: { threadId: result.thread.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return res.json({
      thread: result.thread,
      messages: messages.reverse(),
      role: result.roleKind,
      readOnly: result.roleKind === 'invited_provider',
    });
  } catch (err: unknown) {
    console.error(err);
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
  }
});

router.get('/messages', async (req: AuthRequest, res: Response) => {
  try {
    const orderId = req.params.orderId;
    if (!orderId) return res.status(400).json({ error: 'orderId is required' });
    const result = await ensureThread(orderId, req);
    if ('error' in result) return res.status(result.error.status).json(result.error.body);

    const limit = parseLimit(req.query.limit, 50);
    const cursorId = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
    const cursorRow = cursorId
      ? await prisma.orderChatMessage.findUnique({ where: { id: cursorId }, select: { createdAt: true, threadId: true } })
      : null;
    if (cursorId && (!cursorRow || cursorRow.threadId !== result.thread.id)) {
      return res.status(400).json({ error: 'Invalid cursor' });
    }

    const rows = await prisma.orderChatMessage.findMany({
      where: {
        threadId: result.thread.id,
        ...(cursorRow ? { createdAt: { lt: cursorRow.createdAt } } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
    });
    const nextCursor = rows.length === limit ? rows[rows.length - 1]?.id ?? null : null;
    return res.json({ items: rows.reverse(), nextCursor });
  } catch (err: unknown) {
    console.error(err);
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
  }
});

router.post('/messages', async (req: AuthRequest, res: Response) => {
  try {
    const orderId = req.params.orderId;
    if (!orderId) return res.status(400).json({ error: 'orderId is required' });
    const result = await ensureThread(orderId, req);
    if ('error' in result) return res.status(result.error.status).json(result.error.body);

    if (result.roleKind === 'invited_provider') {
      return res.status(403).json({
        error: 'You can read this thread now; sending messages unlocks when your workspace is the matched provider.',
        code: 'CHAT_READ_ONLY_UNTIL_MATCHED',
      });
    }

    if (!OPEN_CHAT_STATUSES.has(result.order.status)) {
      return res.status(400).json({ error: 'Chat is not available for this order state' });
    }
    const text = parseText(req.body);
    if (!text) return res.status(400).json({ error: 'text is required' });
    if (result.thread.isClosed) {
      return res.status(400).json({ error: 'This chat thread is closed' });
    }

    const sourceLang =
      typeof (req.body as Record<string, unknown>)?.sourceLang === 'string'
        ? String((req.body as Record<string, unknown>).sourceLang).trim().toLowerCase()
        : undefined;
    const translateTo =
      typeof (req.body as Record<string, unknown>)?.translateTo === 'string'
        ? String((req.body as Record<string, unknown>).translateTo).trim().toLowerCase()
        : undefined;

    const moderation = moderateMessage(text);
    const maskedAttempts24h = await prisma.orderChatMessage.count({
      where: {
        threadId: result.thread.id,
        moderationStatus: ChatModerationStatus.masked,
        senderId: req.user!.userId,
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });
    if ((moderation.action === 'mask' && maskedAttempts24h >= 3) || moderation.action === 'block') {
      return res.status(400).json({
        error: 'Message blocked for safety. Please keep communication in-app without contact details.',
        reasons: [...moderation.reasons, 'repeated_contact_sharing'],
      });
    }

    const senderRole =
      result.roleKind === 'admin' ? 'admin' : result.roleKind === 'customer' ? 'customer' : 'provider';
    const messageType =
      result.roleKind === 'admin'
        ? ChatMessageType.system
        : ChatMessageType.text;
    const moderationStatus =
      moderation.action === 'allow'
        ? ChatModerationStatus.clean
        : moderation.action === 'mask'
          ? ChatModerationStatus.masked
          : moderation.action === 'flag'
            ? ChatModerationStatus.flagged
            : ChatModerationStatus.blocked;

    let translatedText: string | null = null;
    let detectedSourceLang: string | null = sourceLang ?? null;
    if (translateTo) {
      const tr = await translateText({ text: moderation.displayText, sourceLang, targetLang: translateTo });
      translatedText = tr.translatedText;
      detectedSourceLang = tr.detectedSourceLang;
    }

    const created = await prisma.orderChatMessage.create({
      data: {
        threadId: result.thread.id,
        senderId: req.user!.userId,
        senderRole,
        type: messageType,
        originalText: text,
        displayText: moderation.displayText,
        moderationStatus,
        moderationReasons: moderation.reasons.length ? (moderation.reasons as unknown as Prisma.InputJsonValue) : undefined,
        sourceLang: detectedSourceLang ?? undefined,
        targetLang: translateTo ?? undefined,
        translatedText: translatedText ?? undefined,
      },
    });
    await prisma.orderChatThread.update({
      where: { id: result.thread.id },
      data: { updatedAt: new Date() },
    });
    await publish('chat.message.created', {
      orderId,
      threadId: result.thread.id,
      messageId: created.id,
      senderId: created.senderId,
      senderRole: created.senderRole,
      moderationStatus: created.moderationStatus,
    });
    return res.status(201).json(created);
  } catch (err: unknown) {
    console.error(err);
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
  }
});

router.post('/messages/:id/translate', async (req: AuthRequest, res: Response) => {
  try {
    const orderId = req.params.orderId;
    const messageId = req.params.id;
    if (!orderId || !messageId) return res.status(400).json({ error: 'orderId and message id are required' });
    const result = await ensureThread(orderId, req);
    if ('error' in result) return res.status(result.error.status).json(result.error.body);

    if (result.roleKind === 'invited_provider') {
      return res.status(403).json({
        error: 'Translation is available after your workspace is the matched provider.',
        code: 'CHAT_READ_ONLY_UNTIL_MATCHED',
      });
    }

    const targetLang =
      typeof (req.body as Record<string, unknown>)?.targetLang === 'string'
        ? String((req.body as Record<string, unknown>).targetLang).trim().toLowerCase()
        : '';
    if (!targetLang) return res.status(400).json({ error: 'targetLang is required' });

    const msg = await prisma.orderChatMessage.findFirst({
      where: { id: messageId, threadId: result.thread.id },
    });
    if (!msg) return res.status(404).json({ error: 'Message not found' });

    if (msg.targetLang === targetLang && msg.translatedText) {
      return res.json({
        messageId: msg.id,
        translatedText: msg.translatedText,
        detectedSourceLang: msg.sourceLang ?? null,
        cached: true,
      });
    }

    const tr = await translateText({
      text: msg.displayText,
      sourceLang: msg.sourceLang ?? undefined,
      targetLang,
    });
    const updated = await prisma.orderChatMessage.update({
      where: { id: msg.id },
      data: {
        sourceLang: tr.detectedSourceLang ?? msg.sourceLang ?? undefined,
        targetLang,
        translatedText: tr.translatedText,
      },
      select: { id: true, translatedText: true, sourceLang: true },
    });
    return res.json({
      messageId: updated.id,
      translatedText: updated.translatedText ?? msg.displayText,
      detectedSourceLang: updated.sourceLang ?? null,
      cached: false,
    });
  } catch (err: unknown) {
    console.error(err);
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
  }
});

export default router;

