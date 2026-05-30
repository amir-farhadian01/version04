import Stripe from 'stripe';
import { getStripe, isStripeAvailable } from './stripe.js';
import prisma from './db.js';
import type { Payment, PaymentStatus } from '@prisma/client';
import type { Prisma } from '@prisma/client';

// ── Types ───────────────────────────────────────────────────────────────────

export interface StripePaymentResult {
  success: boolean;
  paymentIntentId: string | null;
  clientSecret: string | null;
  error: string | null;
}

export interface StripeRefundResult {
  success: boolean;
  refundId: string | null;
  error: string | null;
}

export interface StripePayoutResult {
  success: boolean;
  transferId: string | null;
  error: string | null;
}

export interface StripeConnectAccountResult {
  success: boolean;
  accountId: string | null;
  onboardingUrl: string | null;
  error: string | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * All monetary values in the codebase are cents (integers).
 * Stripe also uses smallest currency unit (cents for CAD).
 * No conversion needed — just ensure amount is always Int cents.
 */
function stripeLog(level: 'info' | 'warn' | 'error', message: string): void {
  const ts = new Date().toISOString();
  console.error(`[${ts}] [stripeService:${level}] ${message}`);
}

async function auditLogEntry(params: {
  actorId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  metadata: Record<string, unknown>;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: params.actorId,
        action: params.action,
        resourceType: params.resourceType,
        resourceId: params.resourceId,
        metadata: params.metadata as Prisma.InputJsonValue,
      },
    });
  } catch (error) {
    stripeLog('error', `Audit log creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// ── Payment Intent Operations ────────────────────────────────────────────────

/**
 * Create a Stripe PaymentIntent for an order after contract approval.
 * 
 * This is called from the payment session creation flow.
 * The internal Payment record is ALWAYS created first — Stripe is best-effort.
 * 
 * @param orderId - The Neighborly order ID (used as metadata)
 * @param amount - Amount in cents (integer)
 * @param currency - ISO currency code (default: 'cad')
 * @param customerId - Stripe customer ID (optional; creates metadata mapping)
 * @param description - Payment description for Stripe dashboard
 * @returns StripePaymentResult with paymentIntentId and clientSecret
 */
export async function createPaymentIntent(params: {
  orderId: string;
  amount: number;
  currency?: string;
  customerEmail?: string;
  description?: string;
}): Promise<StripePaymentResult> {
  const stripe = getStripe();
  if (!stripe) {
    stripeLog('warn', `Stripe not available — skipping payment intent creation for order ${params.orderId}`);
    return { success: false, paymentIntentId: null, clientSecret: null, error: 'Stripe not configured' };
  }

  const currency = (params.currency ?? 'cad').toLowerCase();
  const description = params.description ?? `Neighborly Order #${params.orderId}`;

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: params.amount,
      currency,
      description,
      metadata: {
        orderId: params.orderId,
        platform: 'neighborly',
      },
      ...(params.customerEmail ? { receipt_email: params.customerEmail } : {}),
      capture_method: 'manual', // Auth now, capture later (on order completion)
    });

    stripeLog('info', `PaymentIntent created: ${paymentIntent.id} for order ${params.orderId} (${params.amount} ${currency})`);

    return {
      success: true,
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret,
      error: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    stripeLog('error', `Failed to create PaymentIntent for order ${params.orderId}: ${message}`);
    return { success: false, paymentIntentId: null, clientSecret: null, error: message };
  }
}

/**
 * Capture a previously authorized PaymentIntent.
 * Called when the order transitions to `paid` status.
 */
