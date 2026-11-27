import { Router, type Request, type Response } from 'express';
import { getStripe, getStripeWebhookSecret } from '../lib/stripe.js';
import { handleWebhookEvent } from '../lib/stripeService.js';
import type Stripe from 'stripe';
import prisma from '../lib/db.js';

const router = Router();

/**
 * POST /api/stripe/webhook
 * 
 * Stripe webhook endpoint. Must receive raw body for signature verification.
 * The webhook secret is read from STRIPE_WEBHOOK_SECRET env var.
 * 
 * Configured in server.ts with express.raw() middleware to preserve the raw body.
 */
router.post('/webhook', async (req: Request, res: Response) => {
  const stripe = getStripe();
  const webhookSecret = getStripeWebhookSecret();

  if (!stripe || !webhookSecret) {
    return res.status(500).json({
      code: 'STRIPE_NOT_CONFIGURED',
      message: 'Stripe webhook secret not configured on this server',
    });
  }

  const signature = req.headers['stripe-signature'] as string | undefined;
  if (!signature) {
    return res.status(400).json({
      code: 'MISSING_SIGNATURE',
      message: 'Missing stripe-signature header',
    });
  }

  let event: Stripe.Event;

  try {
    if (!Buffer.isBuffer(req.body)) {
      return res.status(400).json({
        code: 'INVALID_WEBHOOK_BODY',
        message: 'Stripe webhook requires an unmodified raw request body',
      });
    }
    event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(400).json({
      code: 'WEBHOOK_SIGNATURE_VERIFICATION_FAILED',
      message: `Webhook signature verification failed: ${message}`,
    });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${event.id}))`;
      const processed = await tx.auditLog.findFirst({
        where: { action: 'STRIPE_WEBHOOK_PROCESSED', resourceType: 'stripe_event', resourceId: event.id },
        select: { id: true },
      });
      if (processed) return { duplicate: true as const, result: null };

      const handled = await handleWebhookEvent(event);
      if (handled.action === 'ERROR') throw new Error(handled.error || 'Webhook processing failed');
      await tx.auditLog.create({
        data: {
          action: 'STRIPE_WEBHOOK_PROCESSED',
          resourceType: 'stripe_event',
          resourceId: event.id,
          metadata: { eventType: event.type, action: handled.action },
        },
      });
      return { duplicate: false as const, result: handled };
    });
    if (result.duplicate) return res.status(200).json({ received: true, duplicate: true });
    return res.status(200).json({ received: true, ...result.result });
  } catch {
    console.error(`[stripe webhook] Processing failed for event ${event.id}`);
    return res.status(503).json({
      code: 'WEBHOOK_PROCESSING_FAILED',
      message: 'Webhook processing failed; retry is required',
    });
  }
});

export default router;
