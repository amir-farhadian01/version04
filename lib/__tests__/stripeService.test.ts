import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  type StripePaymentResult,
  type StripeRefundResult,
  type StripePayoutResult,
  type WebhookProcessingResult,
} from '../stripeService.js';

// ── Mock Prisma ──────────────────────────────────────────────────────────────
const mockPrisma = {
  payment: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
    updateMany: vi.fn(),
  },
  company: {
    update: vi.fn(),
  },
  auditLog: {
    create: vi.fn(),
  },
};

vi.mock('../db.js', () => ({
  default: mockPrisma,
}));

// ── Mock Stripe ──────────────────────────────────────────────────────────────
const mockStripeClient = {
  paymentIntents: {
    create: vi.fn(),
    capture: vi.fn(),
  },
  refunds: {
    create: vi.fn(),
  },
  transfers: {
    create: vi.fn(),
  },
  accounts: {
    create: vi.fn(),
  },
  accountLinks: {
    create: vi.fn(),
  },
  webhooks: {
    constructEvent: vi.fn(),
  },
};

vi.mock('../stripe.js', () => ({
  getStripe: vi.fn(),
  getStripeWebhookSecret: vi.fn(),
  isStripeAvailable: vi.fn(),
  STRIPE_CONNECT_CLIENT_ID: 'ca_test_123',
}));

