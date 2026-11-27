import { afterEach, describe, expect, it } from 'vitest';
import { paymentCapabilities, paymentProviders } from './paymentProvider.js';

describe('payment provider capabilities', () => {
  const original = { APP_ENV: process.env.APP_ENV, STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET };
  afterEach(() => Object.assign(process.env, original));

  it('keeps wallet adapters disabled and incapable of financial operations', async () => {
    for (const name of ['apple_pay', 'google_pay'] as const) {
      expect(paymentProviders[name].availability().enabled).toBe(false);
      expect((await paymentProviders[name].createSession({ orderId: 'o1', amount: 100 })).success).toBe(false);
    }
  });

  it('enables Stripe only with staging test credentials and webhook verification', () => {
    process.env.APP_ENV = 'staging'; process.env.STRIPE_SECRET_KEY = 'sk_test_example'; process.env.STRIPE_WEBHOOK_SECRET = 'whsec_example';
    expect(paymentCapabilities().find((p) => p.provider === 'stripe')).toMatchObject({ enabled: true, mode: 'test' });
    process.env.STRIPE_SECRET_KEY = 'sk_live_forbidden';
    expect(paymentProviders.stripe.availability().enabled).toBe(false);
  });
});
