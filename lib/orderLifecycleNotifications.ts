import prisma from './db.js';

function displayNameForUser(u: {
  displayName: string | null;
  firstName: string | null;
  lastName: string | null;
} | null): string | null {
  if (!u) return null;
  const d = u.displayName?.trim();
  if (d) return d;
  const parts = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
  return parts || null;
}

/**
 * NATS `orders.matched` — customer sees who was matched (auto or admin override).
 */
export async function notifyCustomerOrderMatchedFromEvent(data: unknown): Promise<void> {
  const orderId = typeof data === 'object' && data !== null && 'orderId' in data ? String((data as { orderId: unknown }).orderId) : '';
  if (!orderId) return;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      serviceCatalog: { select: { name: true } },
      matchedWorkspace: { select: { name: true } },
      matchedProvider: {
        select: { displayName: true, firstName: true, lastName: true },
      },
    },
  });
  if (!order) return;

  const workspaceName = order.matchedWorkspace?.name?.trim();
  const providerName = displayNameForUser(order.matchedProvider);
  const who = workspaceName || providerName || 'A provider';
  const service = order.serviceCatalog?.name?.trim() ?? 'your service request';

  await prisma.notification.create({
    data: {
      userId: order.customerId,
      title: 'Provider matched',
      message: `${who} was matched for ${service}. Open your order to chat and continue.`,
      type: 'order_matched',
      link: `/orders/${order.id}`,
    },
  });
}

/**
 * NATS `orders.completed` — provider marked the job complete.
 */
export async function notifyCustomerOrderCompletedFromEvent(data: unknown): Promise<void> {
  const orderId = typeof data === 'object' && data !== null && 'orderId' in data ? String((data as { orderId: unknown }).orderId) : '';
  if (!orderId) return;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, customerId: true, serviceCatalog: { select: { name: true } } },
  });
  if (!order) return;

  const service = order.serviceCatalog?.name?.trim() ?? 'your order';

  await prisma.notification.create({
    data: {
      userId: order.customerId,
      title: 'Job marked complete',
      message: `The provider marked ${service} complete. You can leave a review when ready.`,
      type: 'order_completed',
      link: `/orders/${order.id}`,
    },
  });
}

/**
 * NATS `contracts.approved` — contract approved (customer flow unlocks payment).
 */
export async function notifyCustomerContractApprovedFromEvent(data: unknown): Promise<void> {
  const orderId = typeof data === 'object' && data !== null && 'orderId' in data ? String((data as { orderId: unknown }).orderId) : '';
  if (!orderId) return;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, customerId: true, serviceCatalog: { select: { name: true } } },
  });
  if (!order) return;

  const service = order.serviceCatalog?.name?.trim() ?? 'your order';

  await prisma.notification.create({
    data: {
      userId: order.customerId,
      title: 'Contract approved',
      message: `The contract for ${service} is approved. You can proceed to payment from the order when ready.`,
      type: 'contract_approved',
      link: `/orders/${order.id}?tab=contract`,
    },
  });
}

/**
 * Called directly (not via NATS) when an order is cancelled by the customer.
 * Creates a notification for the customer confirming the cancellation.
 */
export async function notifyCustomerOrderCancelled(data: { orderId: string; reason: string }): Promise<void> {
  const { orderId, reason } = data;
  if (!orderId) return;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, customerId: true, serviceCatalog: { select: { name: true } } },
  });
  if (!order) return;

  const service = order.serviceCatalog?.name?.trim() ?? 'your order';

  await prisma.notification.create({
    data: {
      userId: order.customerId,
      title: 'Order cancelled',
      message: `Your order for ${service} has been cancelled. Reason: ${reason}`,
      type: 'order_cancelled',
      link: `/orders/${order.id}`,
    },
  });
}

/**
 * NATS `order.status.changed` — job started (paid → in_progress).
 */
export async function notifyCustomerJobStartedFromEvent(data: unknown): Promise<void> {
  const orderId = typeof data === 'object' && data !== null && 'orderId' in data ? String((data as { orderId: unknown }).orderId) : '';
  if (!orderId) return;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, customerId: true, serviceCatalog: { select: { name: true } } },
  });
  if (!order) return;

  const service = order.serviceCatalog?.name?.trim() ?? 'your order';

  await prisma.notification.create({
    data: {
      userId: order.customerId,
      title: 'Job started',
      message: `The provider has started working on ${service}. You can track progress in the order details.`,
      type: 'order_job_started',
      link: `/orders/${order.id}`,
    },
  });
}

/**
 * NATS `quotes.sent` — provider sent a quote to the customer.
 */
export async function notifyCustomerQuoteSentFromEvent(data: unknown): Promise<void> {
  const orderId = typeof data === 'object' && data !== null && 'orderId' in data ? String((data as { orderId: unknown }).orderId) : '';
  if (!orderId) return;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, customerId: true, serviceCatalog: { select: { name: true } } },
  });
  if (!order) return;

  const service = order.serviceCatalog?.name?.trim() ?? 'your service request';

  await prisma.notification.create({
    data: {
      userId: order.customerId,
      title: 'New Quote Received',
      message: `A provider has sent you a quote for ${service}.`,
      type: 'quote_sent',
      link: `/orders/${order.id}/quotes`,
    },
  });
}

