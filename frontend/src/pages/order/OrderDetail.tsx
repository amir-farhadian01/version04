import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api.js';
import { NHCard } from '../../components/ui/NHCard.js';
import { NHButton } from '../../components/ui/NHButton.js';
import { cn } from '../../lib/cn.js';
import type { OrderDetailData } from '../../services/orders.js';
import OrderDetailsTab from './tabs/OrderDetailsTab.js';
import OrderContractTab from './tabs/OrderContractTab.js';
import OrderChatTab from './tabs/OrderChatTab.js';

type TabKey = 'details' | 'contract' | 'chat';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'details', label: 'Details' },
  { key: 'contract', label: 'Contract' },
  { key: 'chat', label: 'Chat' },
];

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  matching: 'Matching',
  matched: 'Matched',
  contracted: 'Contracted',
  paid: 'Paid',
  in_progress: 'In Progress',
  completed: 'Completed',
  closed: 'Closed',
  cancelled: 'Cancelled',
};

const STATUS_COLORS: Record<string, string> = {
  draft: 'text-nh-muted bg-nh-muted/10',
  submitted: 'text-blue-400 bg-blue-400/10',
  matching: 'text-amber-400 bg-amber-400/10',
  matched: 'text-emerald-400 bg-emerald-400/10',
  contracted: 'text-indigo-400 bg-indigo-400/10',
  paid: 'text-cyan-400 bg-cyan-400/10',
  in_progress: 'text-purple-400 bg-purple-400/10',
  completed: 'text-green-400 bg-green-400/10',
  closed: 'text-nh-text bg-nh-surface',
  cancelled: 'text-red-400 bg-red-400/10',
};

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabKey>('details');

  const { data, isLoading, error } = useQuery<OrderDetailData>({
    queryKey: ['order', id],
    queryFn: async () => {
      const res = await api.get(`/orders/${id}`);
      return res.data;
    },
    enabled: Boolean(id),
    retry: false,
    staleTime: 15_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-nh-primary border-t-transparent" />
      </div>
    );
  }

  if (error || !data) {
    const errMsg = error && typeof error === 'object' && 'message' in error
      ? String((error as { message: unknown }).message)
      : 'Order not found';
    const is403 = errMsg.includes('403') || errMsg.includes('Forbidden');
    return (
      <NHCard className="p-6 text-center">
        <p className="text-nh-text font-semibold mb-2">
          {is403 ? 'Access Denied' : 'Order Not Found'}
        </p>
        <p className="text-nh-muted text-sm mb-4">
          {is403
            ? 'You do not have permission to view this order.'
            : 'The order you are looking for does not exist.'}
        </p>
        <NHButton variant="secondary" onClick={() => navigate(-1)}>
          Go Back
        </NHButton>
      </NHCard>
    );
  }

  const order = data;
  const statusLabel = STATUS_LABELS[order.status] ?? order.status;
  const statusColor = STATUS_COLORS[order.status] ?? 'text-nh-muted bg-nh-muted/10';

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-nh-muted hover:text-nh-primary text-sm transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-nh-text">
            Order {order.id.slice(0, 8)}...
          </h1>
          <p className="text-nh-muted text-sm mt-1">
            Created {new Date(order.createdAt).toLocaleDateString()}
          </p>
        </div>
        <span className={cn('px-3 py-1 text-xs font-medium rounded-full', statusColor)}>
          {statusLabel}
        </span>
      </div>

      {/* Provider info */}
      {order.matchedSummary && (
        <NHCard className="p-4 flex items-center gap-4">
          <div className="h-10 w-10 rounded-full bg-nh-primary/20 flex items-center justify-center text-nh-primary font-bold text-sm shrink-0">
            {order.matchedSummary.provider.displayName?.[0]?.toUpperCase()
              ?? order.matchedSummary.provider.firstName?.[0]?.toUpperCase()
              ?? '?'}
          </div>
          <div>
            <p className="text-nh-text font-semibold">
              {order.matchedSummary.provider.displayName
                ?? `${order.matchedSummary.provider.firstName ?? ''} ${order.matchedSummary.provider.lastName ?? ''}`.trim()}
            </p>
            <p className="text-nh-muted text-xs">{order.matchedSummary.workspace.name}</p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-nh-text font-semibold">
              {order.matchedSummary.package.currency} {(order.matchedSummary.package.finalPrice / 100).toFixed(2)}
            </p>
            <p className="text-nh-muted text-xs">{order.matchedSummary.package.name}</p>
          </div>
        </NHCard>
      )}

      {/* Tabs */}
      <div className="flex border-b border-nh-border">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px',
              activeTab === tab.key
                ? 'border-nh-primary text-nh-primary'
                : 'border-transparent text-nh-muted hover:text-nh-text',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'details' && <OrderDetailsTab order={order} />}
      {activeTab === 'contract' && <OrderContractTab orderId={order.id} order={order} />}
      {activeTab === 'chat' && <OrderChatTab orderId={order.id} order={order} />}
    </div>
  );
}