import { getStripe, isStripeAvailable } from '../stripe.js';

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Stripe Service — Payment Intent Operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('when Stripe is NOT configured', () => {
    beforeEach(() => {
      (getStripe as ReturnType<typeof vi.fn>).mockReturnValue(null);
      (isStripeAvailable as ReturnType<typeof vi.fn>).mockReturnValue(false);
    });

    it('createPaymentIntent returns error when Stripe is not available', async () => {
      const { createPaymentIntent } = await import('../stripeService.js');
      const result = await createPaymentIntent({
        orderId: 'order-1',
        amount: 5000,
      });

      expect(result.success).toBe(false);
      expect(result.paymentIntentId).toBeNull();
      expect(result.clientSecret).toBeNull();
      expect(result.error).toBe('Stripe not configured');
    });

    it('capturePaymentIntent returns error when Stripe is not available', async () => {
      const { capturePaymentIntent } = await import('../stripeService.js');
      const result = await capturePaymentIntent('pi_123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Stripe not configured');
    });

    it('refundPayment returns error when Stripe is not available', async () => {
      const { refundPayment } = await import('../stripeService.js');
      const result = await refundPayment({
        paymentIntentId: 'pi_123',
        adminId: 'admin-1',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Stripe not configured');
    });

    it('createPayoutToProvider returns error when Stripe is not available', async () => {
      const { createPayoutToProvider } = await import('../stripeService.js');
      const result = await createPayoutToProvider({
        amount: 5000,
        stripeAccountId: 'acct_123',
        paymentIntentId: 'pi_123',
        orderId: 'order-1',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Stripe not configured');
    });

    it('createConnectAccount returns error when Stripe is not available', async () => {
      const { createConnectAccount } = await import('../stripeService.js');
      const result = await createConnectAccount({
        email: 'test@example.com',
        companyName: 'Test Co',
        workspaceId: 'ws-1',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Stripe not configured');
    });
  });

  describe('when Stripe IS configured', () => {
    beforeEach(() => {
      (getStripe as ReturnType<typeof vi.fn>).mockReturnValue(mockStripeClient);
      (isStripeAvailable as ReturnType<typeof vi.fn>).mockReturnValue(true);
    });

    it('createPaymentIntent creates a PaymentIntent with correct amount and currency', async () => {
      mockStripeClient.paymentIntents.create.mockResolvedValueOnce({
        id: 'pi_test_123',
        client_secret: 'pi_secret_123',
        status: 'requires_capture',
      });

      const { createPaymentIntent } = await import('../stripeService.js');
      const result = await createPaymentIntent({
        orderId: 'order-1',
        amount: 5000,
        currency: 'cad',
        customerEmail: 'customer@example.com',
      });

      expect(result.success).toBe(true);
      expect(result.paymentIntentId).toBe('pi_test_123');
      expect(result.clientSecret).toBe('pi_secret_123');
      expect(result.error).toBeNull();

      expect(mockStripeClient.paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 5000,
          currency: 'cad',
          capture_method: 'manual',
          metadata: { orderId: 'order-1', platform: 'neighborly' },
          receipt_email: 'customer@example.com',
        }),
      );
    });

    it('createPaymentIntent handles Stripe API errors gracefully', async () => {
      mockStripeClient.paymentIntents.create.mockRejectedValueOnce(
        new Error('Stripe API error: invalid amount'),
      );

      const { createPaymentIntent } = await import('../stripeService.js');
      const result = await createPaymentIntent({
        orderId: 'order-1',
        amount: 0, // Invalid amount
      });

      expect(result.success).toBe(false);
      expect(result.paymentIntentId).toBeNull();
      expect(result.error).toContain('Stripe API error');
    });

    it('capturePaymentIntent captures authorized PI', async () => {
      mockStripeClient.paymentIntents.capture.mockResolvedValueOnce({
        id: 'pi_test_123',
        client_secret: 'pi_secret_123',
        status: 'succeeded',
      });

      const { capturePaymentIntent } = await import('../stripeService.js');
      const result = await capturePaymentIntent('pi_test_123');

      expect(result.success).toBe(true);
      expect(result.paymentIntentId).toBe('pi_test_123');
      expect(mockStripeClient.paymentIntents.capture).toHaveBeenCalledWith('pi_test_123');
    });

    it('refundPayment creates a full refund when no amount specified', async () => {
      mockStripeClient.refunds.create.mockResolvedValueOnce({
        id: 're_123',
        amount: 5000,
        status: 'succeeded',
      });

      const { refundPayment } = await import('../stripeService.js');
      const result = await refundPayment({
        paymentIntentId: 'pi_123',
        adminId: 'admin-1',
        reason: 'Customer requested',
      });

      expect(result.success).toBe(true);
      expect(result.refundId).toBe('re_123');
      expect(mockStripeClient.refunds.create).toHaveBeenCalledWith(
        expect.objectContaining({
          payment_intent: 'pi_123',
          reason: 'requested_by_customer',
          metadata: expect.objectContaining({
            reason: 'Customer requested',
            adminId: 'admin-1',
          }),
        }),
      );
    });

    it('refundPayment creates a partial refund when amount is specified', async () => {
      mockStripeClient.refunds.create.mockResolvedValueOnce({
        id: 're_456',
        amount: 2000,
        status: 'succeeded',
      });

      const { refundPayment } = await import('../stripeService.js');
      const result = await refundPayment({
        paymentIntentId: 'pi_123',
        amount: 2000,
        adminId: 'admin-1',
      });

      expect(result.success).toBe(true);
      expect(result.refundId).toBe('re_456');
      expect(mockStripeClient.refunds.create).toHaveBeenCalledWith(
        expect.objectContaining({
          payment_intent: 'pi_123',
          amount: 2000,
        }),
      );
    });

    it('createPayoutToProvider transfers funds to Connect account', async () => {
      mockStripeClient.transfers.create.mockResolvedValueOnce({
        id: 'tr_123',
        amount: 4250,
        currency: 'cad',
      });

      const { createPayoutToProvider } = await import('../stripeService.js');
      const result = await createPayoutToProvider({
        amount: 4250,
        currency: 'cad',
        stripeAccountId: 'acct_123',
        paymentIntentId: 'pi_123',
        orderId: 'order-1',
      });

      expect(result.success).toBe(true);
      expect(result.transferId).toBe('tr_123');
      expect(mockStripeClient.transfers.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 4250,
          currency: 'cad',
          destination: 'acct_123',
          metadata: expect.objectContaining({
            orderId: 'order-1',
            paymentIntentId: 'pi_123',
          }),
        }),
      );
    });

    it('createConnectAccount creates Express account and updates workspace', async () => {
      mockStripeClient.accounts.create.mockResolvedValueOnce({
        id: 'acct_test_456',
        charges_enabled: false,
        payouts_enabled: false,
      });
      mockPrisma.company.update.mockResolvedValueOnce({});

      const { createConnectAccount } = await import('../stripeService.js');
      const result = await createConnectAccount({
        email: 'provider@example.com',
        companyName: 'Best Services Inc.',
        workspaceId: 'ws-1',
      });

      expect(result.success).toBe(true);
      expect(result.accountId).toBe('acct_test_456');
      expect(mockStripeClient.accounts.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'express',
          email: 'provider@example.com',
          company: expect.objectContaining({ name: 'Best Services Inc.' }),
          metadata: { workspaceId: 'ws-1', platform: 'neighborly' },
        }),
      );
      expect(mockPrisma.company.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ws-1' },
          data: expect.objectContaining({
            stripeAccountId: 'acct_test_456',
            stripeEnabled: true,
          }),
        }),
      );
    });

    it('createConnectAccountLink returns onboarding URL', async () => {
      mockStripeClient.accountLinks.create.mockResolvedValueOnce({
        url: 'https://connect.stripe.com/setup/s/abc123',
        expires_at: Date.now() + 86400,
      });

      const { createConnectAccountLink } = await import('../stripeService.js');
      const result = await createConnectAccountLink({
        stripeAccountId: 'acct_123',
        refreshUrl: 'https://example.com/refresh',
        returnUrl: 'https://example.com/return',
      });

      expect(result.success).toBe(true);
      expect(result.url).toBe('https://connect.stripe.com/setup/s/abc123');
    });
  });
});