/**
 * NATS `quotes.accepted` — customer accepted a provider's quote.
 */
export async function notifyProviderQuoteAcceptedFromEvent(data: unknown): Promise<void> {
  const quoteId = typeof data === 'object' && data !== null && 'quoteId' in data ? String((data as { quoteId: unknown }).quoteId) : '';
  if (!quoteId) return;

  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    include: {
      order: { select: { id: true } },
      workspace: {
        select: {
          ownerId: true,
          members: { select: { userId: true } },
        },
      },
    },
  });
  if (!quote) return;

  const orderId = quote.order.id;

  // Collect all provider user IDs from workspace owner + members
  const providerUserIds = new Set<string>();
  if (quote.workspace?.ownerId) providerUserIds.add(quote.workspace.ownerId);
  if (quote.workspace?.members) {
    for (const m of quote.workspace.members) {
      if (m.userId) providerUserIds.add(m.userId);
    }
  }

  for (const userId of providerUserIds) {
    await prisma.notification.create({
      data: {
        userId,
        title: 'Quote Accepted',
        message: 'Your quote has been accepted and the order is now contracted.',
        type: 'quote_accepted',
        link: `/orders/${orderId}`,
      },
    });
  }
}

/**
 * NATS `quotes.rejected` — customer rejected a provider's quote.
 */
export async function notifyProviderQuoteRejectedFromEvent(data: unknown): Promise<void> {
  const quoteId = typeof data === 'object' && data !== null && 'quoteId' in data ? String((data as { quoteId: unknown }).quoteId) : '';
  if (!quoteId) return;

  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    include: {
      order: { select: { id: true } },
      workspace: {
        select: {
          ownerId: true,
          members: { select: { userId: true } },
        },
      },
    },
  });
  if (!quote) return;

  const orderId = quote.order.id;

  // Collect all provider user IDs from workspace owner + members
  const providerUserIds = new Set<string>();
  if (quote.workspace?.ownerId) providerUserIds.add(quote.workspace.ownerId);
  if (quote.workspace?.members) {
    for (const m of quote.workspace.members) {
      if (m.userId) providerUserIds.add(m.userId);
    }
  }

  for (const userId of providerUserIds) {
    await prisma.notification.create({
      data: {
        userId,
        title: 'Quote Declined',
        message: 'Your quote was declined. The order is open for other providers.',
        type: 'quote_rejected',
        link: `/orders/${orderId}`,
      },
    });
  }
}

/**
 * NATS `payment.captured` — customer payment was captured successfully.
 */
export async function notifyPaymentCapturedFromEvent(data: unknown): Promise<void> {
  const orderId = typeof data === 'object' && data !== null && 'orderId' in data ? String((data as { orderId: unknown }).orderId) : '';
  if (!orderId) return;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, customerId: true, serviceCatalog: { select: { name: true } } },
  });
  if (!order) return;

  const service = order.serviceCatalog?.name?.trim() ?? 'your order';

  await prisma.notification.create({
    data: {
      userId: order.customerId,
      title: 'Payment captured',
      message: `Your payment for ${service} has been captured successfully.`,
      type: 'payment_captured',
      link: `/orders/${order.id}`,
    },
  });
}

/**
 * Called directly (not via NATS) when payment is captured.
 * Creates a notification for the customer and publishes a NATS event.
 */
export async function notifyPaymentCaptured(orderId: string, amount: number): Promise<void> {
  if (!orderId) return;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, customerId: true, serviceCatalog: { select: { name: true } } },
  });
  if (!order) return;

  const service = order.serviceCatalog?.name?.trim() ?? 'your order';

  await prisma.notification.create({
    data: {
      userId: order.customerId,
      title: 'Payment captured',
      message: `Your payment of $${(amount / 100).toFixed(2)} for ${service} has been captured successfully.`,
      type: 'payment_captured',
      link: `/orders/${order.id}`,
    },
  });

  try {
    const { publish } = await import('./bus.js');
    await publish('payment.captured', { orderId, amount });
  } catch {
    // NATS is optional
  }
}

/**
 * NATS `escrow.released` — escrow funds released to the provider.
 */
export async function notifyEscrowReleasedFromEvent(data: unknown): Promise<void> {
  const orderId = typeof data === 'object' && data !== null && 'orderId' in data ? String((data as { orderId: unknown }).orderId) : '';
  if (!orderId) return;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      matchedProviderId: true,
      matchedWorkspace: {
        select: {
          ownerId: true,
          members: { select: { userId: true } },
        },
      },
    },
  });
  if (!order) return;

  // Collect all provider user IDs from workspace owner + members
  const providerUserIds = new Set<string>();
  if (order.matchedProviderId) providerUserIds.add(order.matchedProviderId);
  if (order.matchedWorkspace?.ownerId) providerUserIds.add(order.matchedWorkspace.ownerId);
  if (order.matchedWorkspace?.members) {
    for (const m of order.matchedWorkspace.members) {
      if (m.userId) providerUserIds.add(m.userId);
    }
  }

  for (const userId of providerUserIds) {
    await prisma.notification.create({
      data: {
        userId,
        title: 'Escrow released',
        message: 'Escrow funds for a completed order have been released to your account.',
        type: 'escrow_released',
        link: `/orders/${orderId}`,
      },
    });
  }
}