export async function capturePaymentIntent(paymentIntentId: string): Promise<StripePaymentResult> {
  const stripe = getStripe();
  if (!stripe) {
    stripeLog('warn', `Stripe not available — skipping capture for PI ${paymentIntentId}`);
    return { success: false, paymentIntentId, clientSecret: null, error: 'Stripe not configured' };
  }

  try {
    const pi = await stripe.paymentIntents.capture(paymentIntentId);
    stripeLog('info', `PaymentIntent captured: ${pi.id} (status: ${pi.status})`);
    return {
      success: true,
      paymentIntentId: pi.id,
      clientSecret: pi.client_secret,
      error: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    stripeLog('error', `Failed to capture PaymentIntent ${paymentIntentId}: ${message}`);
    return { success: false, paymentIntentId, clientSecret: null, error: message };
  }
}

// ── Refund Operations ────────────────────────────────────────────────────────

/**
 * Refund a Stripe PaymentIntent.
 * Admin-initiated refund flow.
 * 
 * @param paymentIntentId - The Stripe PaymentIntent to refund
 * @param amount - Amount to refund in cents (null = full refund)
 * @param reason - Reason for refund (passed to Stripe)
 * @param adminId - Admin user ID for audit log
 * @returns StripeRefundResult
 */
export async function refundPayment(params: {
  paymentIntentId: string;
  amount?: number | null;
  reason?: string;
  adminId: string;
}): Promise<StripeRefundResult> {
  const stripe = getStripe();
  if (!stripe) {
    stripeLog('warn', `Stripe not available — refund for PI ${params.paymentIntentId} skipped`);
    return { success: false, refundId: null, error: 'Stripe not configured' };
  }

  try {
    const refund = await stripe.refunds.create({
      payment_intent: params.paymentIntentId,
      ...(params.amount ? { amount: params.amount } : {}),
      reason: 'requested_by_customer',
      metadata: {
        reason: params.reason ?? 'Admin-initiated refund',
        adminId: params.adminId,
      },
    });

    stripeLog('info', `Refund created: ${refund.id} for PI ${params.paymentIntentId} (amount: ${refund.amount})`);

    return {
      success: true,
      refundId: refund.id,
      error: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    stripeLog('error', `Failed to refund PI ${params.paymentIntentId}: ${message}`);
    return { success: false, refundId: null, error: message };
  }
}

// ── Payout / Transfer Operations ────────────────────────────────────────────

/**
 * Transfer funds to a provider's Stripe Connect account.
 * Called after escrow release (order completed + dispute window passed).
 * 
 * @param amount - Amount to transfer in cents (deduction = amount - commission)
 * @param currency - ISO currency code
 * @param stripeAccountId - The provider's Stripe Connect account ID
 * @param paymentIntentId - Source PaymentIntent for tracking
 * @param orderId - Neighborly order ID for metadata
 * @returns StripePayoutResult
 */
export async function createPayoutToProvider(params: {
  amount: number;
  currency?: string;
  stripeAccountId: string;
  paymentIntentId: string;
  orderId: string;
}): Promise<StripePayoutResult> {
  const stripe = getStripe();
  if (!stripe) {
    stripeLog('warn', `Stripe not available — payout to ${params.stripeAccountId} for order ${params.orderId} skipped`);
    return { success: false, transferId: null, error: 'Stripe not configured' };
  }

  const currency = (params.currency ?? 'cad').toLowerCase();

  try {
    const transfer = await stripe.transfers.create({
      amount: params.amount,
      currency,
      destination: params.stripeAccountId,
      source_transaction: undefined,
      description: `Neighborly payout for order #${params.orderId}`,
      metadata: {
        orderId: params.orderId,
        paymentIntentId: params.paymentIntentId,
        platform: 'neighborly',
      },
    });

    stripeLog('info', `Transfer created: ${transfer.id} to account ${params.stripeAccountId} (${params.amount} ${currency})`);

    return {
      success: true,
      transferId: transfer.id,
      error: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    stripeLog('error', `Failed to create transfer to ${params.stripeAccountId} for order ${params.orderId}: ${message}`);
    return { success: false, transferId: null, error: message };
  }
}

// ── Stripe Connect Onboarding ───────────────────────────────────────────────

/**
 * Create a Stripe Connect Express account for provider onboarding.
 * Returns the account ID and an onboarding link.
 */
export async function createConnectAccount(params: {
  email: string;
  companyName: string;
  country?: string;
  workspaceId: string;
}): Promise<StripeConnectAccountResult> {
  const stripe = getStripe();
  if (!stripe) {
    return { success: false, accountId: null, onboardingUrl: null, error: 'Stripe not configured' };
  }

  try {
    const account = await stripe.accounts.create({
      type: 'express',
      country: params.country ?? 'CA',
      email: params.email,
      business_type: 'company',
      company: {
        name: params.companyName,
      },
      capabilities: {
        transfers: { requested: true },
        card_payments: { requested: true },
      },
      metadata: {
        workspaceId: params.workspaceId,
        platform: 'neighborly',
      },
    });

    stripeLog('info', `Connect account created: ${account.id} for workspace ${params.workspaceId}`);

    // Update the workspace with the Stripe account ID
    await prisma.company.update({
      where: { id: params.workspaceId },
      data: {
        stripeAccountId: account.id,
        stripeEnabled: true,
      },
    });

    return {
      success: true,
      accountId: account.id,
      onboardingUrl: null, // Onboarding link must be created separately via Account Link API
      error: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    stripeLog('error', `Failed to create Connect account for ${params.workspaceId}: ${message}`);
    return { success: false, accountId: null, onboardingUrl: null, error: message };
  }
}

/**
 * Create an Account Link for Stripe Connect Express onboarding.
 * Returns a URL the provider can use to complete onboarding.
 */
export async function createConnectAccountLink(params: {
  stripeAccountId: string;
  refreshUrl: string;
  returnUrl: string;
}): Promise<{ success: boolean; url: string | null; error: string | null }> {
  const stripe = getStripe();
  if (!stripe) {
    return { success: false, url: null, error: 'Stripe not configured' };
  }

  try {
    const accountLink = await stripe.accountLinks.create({
      account: params.stripeAccountId,
      refresh_url: params.refreshUrl,
      return_url: params.returnUrl,
      type: 'account_onboarding',
    });

    return { success: true, url: accountLink.url, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    stripeLog('error', `Failed to create account link for ${params.stripeAccountId}: ${message}`);
    return { success: false, url: null, error: message };
  }
}

// ── Webhook Event Processing ─────────────────────────────────────────────────

export type WebhookEventType =
  | 'payment_intent.succeeded'
  | 'payment_intent.payment_failed'
  | 'payment_intent.canceled'
  | 'charge.refunded'
  | 'account.updated';

export interface WebhookProcessingResult {
  processed: boolean;
  eventType: string;
  orderId: string | null;
  action: string;
  error: string | null;
}

/**
 * Process a verified Stripe webhook event.
 * Updates internal Payment records based on Stripe events.
 */
export async function handleWebhookEvent(
  event: Stripe.Event,
): Promise<WebhookProcessingResult> {
  const eventType = event.type;
  stripeLog('info', `Processing webhook event: ${eventType} (${event.id})`);

  try {
    switch (eventType) {
      case 'payment_intent.succeeded': {
        const pi = event.data.object as Stripe.PaymentIntent;
        const orderId = pi.metadata.orderId;
        if (!orderId) {
          return { processed: false, eventType, orderId: null, action: 'SKIPPED', error: 'No orderId in metadata' };
        }

        // Update the Payment record with PI ID if not already set
        const payment = await prisma.payment.findUnique({ where: { orderId } });
        if (payment && !payment.stripePaymentIntentId) {
          await prisma.payment.update({
            where: { orderId },
            data: { stripePaymentIntentId: pi.id },
          });
        }

        stripeLog('info', `Webhook: payment_intent.succeeded for order ${orderId}`);
        return { processed: true, eventType, orderId, action: 'PAYMENT_SUCCEEDED', error: null };
      }

      case 'payment_intent.payment_failed': {
        const pi = event.data.object as Stripe.PaymentIntent;
        const orderId = pi.metadata.orderId;
        if (!orderId) {
          return { processed: false, eventType, orderId: null, action: 'SKIPPED', error: 'No orderId in metadata' };
        }

        // Mark payment as failed
        await prisma.payment.updateMany({
          where: { orderId, status: 'pending' as PaymentStatus },
          data: { status: 'failed' as PaymentStatus },
        });

        stripeLog('info', `Webhook: payment_intent.payment_failed for order ${orderId}`);
        return { processed: true, eventType, orderId, action: 'PAYMENT_FAILED', error: null };
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        const piId = charge.payment_intent as string | null;
        if (!piId) {
          return { processed: false, eventType, orderId: null, action: 'SKIPPED', error: 'No payment_intent on charge' };
        }

        // Find the payment record by PI ID and update status
        const payment = await prisma.payment.findFirst({
          where: { stripePaymentIntentId: piId },
        });
        if (payment) {
          await prisma.payment.update({
            where: { id: payment.id },
            data: { status: 'refunded' as PaymentStatus },
          });
        }

        stripeLog('info', `Webhook: charge.refunded for PI ${piId}`);
        return { processed: true, eventType, orderId: payment?.orderId ?? null, action: 'REFUNDED', error: null };
      }

      case 'account.updated': {
        const account = event.data.object as Stripe.Account;
        const workspaceId = account.metadata?.workspaceId;
        if (!workspaceId) {
          return { processed: false, eventType, orderId: null, action: 'SKIPPED', error: 'No workspaceId in metadata' };
        }

        await prisma.company.update({
          where: { id: workspaceId },
          data: {
            stripeChargesEnabled: account.charges_enabled,
            stripePayoutsEnabled: account.payouts_enabled,
          },
        });

        stripeLog('info', `Webhook: account.updated for workspace ${workspaceId}`);
        return { processed: true, eventType, orderId: null, action: 'ACCOUNT_UPDATED', error: null };
      }

      default:
        return { processed: false, eventType, orderId: null, action: 'IGNORED', error: `Unhandled event type: ${eventType}` };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    stripeLog('error', `Webhook processing failed for ${eventType}: ${message}`);
    return { processed: false, eventType, orderId: null, action: 'ERROR', error: message };
  }
}

// ── Integration helpers ──────────────────────────────────────────────────────

/**
 * Full payment flow: create PaymentIntent + store PI ID on Payment record.
 * Non-fatal: Payment record is created even if Stripe call fails.
 */
export async function initiatePaymentForOrder(params: {
  orderId: string;
  amount: number;
  currency?: string;
  customerEmail?: string;
}): Promise<{ payment: Payment; stripeResult: StripePaymentResult }> {
  // Create the internal Payment record first
  const payment = await prisma.payment.upsert({
    where: { orderId: params.orderId },
    create: {
      orderId: params.orderId,
      amount: params.amount,
      commission: Math.round(params.amount * 0.15),
      deduction: Math.round(params.amount * 0.85),
      status: 'pending' as PaymentStatus,
    },
    update: {
      amount: params.amount,
      commission: Math.round(params.amount * 0.15),
      deduction: Math.round(params.amount * 0.85),
    },
  });

  // Best-effort: create Stripe PaymentIntent
  const stripeResult = await createPaymentIntent({
    orderId: params.orderId,
    amount: params.amount,
    currency: params.currency,
    customerEmail: params.customerEmail,
  });

  // Store the PI ID on the payment record if successful
  if (stripeResult.success && stripeResult.paymentIntentId) {
    await prisma.payment.update({
      where: { orderId: params.orderId },
      data: { stripePaymentIntentId: stripeResult.paymentIntentId },
    }).catch(() => {
      stripeLog('warn', `Failed to store PaymentIntent ID on payment for order ${params.orderId}`);
    });
  }

  return { payment, stripeResult };
}

/**
 * Capture payment for an order (called on transition to `paid`).
 * Non-fatal: internal payment status is updated even if Stripe capture fails.
 */
export async function capturePaymentForOrder(orderId: string): Promise<{ success: boolean; error: string | null }> {
  const payment = await prisma.payment.findUnique({ where: { orderId } });
  if (!payment) {
    return { success: false, error: 'No payment record found' };
  }

  // Update internal status first
  await prisma.payment.update({
    where: { orderId },
    data: { status: 'captured' as PaymentStatus },
  });

  // Best-effort: capture on Stripe
  if (payment.stripePaymentIntentId) {
    const result = await capturePaymentIntent(payment.stripePaymentIntentId);
    if (!result.success) {
      stripeLog('warn', `Stripe capture failed for order ${orderId}, but internal status updated`);
    }
  }

  return { success: true, error: null };
}

/**
 * Refund payment for an order (admin-initiated).
 * Updates internal status and attempts Stripe refund.
 */
export async function refundPaymentForOrder(params: {
  orderId: string;
  adminId: string;
  reason?: string;
  amount?: number | null;
}): Promise<{ payment: Payment; refundResult: StripeRefundResult }> {
  const payment = await prisma.payment.findUnique({ where: { orderId: params.orderId } });
  if (!payment) {
    throw new Error('No payment record found');
  }

  if (payment.status !== 'captured') {
    throw new Error('Only captured payments can be refunded');
  }

  // Update internal status
  const updated = await prisma.payment.update({
    where: { orderId: params.orderId },
    data: { status: 'refunded' as PaymentStatus },
  });

  // Audit log
  await auditLogEntry({
    actorId: params.adminId,
    action: 'PAYMENT_REFUNDED',
    resourceType: 'payment',
    resourceId: payment.id,
    metadata: {
      orderId: params.orderId,
      reason: params.reason ?? 'Admin refund',
      amount: params.amount ?? payment.amount,
    },
  });

  // Best-effort: Stripe refund
  let refundResult: StripeRefundResult = { success: false, refundId: null, error: 'Stripe not configured' };
  if (payment.stripePaymentIntentId) {
    refundResult = await refundPayment({
      paymentIntentId: payment.stripePaymentIntentId,
      amount: params.amount,
      reason: params.reason,
      adminId: params.adminId,
    });
  }

  return { payment: updated as Payment, refundResult };
}