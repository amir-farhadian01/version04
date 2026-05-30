import { Router, Response } from 'express';
import prisma from '../lib/db.js';
import { authenticate, AuthRequest } from '../lib/auth.middleware.js';
import { moderateMessage, getBlockedReasonMessage, getSuggestion } from '../lib/chatModeration.js';

const router = Router();

// GET /api/chat/rooms
router.get('/rooms', authenticate, async (req: AuthRequest, res: Response) => {
  const { categoryId } = req.query as any;
  try {
    const where: any = {};
    if (categoryId) where.categoryId = categoryId;
    const rooms = await prisma.chatRoom.findMany({
      where,
      include: { category: { select: { id: true, name: true } } },
      orderBy: { lastMessageAt: 'desc' },
    });
    res.json(rooms);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/chat/rooms/:id/messages
router.get('/rooms/:id/messages', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const messages = await prisma.chatMessage.findMany({
      where: { roomId: req.params.id },
      include: { sender: { select: { id: true, displayName: true, avatarUrl: true, role: true } } },
      orderBy: { timestamp: 'asc' },
      take: 100,
    });
    res.json(messages);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/chat/rooms/:id/messages
router.post('/rooms/:id/messages', authenticate, async (req: AuthRequest, res: Response) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'Missing text' });

  try {
    // Apply moderation
    const moderation = moderateMessage(text);

    // Check for repeated masked attempts in 24h
    if (moderation.action === 'mask' || moderation.action === 'block') {
      const maskedCount24h = await prisma.chatMessage.count({
        where: {
          roomId: req.params.id,
          senderId: req.user!.userId,
          timestamp: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          // We use a simple heuristic: count messages that were moderated
          // Since ChatMessage doesn't have moderationStatus yet, we check via text pattern
        },
      });

      // If blocked or repeated masking, return structured error
      if (moderation.action === 'block' || maskedCount24h >= 3) {
        return res.status(400).json({
          error: 'Message blocked for safety. Please keep communication in-app without contact details.',
          code: 'MESSAGE_BLOCKED',
          reasons: moderation.reasons,
          warningText: getBlockedReasonMessage(moderation.reasons),
          suggestion: getSuggestion(moderation.reasons),
        });
      }
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { displayName: true, role: true },
    });

    const message = await prisma.chatMessage.create({
      data: {
        roomId: req.params.id,
        senderId: req.user!.userId,
        senderName: user?.displayName,
        senderRole: user?.role,
        text: moderation.displayText, // Store masked text
      },
      include: { sender: { select: { id: true, displayName: true, avatarUrl: true, role: true } } },
    });

    await prisma.chatRoom.update({
      where: { id: req.params.id },
      data: { lastMessage: moderation.displayText, lastMessageAt: new Date() },
    });

    res.status(201).json({
      ...message,
      moderationStatus: moderation.action,
      moderationReasons: moderation.reasons,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Provider Messages (Customer ↔ Provider) ─────────────────────────────────

// GET /api/chat/provider-messages - Get all provider conversations for current user
router.get('/provider-messages', authenticate, async (req: AuthRequest, res: Response) => {
  const { userId, role } = req.user!;
  try {
    // Find all requests where this user is customer
    const requests = await prisma.request.findMany({
      where: { customerId: userId },
      include: {
        provider: { select: { id: true, displayName: true, avatarUrl: true } },
        service: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Get unique providers with last message info
    const providerMap = new Map();
    for (const request of requests) {
      if (!providerMap.has(request.providerId)) {
        providerMap.set(request.providerId, {
          providerId: request.providerId,
          provider: request.provider,
          service: request.service,
          lastMessage: request.details || 'Service request created',
          timestamp: request.createdAt,
          read: request.status !== 'pending',
        });
      }
    }

    res.json(Array.from(providerMap.values()));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/chat/provider/:providerId - Get chat history with specific provider
router.get('/provider/:providerId', authenticate, async (req: AuthRequest, res: Response) => {
  const { userId } = req.user!;
  const { providerId } = req.params;

  try {
    // Verify they have an existing relationship (request or message)
    const hasRelationship = await prisma.request.findFirst({
      where: {
        OR: [
          { customerId: userId, providerId },
          { customerId: providerId, providerId: userId },
        ],
      },
    });

    if (!hasRelationship) {
      return res.status(403).json({
        error: 'You can only message providers after requesting their services or when they contact you first.',
      });
    }

    // Get ticket messages between these users (used for provider-customer chat)
    const messages = await prisma.ticket.findMany({
      where: {
        OR: [
          { creatorId: userId, recipientId: providerId },
          { creatorId: providerId, recipientId: userId },
        ],
        type: 'client_to_provider',
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // Format messages
    const formattedMessages = messages.flatMap((ticket: any) => {
      const msgs = (ticket.messages as any[]) || [];
      return msgs.map((m: any) => ({
        id: `${ticket.id}-${m.timestamp}`,
        ticketId: ticket.id,
        text: m.text,
        senderId: m.senderId,
        senderName: m.senderName,
        timestamp: m.timestamp,
        moderationStatus: m.moderationStatus || 'clean',
        moderationReasons: m.moderationReasons || [],
      }));
    }).sort((a: any, b: any) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    res.json(formattedMessages);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/chat/provider/:providerId - Send message to provider (AI monitored)
router.post('/provider/:providerId', authenticate, async (req: AuthRequest, res: Response) => {
  const { userId } = req.user!;
  const { providerId } = req.params;
  const { message } = req.body;

  if (!message || message.trim().length === 0) {
    return res.status(400).json({ error: 'Message is required' });
  }

  try {
    // Apply enhanced moderation
    const moderation = moderateMessage(message);

    // Check for repeated masked attempts in 24h
    if (moderation.action === 'mask' || moderation.action === 'block') {
      // Count recent messages from this user to this provider that were moderated
      const recentTickets = await prisma.ticket.findMany({
        where: {
          OR: [
            { creatorId: userId, recipientId: providerId },
            { creatorId: providerId, recipientId: userId },
          ],
          type: 'client_to_provider',
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
        select: { messages: true },
      });

      // Count messages that were previously moderated
      let moderatedCount = 0;
      for (const ticket of recentTickets) {
        const msgs = (ticket.messages as any[]) || [];
        for (const m of msgs) {
          if (m.moderationStatus && m.moderationStatus !== 'allow' && m.moderationStatus !== 'clean') {
            moderatedCount++;
          }
        }
      }

      if (moderation.action === 'block' || moderatedCount >= 3) {
        return res.status(400).json({
          error: 'Message blocked for safety. Please keep communication in-app without contact details.',
          code: 'MESSAGE_BLOCKED',
          reasons: moderation.reasons,
          warningText: getBlockedReasonMessage(moderation.reasons),
          suggestion: getSuggestion(moderation.reasons),
        });
      }
    }

    // Verify they have an existing relationship
    const hasRelationship = await prisma.request.findFirst({
      where: {
        OR: [
          { customerId: userId, providerId },
          { customerId: providerId, providerId: userId },
        ],
      },
    });

    if (!hasRelationship) {
      return res.status(403).json({
        error: 'You can only message providers after requesting their services or when they contact you first.',
      });
    }

    // Get user info
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { displayName: true },
    });

    // Find or create ticket for this conversation
    let ticket = await prisma.ticket.findFirst({
      where: {
        OR: [
          { creatorId: userId, recipientId: providerId },
          { creatorId: providerId, recipientId: userId },
        ],
        type: 'client_to_provider',
      },
    });

    if (!ticket) {
      ticket = await prisma.ticket.create({
        data: {
          creatorId: userId,
          recipientId: providerId,
          subject: 'Provider Communication',
          type: 'client_to_provider',
          status: 'open',
          messages: [],
        },
      });
    }

    // Add message to ticket with moderation info
    const messages = (ticket.messages as any[]) || [];
    messages.push({
      text: moderation.displayText, // Store masked text
      originalText: message, // Store original for admin review
      senderId: userId,
      senderName: user?.displayName || 'Customer',
      timestamp: new Date().toISOString(),
      moderationStatus: moderation.action,
      moderationReasons: moderation.reasons,
    });

    const updated = await prisma.ticket.update({
      where: { id: ticket.id },
      data: { messages, status: 'open' },
    });

    // Create notification for provider
    await prisma.notification.create({
      data: {
        userId: providerId,
        title: 'New Message from Customer',
        message: `${user?.displayName || 'A customer'} sent you a message`,
        type: 'request',
        link: `/chat/provider/${userId}`,
      },
    });

    res.status(201).json({
      success: true,
      ticket: updated,
      moderationStatus: moderation.action,
      moderationReasons: moderation.reasons,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