// ── Webhook Event Processing Tests ──────────────────────────────────────────

describe('Stripe Service — Webhook Event Processing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('handles payment_intent.succeeded — updates Payment record', async () => {
    mockPrisma.payment.findUnique.mockResolvedValueOnce({
      orderId: 'order-1',
      stripePaymentIntentId: null,
    });
    mockPrisma.payment.update.mockResolvedValueOnce({});

    const { handleWebhookEvent } = await import('../stripeService.js');
    const mockEvent = {
      id: 'evt_123',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_123',
          metadata: { orderId: 'order-1' },
        },
      },
    } as unknown as Stripe.Event;

    const result = await handleWebhookEvent(mockEvent);

    expect(result.processed).toBe(true);
    expect(result.action).toBe('PAYMENT_SUCCEEDED');
    expect(result.orderId).toBe('order-1');
    expect(mockPrisma.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { orderId: 'order-1' },
        data: { stripePaymentIntentId: 'pi_123' },
      }),
    );
  });

  it('handles payment_intent.payment_failed — marks payment as failed', async () => {
    mockPrisma.payment.updateMany.mockResolvedValueOnce({ count: 1 });

    const { handleWebhookEvent } = await import('../stripeService.js');
    const mockEvent = {
      id: 'evt_124',
      type: 'payment_intent.payment_failed',
      data: {
        object: {
          id: 'pi_124',
          metadata: { orderId: 'order-2' },
        },
      },
    } as unknown as Stripe.Event;

    const result = await handleWebhookEvent(mockEvent);

    expect(result.processed).toBe(true);
    expect(result.action).toBe('PAYMENT_FAILED');
    expect(mockPrisma.payment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { orderId: 'order-2', status: 'pending' },
        data: { status: 'failed' },
      }),
    );
  });

  it('handles charge.refunded — updates payment to refunded', async () => {
    mockPrisma.payment.findFirst.mockResolvedValueOnce({
      id: 'pay-1',
      orderId: 'order-3',
    });
    mockPrisma.payment.update.mockResolvedValueOnce({});

    const { handleWebhookEvent } = await import('../stripeService.js');
    const mockEvent = {
      id: 'evt_125',
      type: 'charge.refunded',
      data: {
        object: {
          id: 'ch_123',
          payment_intent: 'pi_125',
        },
      },
    } as unknown as Stripe.Event;

    const result = await handleWebhookEvent(mockEvent);

    expect(result.processed).toBe(true);
    expect(result.action).toBe('REFUNDED');
    expect(mockPrisma.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'pay-1' },
        data: { status: 'refunded' },
      }),
    );
  });

  it('handles account.updated — updates workspace Stripe status', async () => {
    mockPrisma.company.update.mockResolvedValueOnce({});

    const { handleWebhookEvent } = await import('../stripeService.js');
    const mockEvent = {
      id: 'evt_126',
      type: 'account.updated',
      data: {
        object: {
          id: 'acct_123',
          charges_enabled: true,
          payouts_enabled: false,
          metadata: { workspaceId: 'ws-1' },
        },
      },
    } as unknown as Stripe.Event;

    const result = await handleWebhookEvent(mockEvent);

    expect(result.processed).toBe(true);
    expect(result.action).toBe('ACCOUNT_UPDATED');
    expect(mockPrisma.company.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ws-1' },
        data: {
          stripeChargesEnabled: true,
          stripePayoutsEnabled: false,
        },
      }),
    );
  });

  it('skips unknown event types', async () => {
    const { handleWebhookEvent } = await import('../stripeService.js');
    const mockEvent = {
      id: 'evt_999',
      type: 'checkout.session.completed',
      data: { object: {} },
    } as unknown as Stripe.Event;

    const result = await handleWebhookEvent(mockEvent);

    expect(result.processed).toBe(false);
    expect(result.action).toBe('IGNORED');
  });

  it('skips payment_intent.succeeded without orderId in metadata', async () => {
    const { handleWebhookEvent } = await import('../stripeService.js');
    const mockEvent = {
      id: 'evt_127',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_no_order',
          metadata: {},
        },
      },
    } as unknown as Stripe.Event;

    const result = await handleWebhookEvent(mockEvent);

    expect(result.processed).toBe(false);
    expect(result.action).toBe('SKIPPED');
    expect(result.error).toBe('No orderId in metadata');
  });
});

