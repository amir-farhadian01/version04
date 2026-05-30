import { connect, JSONCodec, NatsConnection } from 'nats';
import {
  notifyCustomerContractApprovedFromEvent,
  notifyCustomerJobStartedFromEvent,
  notifyCustomerOrderCompletedFromEvent,
  notifyCustomerOrderMatchedFromEvent,
  notifyCustomerQuoteSentFromEvent,
  notifyPaymentCapturedFromEvent,
  notifyPaymentFailedFromEvent,
  notifyPaymentRefundedFromEvent,
  notifyEscrowReleasedFromEvent,
  notifyProviderQuoteAcceptedFromEvent,
  notifyProviderQuoteRejectedFromEvent,
} from './orderLifecycleNotifications.js';

/**
 * Published subjects: Sprint L contracts `contracts.sent`, `contracts.approved`,
 * `contracts.rejected`; Sprint I matching `orders.submitted`, `orders.matched`,
 * `orders.auto_matched`, `orders.auto_match_exhausted`, `orders.provider_acknowledged`,
 * `orders.provider_declined`; Sprint G2 quotes `quotes.sent`, `quotes.accepted`,
 * `quotes.rejected`.
 * In-process consumers: {@link startNatsNotificationConsumers} (customer/provider notifications).
 */

export const EventSubjects = {
  // Order lifecycle
  ORDERS_SUBMITTED: 'orders.submitted',
  ORDERS_MATCHED: 'orders.matched',
  ORDERS_AUTO_MATCHED: 'orders.auto_matched',
  ORDERS_AUTO_MATCH_EXHAUSTED: 'orders.auto_match_exhausted',
  ORDERS_PROVIDER_ACKNOWLEDGED: 'orders.provider_acknowledged',
  ORDERS_PROVIDER_DECLINED: 'orders.provider_declined',
  ORDERS_COMPLETED: 'orders.completed',
  ORDER_STATUS_CHANGED: 'order.status.changed',

  // Contract lifecycle
  CONTRACTS_SENT: 'contracts.sent',
  CONTRACTS_APPROVED: 'contracts.approved',
  CONTRACTS_REJECTED: 'contracts.rejected',

  // Quote lifecycle
  QUOTES_SENT: 'quotes.sent',
  QUOTES_ACCEPTED: 'quotes.accepted',
  QUOTES_REJECTED: 'quotes.rejected',

  // Payment lifecycle
  PAYMENT_CAPTURED: 'payment.captured',
  ESCROW_RELEASED: 'escrow.released',
  PAYMENT_REFUNDED: 'payment.refunded',
  PAYMENT_FAILED: 'payment.failed',

  // Social feed
  SOCIAL_POST_CREATED: 'social.post.created',
  SOCIAL_POST_LIKED: 'social.post.liked',
  SOCIAL_POST_COMMENTED: 'social.post.commented',
  SOCIAL_STORY_CREATED: 'social.story.created',
  SOCIAL_USER_FOLLOWED: 'social.user.followed',
} as const;
let natsConn: NatsConnection | null = null;
let notificationConsumersStarted = false;
const jsonCodec = JSONCodec();

export async function getNats(): Promise<NatsConnection> {
  if (!natsConn) {
    const natsUrl = process.env.NATS_URL || 'nats://localhost:4222';
    try {
      natsConn = await connect({ servers: natsUrl });
      console.log('NATS connected');
    } catch (err) {
      console.error('NATS connection failed (non-fatal):', err);
      throw err;
    }
  }
  return natsConn;
}

export async function publish(subject: string, data: object): Promise<void> {
  try {
    const nc = await getNats();
    const encoder = new TextEncoder();
    nc.publish(subject, encoder.encode(JSON.stringify(data)));
  } catch {
    // NATS is optional — don't crash if unavailable
  }
}

/**
 * Subscribe to order/contract lifecycle subjects and create customer `Notification` rows.
 * Safe to call once after {@link getNats}; no-op if NATS did not connect.
 */
export async function startNatsNotificationConsumers(): Promise<void> {
  if (notificationConsumersStarted) return;
  notificationConsumersStarted = true;

  let nc: NatsConnection;
  try {
    nc = await getNats();
  } catch {
    notificationConsumersStarted = false;
    return;
  }

  const subscribeHandler = (subject: string, handler: (payload: unknown) => Promise<void>) => {
    nc.subscribe(subject, {
      callback: (err, msg) => {
        if (err) {
          console.error(`NATS ${subject}:`, err);
          return;
        }
        void (async () => {
          try {
            const payload = jsonCodec.decode(msg.data);
            await handler(payload);
          } catch (e) {
            console.error(`NATS ${subject} handler failed:`, e);
          }
        })();
      },
    });
  };

  subscribeHandler('orders.matched', notifyCustomerOrderMatchedFromEvent);
  subscribeHandler('orders.completed', notifyCustomerOrderCompletedFromEvent);
  subscribeHandler('contracts.approved', notifyCustomerContractApprovedFromEvent);
  subscribeHandler('order.status.changed', notifyCustomerJobStartedFromEvent);
  subscribeHandler('quotes.sent', notifyCustomerQuoteSentFromEvent);
  subscribeHandler('quotes.accepted', notifyProviderQuoteAcceptedFromEvent);
  subscribeHandler('quotes.rejected', notifyProviderQuoteRejectedFromEvent);
  subscribeHandler('payment.captured', notifyPaymentCapturedFromEvent);
  subscribeHandler('escrow.released', notifyEscrowReleasedFromEvent);
  subscribeHandler('payment.refunded', notifyPaymentRefundedFromEvent);
  subscribeHandler('payment.failed', notifyPaymentFailedFromEvent);

  console.log('NATS notification consumers registered (orders.matched, orders.completed, contracts.approved, order.status.changed, quotes.sent, quotes.accepted, quotes.rejected, payment.captured, escrow.released, payment.refunded, payment.failed)');
}

export default getNats;
