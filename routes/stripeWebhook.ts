import { Router, type Request, type Response } from 'express';
import { getStripe, getStripeWebhookSecret } from '../lib/stripe.js';
import { handleWebhookEvent } from '../lib/stripeService.js';
import type Stripe from 'stripe';

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
    // The raw body must be available — server.ts uses express.raw() for this route
    const rawBody = req.body instanceof Buffer ? req.body : Buffer.from(JSON.stringify(req.body));
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(400).json({
      code: 'WEBHOOK_SIGNATURE_VERIFICATION_FAILED',
      message: `Webhook signature verification failed: ${message}`,
    });
  }

  // Process the event asynchronously — return 200 immediately to Stripe
  const result = await handleWebhookEvent(event);

  if (result.error) {
    console.error(`[stripe webhook] Processing error for ${result.eventType}: ${result.error}`);
  }

  return res.status(200).json({ received: true, ...result });
});

export default router;