import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import prisma from '../lib/db.js';
import { OrderPhase } from '@prisma/client';

const router = Router();

// In-memory store for guest wizard prefill (TTL-based, not for production)
// In production, use Redis with TTL
const prefills = new Map<string, { data: Record<string, unknown>; expiresAt: number }>();

// Clean expired prefills every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of prefills) {
    if (val.expiresAt <= now) prefills.delete(key);
  }
}, 5 * 60 * 1000);

// ─── Zod schema for wizard prefill ──────────────────────────────────────────
const wizardPrefillSchema = z.object({
  servicePackageId: z.string().uuid().optional(),
  serviceCatalogId: z.string().uuid().optional(),
  description: z.string().min(20).max(2000).optional(),
  scheduledAt: z.string().datetime().optional(),
  address: z.string().min(5).max(500).optional(),
  urgency: z.enum(['standard', 'urgent', 'emergency']).optional(),
  answers: z.record(z.string(), z.unknown()).optional(),
  photos: z.array(z.string()).optional(),
  bookingMode: z.enum(['booking', 'direct_booking', 'hybrid', 'quote_first', 'walk_in', 'inherit_from_catalog']).optional(),
  source: z.enum(['wizard', 'explorer', 'direct', 'reorder']).optional(),
});

// ─── Zod schema for guest checkout ───────────────────────────────────────────
const guestCheckoutSchema = z.object({
  servicePackageId: z.string().uuid(),
  description: z.string().min(20, 'description must be at least 20 characters').max(2000, 'description must be at most 2000 characters'),
  scheduledAt: z.string().datetime().optional(),
  contactName: z.string().min(2, 'name must be at least 2 characters').max(100),
  contactPhone: z.string().min(10, 'phone must be at least 10 characters').max(20),
  contactEmail: z.string().email('invalid email address'),
  address: z.string().min(5, 'address must be at least 5 characters').max(500),
  urgency: z.enum(['standard', 'urgent', 'emergency']).optional().default('standard'),
});

/**
 * POST /api/guest/checkout
 * Create an order without authentication.
 *
 * Flow:
 * 1. Validate guest input
 * 2. Find or create a guest user account (isGuest = true)
 * 3. Resolve the service catalog from the package
 * 4. Create the order with entryPoint = 'guest'
 * 5. Return the order with a guest token for tracking
 */
router.post('/checkout', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = guestCheckoutSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Validation failed',
        details: parsed.error.flatten(),
      });
      return;
    }

    const {
      servicePackageId,
      description,
      scheduledAt,
      contactName,
      contactPhone,
      contactEmail,
      address,
      urgency,
    } = parsed.data;

    // ── Find or create guest user ──────────────────────────────────────────
    let user = await prisma.user.findUnique({ where: { email: contactEmail } });

    if (!user) {
      const nameParts = contactName.trim().split(/\s+/);
      const firstName = nameParts[0] || contactName;
      const lastName = nameParts.slice(1).join(' ') || 'Guest';

      user = await prisma.user.create({
        data: {
          email: contactEmail,
          firstName,
          lastName,
          phone: contactPhone,
          role: 'customer',
          isGuest: true,
        },
      });
    }

    // ── Verify the service package exists and is active ────────────────────
    const pkg = await prisma.providerServicePackage.findUnique({
      where: { id: servicePackageId },
      include: { serviceCatalog: true },
    });

    if (!pkg || !pkg.isActive) {
      res.status(404).json({ error: 'Service package not found or inactive' });
      return;
    }

    // ── Create the order ───────────────────────────────────────────────────
    // Order model requires: serviceCatalogId, schemaSnapshot, answers, photos,
    // description, scheduleFlexibility, address
    const order = await prisma.order.create({
      data: {
        customerId: user.id,
        serviceCatalogId: pkg.serviceCatalogId,
        schemaSnapshot: pkg.serviceCatalog.dynamicFieldsSchema ?? {},
        answers: {},
        photos: [],
        description,
        scheduleFlexibility: 'asap',
        address,
        entryPoint: 'guest',
        urgency: urgency as any,
        status: 'submitted',
        phase: 'order',
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      },
    });

    // ── Generate a simple guest token ──────────────────────────────────────
    // In production, this should be a signed JWT. For now, a base64-encoded
    // userId:timestamp is sufficient for basic order tracking.
    const guestToken = Buffer.from(`${user.id}:${Date.now()}`).toString('base64');

    res.status(201).json({
      data: {
        order: {
          id: order.id,
          status: order.status,
          description: order.description,
          createdAt: order.createdAt,
        },
        guestToken,
        message: 'Order created. Sign up to track your order.',
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/guest/orders/:token
 * Track a guest order using the guest token.
 *
 * The token is a base64-encoded string containing `userId:timestamp`.
 */
router.get('/orders/:token', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.params;

    let decoded: string;
    try {
      decoded = Buffer.from(token, 'base64').toString('utf-8');
    } catch {
      res.status(400).json({ error: 'Invalid token format' });
      return;
    }

    const colonIdx = decoded.indexOf(':');
    if (colonIdx === -1) {
      res.status(400).json({ error: 'Invalid token' });
      return;
    }

    const userId = decoded.slice(0, colonIdx);
    if (!userId) {
      res.status(400).json({ error: 'Invalid token' });
      return;
    }

    const orders = await prisma.order.findMany({
      where: { customerId: userId },
      include: {
        matchedPackage: {
          select: { name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ data: orders });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/guest/wizard/prefill
 * Store wizard state before redirecting to login.
 *
 * The frontend calls this when a guest has filled the wizard
 * and clicks "Submit". The wizard data is stored with a token
 * that is passed as a query parameter in the redirect URL.
 *
 * Body: any wizard state (validated loosely)
 * Response: { data: { prefillToken: string, redirectUrl: string } }
 */
router.post('/wizard/prefill', (req: Request, res: Response) => {
  try {
    const parsed = wizardPrefillSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Validation failed',
        details: parsed.error.flatten(),
      });
      return;
    }

    const token = crypto.randomBytes(32).toString('hex');
    prefills.set(token, {
      data: parsed.data as Record<string, unknown>,
      expiresAt: Date.now() + 30 * 60 * 1000, // 30 min TTL
    });

    res.json({
      data: {
        prefillToken: token,
        redirectUrl: `/auth/login?returnTo=/orders/new?prefill=${token}`,
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to store wizard prefill' });
  }
});

/**
 * GET /api/guest/wizard/prefill/:token
 * Retrieve stored wizard state by prefill token.
 *
 * Called by the frontend after login to restore wizard state.
 * The token is deleted after retrieval (single-use).
 */
router.get('/wizard/prefill/:token', (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const entry = prefills.get(token);

    if (!entry || entry.expiresAt <= Date.now()) {
      prefills.delete(token);
      res.status(404).json({ error: 'Prefill token not found or expired' });
      return;
    }

    // Delete after retrieval (single-use)
    prefills.delete(token);

    res.json({ data: entry.data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve wizard prefill' });
  }
});

export default router;