/**
 * Called directly (not via NATS) when escrow is released.
 * Creates a notification for the provider and publishes a NATS event.
 */
export async function notifyEscrowReleased(orderId: string, amount: number): Promise<void> {
  if (!orderId) return;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      matchedProviderId: true,
      matchedWorkspace: {
        select: {
          ownerId: true,
          members: { select: { userId: true } },
        },
      },
    },
  });
  if (!order) return;

  // Collect all provider user IDs from workspace owner + members
  const providerUserIds = new Set<string>();
  if (order.matchedProviderId) providerUserIds.add(order.matchedProviderId);
  if (order.matchedWorkspace?.ownerId) providerUserIds.add(order.matchedWorkspace.ownerId);
  if (order.matchedWorkspace?.members) {
    for (const m of order.matchedWorkspace.members) {
      if (m.userId) providerUserIds.add(m.userId);
    }
  }

  for (const userId of providerUserIds) {
    await prisma.notification.create({
      data: {
        userId,
        title: 'Escrow released',
        message: `Escrow funds of $${(amount / 100).toFixed(2)} for a completed order have been released to your account.`,
        type: 'escrow_released',
        link: `/orders/${orderId}`,
      },
    });
  }

  try {
    const { publish } = await import('./bus.js');
    await publish('escrow.released', { orderId, amount });
  } catch {
    // NATS is optional
  }
}

/**
 * NATS `payment.refunded` — customer payment was refunded.
 */
export async function notifyPaymentRefundedFromEvent(data: unknown): Promise<void> {
  const orderId = typeof data === 'object' && data !== null && 'orderId' in data ? String((data as { orderId: unknown }).orderId) : '';
  if (!orderId) return;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, customerId: true, serviceCatalog: { select: { name: true } } },
  });
  if (!order) return;

  const service = order.serviceCatalog?.name?.trim() ?? 'your order';

  await prisma.notification.create({
    data: {
      userId: order.customerId,
      title: 'Payment refunded',
      message: `Your payment for ${service} has been refunded.`,
      type: 'payment_refunded',
      link: `/orders/${order.id}`,
    },
  });
}

/**
 * Called directly (not via NATS) when payment is refunded.
 * Creates a notification for the customer and publishes a NATS event.
 */
export async function notifyPaymentRefunded(orderId: string, amount: number, reason?: string): Promise<void> {
  if (!orderId) return;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, customerId: true, serviceCatalog: { select: { name: true } } },
  });
  if (!order) return;

  const service = order.serviceCatalog?.name?.trim() ?? 'your order';
  const reasonSuffix = reason ? ` Reason: ${reason}` : '';

  await prisma.notification.create({
    data: {
      userId: order.customerId,
      title: 'Payment refunded',
      message: `Your payment of $${(amount / 100).toFixed(2)} for ${service} has been refunded.${reasonSuffix}`,
      type: 'payment_refunded',
      link: `/orders/${order.id}`,
    },
  });

  try {
    const { publish } = await import('./bus.js');
    await publish('payment.refunded', { orderId, amount, reason });
  } catch {
    // NATS is optional
  }
}

/**
 * NATS `payment.failed` — customer payment failed.
 */
export async function notifyPaymentFailedFromEvent(data: unknown): Promise<void> {
  const orderId = typeof data === 'object' && data !== null && 'orderId' in data ? String((data as { orderId: unknown }).orderId) : '';
  if (!orderId) return;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, customerId: true, serviceCatalog: { select: { name: true } } },
  });
  if (!order) return;

  const service = order.serviceCatalog?.name?.trim() ?? 'your order';

  await prisma.notification.create({
    data: {
      userId: order.customerId,
      title: 'Payment failed',
      message: `Your payment for ${service} has failed. Please check your payment method and try again.`,
      type: 'payment_failed',
      link: `/orders/${order.id}`,
    },
  });
}

/**
 * Called directly (not via NATS) when payment fails.
 * Creates a notification for the customer and publishes a NATS event.
 */
export async function notifyPaymentFailed(orderId: string, amount: number, error?: string): Promise<void> {
  if (!orderId) return;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, customerId: true, serviceCatalog: { select: { name: true } } },
  });
  if (!order) return;

  const service = order.serviceCatalog?.name?.trim() ?? 'your order';
  const errorSuffix = error ? ` Error: ${error}` : '';

  await prisma.notification.create({
    data: {
      userId: order.customerId,
      title: 'Payment failed',
      message: `Your payment of $${(amount / 100).toFixed(2)} for ${service} has failed. Please check your payment method and try again.${errorSuffix}`,
      type: 'payment_failed',
      link: `/orders/${order.id}`,
    },
  });

  try {
    const { publish } = await import('./bus.js');
    await publish('payment.failed', { orderId, amount, error });
  } catch {
    // NATS is optional
  }
}
