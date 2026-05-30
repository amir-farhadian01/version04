import Stripe from 'stripe';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

/**
 * Structured log helper for Stripe operations.
 * Uses console.error for warnings/errors (consistent with existing codebase convention).
 */
function stripeLog(level: 'info' | 'warn' | 'error', message: string): void {
  const ts = new Date().toISOString();
  console.error(`[${ts}] [stripe:${level}] ${message}`);
}

let stripeClient: Stripe | null = null;

/** Singleton Stripe client. Returns null if STRIPE_SECRET_KEY is not configured. */
export function getStripe(): Stripe | null {
  if (stripeClient) return stripeClient;

  if (!STRIPE_SECRET_KEY) {
    stripeLog('warn', 'STRIPE_SECRET_KEY not configured — Stripe operations will be no-ops');
    return null;
  }

  try {
    stripeClient = new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: '2026-05-27.dahlia',
      typescript: true,
      maxNetworkRetries: 2,
      timeout: 30_000,
    });
    stripeLog('info', 'Stripe client initialized');
    return stripeClient;
  } catch (error) {
    stripeLog('error', `Failed to initialize Stripe client: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return null;
  }
}

export function getStripeWebhookSecret(): string | null {
  return STRIPE_WEBHOOK_SECRET ?? null;
}

export const STRIPE_CONNECT_CLIENT_ID = process.env.STRIPE_CONNECT_CLIENT_ID ?? null;

/**
 * Check if Stripe is available (configured and client initialized).
 */
export function isStripeAvailable(): boolean {
  return getStripe() !== null;
}