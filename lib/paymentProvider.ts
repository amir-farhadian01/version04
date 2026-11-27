import type Stripe from 'stripe';
import { capturePaymentIntent, createPaymentIntent, createPayoutToProvider, handleWebhookEvent, refundPayment } from './stripeService.js';
import { getStripe, getStripeWebhookSecret } from './stripe.js';

export type PaymentProviderName = 'stripe' | 'apple_pay' | 'google_pay';
export interface PaymentAvailability { provider: PaymentProviderName; enabled: boolean; mode: 'test' | 'disabled'; reasonUnavailable: string | null }
export interface PaymentOperationResult { success: boolean; providerReference: string | null; clientSecret?: string | null; error: string | null }
export interface PaymentProvider {
  readonly name: PaymentProviderName;
  availability(): PaymentAvailability;
  createSession(input: { orderId: string; amount: number; currency?: string; customerEmail?: string }): Promise<PaymentOperationResult>;
  confirm(input: { providerReference: string }): Promise<PaymentOperationResult>;
  refund(input: { providerReference: string; amount?: number; actorId: string; reason?: string }): Promise<PaymentOperationResult>;
  release(input: { providerReference: string; amount: number; currency?: string; destinationAccountId: string; orderId: string }): Promise<PaymentOperationResult>;
  webhook(input: { rawBody: Buffer; signature: string }): Promise<{ success: boolean; eventId: string | null; error: string | null }>;
}

function stripeAvailability(): PaymentAvailability {
  const appEnvironment = process.env.APP_ENV || process.env.NODE_ENV || 'development';
  const key = process.env.STRIPE_SECRET_KEY || '';
  if (appEnvironment !== 'staging') return { provider: 'stripe', enabled: false, mode: 'disabled', reasonUnavailable: 'Stripe is enabled only in staging for this release' };
  if (!key.startsWith('sk_test_')) return { provider: 'stripe', enabled: false, mode: 'disabled', reasonUnavailable: 'Stripe Test Mode credentials are not configured' };
  if (!process.env.STRIPE_WEBHOOK_SECRET) return { provider: 'stripe', enabled: false, mode: 'disabled', reasonUnavailable: 'Stripe webhook verification is not configured' };
  return { provider: 'stripe', enabled: true, mode: 'test', reasonUnavailable: null };
}

function assertAvailable(availability: PaymentAvailability): void {
  if (!availability.enabled) throw new Error(availability.reasonUnavailable || 'Payment provider unavailable');
}

export const stripePaymentProvider: PaymentProvider = {
  name: 'stripe', availability: stripeAvailability,
  async createSession(input) {
    assertAvailable(stripeAvailability());
    const result = await createPaymentIntent(input);
    return { success: result.success, providerReference: result.paymentIntentId, clientSecret: result.clientSecret, error: result.error };
  },
  async confirm({ providerReference }) {
    assertAvailable(stripeAvailability());
    const result = await capturePaymentIntent(providerReference);
    return { success: result.success, providerReference: result.paymentIntentId, clientSecret: result.clientSecret, error: result.error };
  },
  async refund(input) {
    assertAvailable(stripeAvailability());
    const result = await refundPayment({ paymentIntentId: input.providerReference, amount: input.amount, adminId: input.actorId, reason: input.reason });
    return { success: result.success, providerReference: result.refundId, error: result.error };
  },
  async release(input) {
    assertAvailable(stripeAvailability());
    const result = await createPayoutToProvider({ paymentIntentId: input.providerReference, amount: input.amount, currency: input.currency, stripeAccountId: input.destinationAccountId, orderId: input.orderId });
    return { success: result.success, providerReference: result.transferId, error: result.error };
  },
  async webhook(input) {
    assertAvailable(stripeAvailability());
    const stripe = getStripe();
    const secret = getStripeWebhookSecret();
    if (!stripe || !secret) return { success: false, eventId: null, error: 'Stripe webhook unavailable' };
    let event: Stripe.Event;
    try { event = stripe.webhooks.constructEvent(input.rawBody, input.signature, secret); }
    catch { return { success: false, eventId: null, error: 'Invalid webhook signature' }; }
    const result = await handleWebhookEvent(event);
    return { success: result.processed, eventId: event.id, error: result.error };
  },
};

function disabledProvider(name: 'apple_pay' | 'google_pay'): PaymentProvider {
  const availability = (): PaymentAvailability => ({ provider: name, enabled: false, mode: 'disabled', reasonUnavailable: 'Scaffolded for a future release; feature flag is off' });
  const blocked = async (): Promise<PaymentOperationResult> => ({ success: false, providerReference: null, error: availability().reasonUnavailable });
  return { name, availability, createSession: blocked, confirm: blocked, refund: blocked, release: blocked,
    webhook: async () => ({ success: false, eventId: null, error: availability().reasonUnavailable }) };
}

export const paymentProviders: Record<PaymentProviderName, PaymentProvider> = {
  stripe: stripePaymentProvider,
  apple_pay: disabledProvider('apple_pay'),
  google_pay: disabledProvider('google_pay'),
};

export function paymentCapabilities(): PaymentAvailability[] {
  return (Object.keys(paymentProviders) as PaymentProviderName[]).map((name) => paymentProviders[name].availability());
}