// ── Integration Helper Tests ──────────────────────────────────────────────────

describe('Stripe Service — Integration Helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (isStripeAvailable as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (getStripe as ReturnType<typeof vi.fn>).mockReturnValue(mockStripeClient);
  });

  it('capturePaymentForOrder updates internal status even without Stripe PI', async () => {
    mockPrisma.payment.findUnique.mockResolvedValueOnce({
      orderId: 'order-1',
      status: 'pending',
      stripePaymentIntentId: null,
    });
    mockPrisma.payment.update.mockResolvedValueOnce({});

    const { capturePaymentForOrder } = await import('../stripeService.js');
    const result = await capturePaymentForOrder('order-1');

    expect(result.success).toBe(true);
    expect(result.error).toBeNull();
    expect(mockPrisma.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { orderId: 'order-1' },
        data: { status: 'captured' },
      }),
    );
  });

  it('capturePaymentForOrder fails gracefully when no payment record exists', async () => {
    mockPrisma.payment.findUnique.mockResolvedValueOnce(null);

    const { capturePaymentForOrder } = await import('../stripeService.js');
    const result = await capturePaymentForOrder('order-nonexistent');

    expect(result.success).toBe(false);
    expect(result.error).toBe('No payment record found');
  });

  it('refundPaymentForOrder only allows captured payments', async () => {
    mockPrisma.payment.findUnique.mockResolvedValueOnce({
      id: 'pay-1',
      orderId: 'order-1',
      status: 'pending',
      amount: 5000,
      deduction: 4250,
      commission: 750,
    });

    const { refundPaymentForOrder } = await import('../stripeService.js');
    await expect(
      refundPaymentForOrder({ orderId: 'order-1', adminId: 'admin-1' }),
    ).rejects.toThrow('Only captured payments can be refunded');
  });

  it('refundPaymentForOrder processes captured payment successfully', async () => {
    mockPrisma.payment.findUnique.mockResolvedValueOnce({
      id: 'pay-1',
      orderId: 'order-1',
      status: 'captured',
      amount: 5000,
      deduction: 4250,
      commission: 750,
      stripePaymentIntentId: 'pi_123',
    });
    mockPrisma.payment.update.mockResolvedValueOnce({});
    mockPrisma.auditLog.create.mockResolvedValueOnce({});
    mockStripeClient.refunds.create.mockResolvedValueOnce({
      id: 're_789',
      amount: 5000,
      status: 'succeeded',
    });

    const { refundPaymentForOrder } = await import('../stripeService.js');
    const result = await refundPaymentForOrder({
      orderId: 'order-1',
      adminId: 'admin-1',
      reason: 'Test refund',
    });

    expect(result.refundResult.success).toBe(true);
    expect(result.refundResult.refundId).toBe('re_789');
    expect(mockPrisma.auditLog.create).toHaveBeenCalled();
  });

  it('initiatePaymentForOrder creates Payment record and Stripe PI', async () => {
    mockPrisma.payment.upsert.mockResolvedValueOnce({
      orderId: 'order-1',
      amount: 10000,
      commission: 1500,
      deduction: 8500,
      status: 'pending',
    });
    mockPrisma.payment.update.mockResolvedValueOnce({});
    mockStripeClient.paymentIntents.create.mockResolvedValueOnce({
      id: 'pi_new_123',
      client_secret: 'cs_new_123',
      status: 'requires_capture',
    });

    const { initiatePaymentForOrder } = await import('../stripeService.js');
    const result = await initiatePaymentForOrder({
      orderId: 'order-1',
      amount: 10000,
      currency: 'cad',
    });

    expect(result.payment.orderId).toBe('order-1');
    expect(result.stripeResult.success).toBe(true);
    expect(result.stripeResult.paymentIntentId).toBe('pi_new_123');
  });
});