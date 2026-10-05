import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  constructEvent: vi.fn(),
  handleWebhookEvent: vi.fn(),
  transaction: vi.fn(),
  auditFindFirst: vi.fn(),
  auditCreate: vi.fn(),
  executeRaw: vi.fn(),
}));

vi.mock('../lib/stripe.js', () => ({
  getStripe: () => ({ webhooks: { constructEvent: mocks.constructEvent } }),
  getStripeWebhookSecret: () => 'whsec_test',
}));
vi.mock('../lib/stripeService.js', () => ({ handleWebhookEvent: mocks.handleWebhookEvent }));
vi.mock('../lib/db.js', () => ({ default: { $transaction: mocks.transaction } }));

import router from './stripeWebhook.js';

describe('Stripe webhook boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaction.mockImplementation(async (callback) => callback({
      $executeRaw: mocks.executeRaw,
      auditLog: { findFirst: mocks.auditFindFirst, create: mocks.auditCreate },
    }));
    mocks.auditFindFirst.mockResolvedValue(null);
    mocks.auditCreate.mockResolvedValue({ id: 'audit-1' });
    mocks.constructEvent.mockReturnValue({ id: 'evt-1', type: 'payment_intent.succeeded' });
    mocks.handleWebhookEvent.mockResolvedValue({
      processed: true, eventType: 'payment_intent.succeeded', orderId: 'order-1', action: 'PAYMENT_SUCCEEDED', error: null,
    });
  });

  function app() {
    const instance = express();
    instance.use('/api/stripe', express.raw({ type: 'application/json' }), router);
    instance.use(express.json());
    return instance;
  }

  it('verifies the exact raw body and records successful processing', async () => {
    const body = '{ "id": "evt-1", "spacing": true }';
    const response = await request(app()).post('/api/stripe/webhook')
      .set('content-type', 'application/json').set('stripe-signature', 'sig').send(body);
    expect(response.status).toBe(200);
    expect(Buffer.isBuffer(mocks.constructEvent.mock.calls[0]?.[0])).toBe(true);
    expect(mocks.constructEvent.mock.calls[0]?.[0].toString()).toBe(body);
    expect(mocks.auditCreate).toHaveBeenCalled();
  });

  it('returns a retriable failure when processing fails', async () => {
    mocks.handleWebhookEvent.mockResolvedValue({
      processed: false, eventType: 'payment_intent.succeeded', orderId: null, action: 'ERROR', error: 'database unavailable',
    });
    const response = await request(app()).post('/api/stripe/webhook')
      .set('content-type', 'application/json').set('stripe-signature', 'sig').send('{}');
    expect(response.status).toBe(503);
    expect(mocks.auditCreate).not.toHaveBeenCalled();
  });

  it('acknowledges a previously processed event without processing it again', async () => {
    mocks.auditFindFirst.mockResolvedValue({ id: 'audit-existing' });
    const response = await request(app()).post('/api/stripe/webhook')
      .set('content-type', 'application/json').set('stripe-signature', 'sig').send('{}');
    expect(response.status).toBe(200);
    expect(response.body.duplicate).toBe(true);
    expect(mocks.handleWebhookEvent).not.toHaveBeenCalled();
  });
});
