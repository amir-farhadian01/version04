import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  capturePaymentForOrder: vi.fn(),
  initiatePaymentForOrder: vi.fn(),
  evaluateOrderPaymentGate: vi.fn(),
  orderFindUnique: vi.fn(),
  stripeAvailability: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock('../lib/auth.middleware.js', () => ({
  authenticate: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    (req as express.Request & { user: unknown }).user = { userId: 'customer-1', role: 'customer' };
    next();
  },
}));
vi.mock('../lib/db.js', () => ({
  default: {
    order: { findUnique: mocks.orderFindUnique },
    payment: { findUnique: vi.fn() },
    transaction: { findFirst: vi.fn() },
    $transaction: mocks.transaction,
  },
}));
vi.mock('../lib/orderPayments.js', () => ({
  evaluateOrderPaymentGate: mocks.evaluateOrderPaymentGate,
  getOrderPaymentSummary: vi.fn(),
  createEscrowPayment: vi.fn(),
  PAYMENT_GATE_CODE_CONTRACT_APPROVAL_REQUIRED: 'CONTRACT_APPROVAL_REQUIRED',
}));
vi.mock('../lib/stripeService.js', () => ({
  capturePaymentForOrder: mocks.capturePaymentForOrder,
  initiatePaymentForOrder: mocks.initiatePaymentForOrder,
}));
vi.mock('../lib/paymentProvider.js', () => ({
  paymentProviders: { stripe: { availability: mocks.stripeAvailability } },
}));
vi.mock('../lib/orderLifecycleNotifications.js', () => ({ notifyPaymentCaptured: vi.fn() }));
vi.mock('../lib/workspaceAccess.js', () => ({ assertWorkspaceMember: vi.fn(), WorkspaceAccessError: class extends Error {} }));
vi.mock('../lib/orderNegotiationAccess.js', () => ({ userHasActiveInboxAttemptForOrder: vi.fn() }));

import router from './orderPayments.js';

describe('order payment confirmation security', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.stripeAvailability.mockReturnValue({ enabled: true });
    mocks.orderFindUnique.mockResolvedValue({
      id: 'order-1', customerId: 'customer-1', matchedWorkspaceId: 'workspace-1', phase: 'contracted',
    });
    mocks.evaluateOrderPaymentGate.mockResolvedValue({
      ok: true, amount: 5000, currency: 'CAD', contractVersionId: 'contract-version-1',
    });
  });

  it('does not mark an order paid when the provider does not confirm capture', async () => {
    mocks.capturePaymentForOrder.mockResolvedValue({ success: false, error: 'provider failure' });
    const app = express();
    app.use(express.json());
    app.use('/api/orders/:orderId/payments', router);

    const response = await request(app).post('/api/orders/order-1/payments/confirm');
    expect(response.status).toBe(502);
    expect(response.body.code).toBe('PAYMENT_CAPTURE_FAILED');
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it('does not create a mock payment session when the provider is unavailable', async () => {
    mocks.initiatePaymentForOrder.mockResolvedValue({
      payment: { orderId: 'order-1' },
      stripeResult: { success: false, paymentIntentId: null, clientSecret: null, error: 'provider unavailable' },
    });
    const app = express();
    app.use(express.json());
    app.use('/api/orders/:orderId/payments', router);

    const response = await request(app).post('/api/orders/order-1/payments/session');
    expect(response.status).toBe(503);
    expect(response.body.code).toBe('PAYMENT_SESSION_UNAVAILABLE');
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it('does not initialize a payment session when Stripe is disabled for the environment', async () => {
    mocks.stripeAvailability.mockReturnValue({ enabled: false });
    const app = express();
    app.use(express.json());
    app.use('/api/orders/:orderId/payments', router);

    const response = await request(app).post('/api/orders/order-1/payments/session');
    expect(response.status).toBe(503);
    expect(response.body.code).toBe('PAYMENT_PROVIDER_DISABLED');
    expect(mocks.initiatePaymentForOrder).not.toHaveBeenCalled();
  });
});
