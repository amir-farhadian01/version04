import { OrderStatus } from '@prisma/client';
import prisma from './db.js';

function customerLabel(c: {
  displayName: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string;
}): string {
  if (c.displayName?.trim()) return c.displayName.trim();
  const n = [c.firstName, c.lastName].filter(Boolean).join(' ').trim();
  if (n) return n;
  return c.email;
}

export function resolveOrderAmount(order: {
  matchedPackage: { finalPrice: number; currency: string } | null;
  orderContract: {
    currentVersion: { amount: number | null; currency: string | null } | null;
  } | null;
}): { amount: number; currency: string } {
  const cv = order.orderContract?.currentVersion;
  if (cv?.amount != null && !Number.isNaN(cv.amount)) {
    return {
      amount: cv.amount,
      currency: (cv.currency ?? order.matchedPackage?.currency ?? 'CAD').trim() || 'CAD',
    };
  }
  if (order.matchedPackage) {
    return { amount: order.matchedPackage.finalPrice, currency: order.matchedPackage.currency || 'CAD' };
  }
  return { amount: 0, currency: 'CAD' };
}

const PENDING_STATUSES: OrderStatus[] = [
  OrderStatus.matched,
  OrderStatus.contracted,
  OrderStatus.paid,
  OrderStatus.in_progress,
];

const COMPLETED_STATUSES: OrderStatus[] = [OrderStatus.completed, OrderStatus.closed];

export type ProviderWorkspaceFinanceLedgerRow = {
  kind: 'transaction' | 'order';
  id: string;
  at: string;
  label: string;
  detail: string | null;
  amount: number;
  /** Contract/package currency for orders; null for internal `Transaction` rows (no currency on model). */
  currency: string | null;
  flow: 'credit' | 'debit' | 'neutral';
};

export type ProviderWorkspaceFinanceInvoiceRow = {
  orderId: string;
  customerLabel: string;
  serviceName: string;
  amount: number;
  currency: string;
  orderStatus: string;
  contractVersionStatus: string | null;
  updatedAt: string;
};

export type ProviderWorkspaceFinancePayload = {
  workspaceId: string;
  disclaimers: {
    paymentGatewayConnected: false;
    payoutsProcessed: false;
    figuresAreFromOrdersAndInternalRecords: true;
  };
  summary: {
    /** Agreed amounts for completed + closed jobs (not payouts). */
    estimatedEarnings: number;
    /** Agreed amounts for matched → in_progress pipeline. */
    pendingAmount: number;
    completedJobCount: number;
    disputedJobCount: number;
    /** Dominant order currency for display; `MIXED` when multiple order currencies exist. */
    displayCurrency: string;
    mixedCurrency: boolean;
  };
  ledger: ProviderWorkspaceFinanceLedgerRow[];
  payoutHistory: {
    available: false;
    items: [];
    placeholderMessage: string;
  };
  invoices: ProviderWorkspaceFinanceInvoiceRow[];
};

export async function buildProviderWorkspaceFinance(
  workspaceId: string,
): Promise<ProviderWorkspaceFinancePayload> {
  const [orders, transactions] = await Promise.all([
    prisma.order.findMany({
      where: { matchedWorkspaceId: workspaceId },
      include: {
        serviceCatalog: { select: { name: true } },
        customer: {
          select: { displayName: true, firstName: true, lastName: true, email: true },
        },
        matchedPackage: { select: { finalPrice: true, currency: true } },
        orderContract: {
          include: {
            currentVersion: {
              select: { amount: true, currency: true, status: true, versionNumber: true },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.transaction.findMany({
      where: { companyId: workspaceId },
      orderBy: { timestamp: 'desc' },
      take: 200,
    }),
  ]);

  const currencyVotes = new Map<string, number>();
  for (const o of orders) {
    const { currency } = resolveOrderAmount(o);
    currencyVotes.set(currency, (currencyVotes.get(currency) ?? 0) + 1);
  }
  let displayCurrency = 'CAD';
  let maxVotes = 0;
  for (const [c, n] of currencyVotes) {
    if (n > maxVotes) {
      maxVotes = n;
      displayCurrency = c;
    }
  }
  const mixedCurrency = currencyVotes.size > 1;
  if (mixedCurrency) {
    displayCurrency = 'MIXED';
  }

  let estimatedEarnings = 0;
  let pendingAmount = 0;
  let completedJobCount = 0;
  let disputedJobCount = 0;

  for (const o of orders) {
    const { amount } = resolveOrderAmount(o);
    if (o.status === OrderStatus.disputed) disputedJobCount += 1;
    if (COMPLETED_STATUSES.includes(o.status)) {
      completedJobCount += 1;
      estimatedEarnings += amount;
    }
    if (PENDING_STATUSES.includes(o.status)) {
      pendingAmount += amount;
    }
  }

  const ledger: ProviderWorkspaceFinanceLedgerRow[] = [];

  for (const t of transactions) {
    const isIncome = t.type === 'income';
    ledger.push({
      kind: 'transaction',
      id: t.id,
      at: t.timestamp.toISOString(),
      label: t.category?.trim() || 'Ledger entry',
      detail: t.description ?? null,
      amount: Math.abs(t.amount),
      currency: null,
      flow: isIncome ? 'credit' : 'debit',
    });
  }

  for (const o of orders) {
    const { amount, currency } = resolveOrderAmount(o);
    const serviceName = o.serviceCatalog.name?.trim() || 'Service';
    ledger.push({
      kind: 'order',
      id: o.id,
      at: o.updatedAt.toISOString(),
      label: `Order · ${serviceName}`,
      detail: o.status,
      amount,
      currency,
      flow: 'neutral',
    });
  }

  ledger.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));

  const invoices: ProviderWorkspaceFinanceInvoiceRow[] = orders.map((o) => {
    const { amount, currency } = resolveOrderAmount(o);
    return {
      orderId: o.id,
      customerLabel: customerLabel(o.customer),
      serviceName: o.serviceCatalog.name?.trim() || '—',
      amount,
      currency,
      orderStatus: o.status,
      contractVersionStatus: o.orderContract?.currentVersion?.status ?? null,
      updatedAt: o.updatedAt.toISOString(),
    };
  });

  return {
    workspaceId,
    disclaimers: {
      paymentGatewayConnected: false,
      payoutsProcessed: false,
      figuresAreFromOrdersAndInternalRecords: true,
    },
    summary: {
      estimatedEarnings,
      pendingAmount,
      completedJobCount,
      disputedJobCount,
      displayCurrency,
      mixedCurrency,
    },
    ledger,
    payoutHistory: {
      available: false,
      items: [],
      placeholderMessage:
        'Automated payouts are not enabled. No payment processor is connected; when payouts ship, history will appear here.',
    },
    invoices,
  };
}
