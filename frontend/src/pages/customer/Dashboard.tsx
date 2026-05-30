import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { getMyOrders } from '../../services/orders';
import type { OrderListItem, OrderStatus } from '../../services/orders';
import { useTabVisibility } from '../../hooks/useVisibilityAwarePolling.js';

// ─── Phase Labels ────────────────────────────────────────────────────────────

const PHASE_LABELS: Record<string, string> = {
  matching: 'Finding provider',
  quoting: 'Waiting for quote',
  negotiation: 'In negotiation',
  contracted: 'Contract pending',
  paid: 'Paid',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  disputed: 'Disputed',
};

// ─── Status Badge Config ─────────────────────────────────────────────────────

const STATUS_COLORS: Record<OrderStatus, { bg: string; text: string }> = {
  draft: { bg: 'bg-nh-surface-elevated', text: 'text-nh-text-muted' },
  submitted: { bg: 'bg-nh-primary/20', text: 'text-nh-primary' },
  matching: { bg: 'bg-nh-warning/20', text: 'text-nh-warning' },
  matched: { bg: 'bg-nh-success/20', text: 'text-nh-success' },
  contracted: { bg: 'bg-nh-purple/20', text: 'text-nh-purple' },
  paid: { bg: 'bg-nh-primary/20', text: 'text-nh-primary' },
  in_progress: { bg: 'bg-cyan-500/20', text: 'text-cyan-300' },
  completed: { bg: 'bg-nh-success/20', text: 'text-nh-success' },
  cancelled: { bg: 'bg-nh-danger/20', text: 'text-nh-danger' },
  closed: { bg: 'bg-nh-surface-elevated', text: 'text-nh-text-muted' },
};

const STATUS_LABELS: Record<OrderStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  matching: 'Finding Provider',
  matched: 'Provider Found',
  contracted: 'Contract Sent',
  paid: 'Paid',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  closed: 'Closed',
};

const TERMINAL_STATUSES: OrderStatus[] = ['completed', 'cancelled', 'closed'];

// ─── Payment Status Badge Config ─────────────────────────────────────────────

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-nh-warning/20 text-nh-warning',
  CAPTURED: 'bg-nh-success/20 text-nh-success',
  REFUNDED: 'bg-nh-danger/20 text-nh-danger',
  FAILED: 'bg-nh-danger/20 text-nh-danger',
};

// ─── Duration Tables (mirrors lib/orderTimeEstimate.ts) ──────────────────────

const PHASE_DURATIONS: Record<string, Record<string, number>> = {
  matching: { low: 30, standard: 15, urgent: 5, emergency: 2 },
  quoting: { low: 60, standard: 30, urgent: 15, emergency: 5 },
  negotiation: { low: 120, standard: 60, urgent: 30, emergency: 15 },
  contracted: { low: 1440, standard: 720, urgent: 360, emergency: 120 },
  paid: { low: 0, standard: 0, urgent: 0, emergency: 0 },
  in_progress: { low: 120, standard: 120, urgent: 120, emergency: 120 },
  completed: { low: 0, standard: 0, urgent: 0, emergency: 0 },
  cancelled: { low: 0, standard: 0, urgent: 0, emergency: 0 },
  disputed: { low: 0, standard: 0, urgent: 0, emergency: 0 },
};

// ─── Status → Time Estimate Phase Mapping ────────────────────────────────────

function statusToTimeEstimatePhase(status: OrderStatus): string {
  switch (status) {
    case 'draft':
    case 'submitted':
      return 'quoting';
    case 'matching':
      return 'matching';
    case 'matched':
      return 'negotiation';
    case 'contracted':
      return 'contracted';
    case 'paid':
      return 'paid';
    case 'in_progress':
      return 'in_progress';
    case 'completed':
      return 'completed';
    case 'cancelled':
      return 'cancelled';
    case 'closed':
    case 'disputed' as OrderStatus:
      return 'disputed';
    default:
      return 'quoting';
  }
}

// ─── Time Estimation Hook ────────────────────────────────────────────────────

interface TimeEstimate {
  remainingMs: number;
  totalMs: number;
  elapsedMs: number;
  percentage: number;
  label: string;
  remainingText: string;
}

function useTimeEstimate(
  status: OrderStatus,
  urgency: string,
  updatedAt: string,
): TimeEstimate {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  return useMemo(() => {
    const phase = statusToTimeEstimatePhase(status);
    const label = PHASE_LABELS[phase] ?? phase;

    const urgencyKey = urgency in (PHASE_DURATIONS[phase] ?? {}) ? urgency : 'standard';
    const totalMinutes = PHASE_DURATIONS[phase]?.[urgencyKey] ?? 0;
    const totalMs = totalMinutes * 60 * 1000;

    if (totalMs === 0) {
      return { remainingMs: 0, totalMs: 0, elapsedMs: 0, percentage: 100, label, remainingText: '' };
    }

    const updatedAtMs = new Date(updatedAt).getTime();
    const elapsedMs = Math.max(0, now - updatedAtMs);
    const remainingMs = Math.max(0, totalMs - elapsedMs);
    const percentage = Math.min(100, Math.round((elapsedMs / totalMs) * 100));

    const remainingText = formatRemainingTime(remainingMs);

    return { remainingMs, totalMs, elapsedMs, percentage, label, remainingText };
  }, [status, urgency, updatedAt, now]);
}

function formatRemainingTime(ms: number): string {
  if (ms < 60_000) {
    return 'Less than a minute';
  }

  const totalMinutes = Math.ceil(ms / 60_000);

  if (totalMinutes < 60) {
    return `${totalMinutes} min`;
  }

  if (totalMinutes < 1440) {
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return mins > 0 ? `${hours} hr ${mins} min` : `${hours} hr`;
  }

  const days = Math.floor(totalMinutes / 1440);
  const remainingHours = Math.floor((totalMinutes % 1440) / 60);
  return remainingHours > 0 ? `${days} day ${remainingHours} hr` : `${days} day`;
}

// ─── Progress Bar Color ──────────────────────────────────────────────────────

function progressBarColor(percentage: number): string {
  if (percentage > 80) return 'bg-nh-danger';
  if (percentage > 50) return 'bg-nh-warning';
  return 'bg-nh-success';
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function CustomerDashboard() {
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isTabVisible = useTabVisibility();

  const fetchOrders = useCallback(async () => {
    try {
      const response = await getMyOrders();
      setOrders(response.items);
      setError(null);
    } catch (err) {
      setError('Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch + visibility-aware polling every 10 seconds
  useEffect(() => {
    fetchOrders();

    if (!isTabVisible) return;

    const interval = setInterval(fetchOrders, 10000);
    return () => clearInterval(interval);
  }, [fetchOrders, isTabVisible]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" role="status">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-nh-primary" />
        <span className="sr-only">Loading...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-nh-danger mb-4">{error}</p>
        <button
          onClick={fetchOrders}
          className="text-nh-primary hover:underline focus:outline-none"
        >
          Try again
        </button>
      </div>
    );
  }

  const activeOrders = orders.filter((o) => !TERMINAL_STATUSES.includes(o.status));
  const pastOrders = orders.filter((o) => TERMINAL_STATUSES.includes(o.status));

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-nh-text mb-6">My Orders</h1>

      {/* Active Orders */}
      {activeOrders.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-nh-text-secondary mb-3">
            Active Orders ({activeOrders.length})
          </h2>
          <div className="space-y-3">
            {activeOrders.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>
        </section>
      )}

      {/* Past Orders */}
      {pastOrders.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-nh-text-secondary mb-3">
            Past Orders ({pastOrders.length})
          </h2>
          <div className="space-y-2">
            {pastOrders.map((order) => (
              <OrderCard key={order.id} order={order} compact />
            ))}
          </div>
        </section>
      )}

      {/* Empty State */}
      {orders.length === 0 && (
        <div className="text-center py-16">
          <div className="text-6xl mb-4">📋</div>
          <h2 className="text-xl font-semibold text-nh-text mb-2">No orders yet</h2>
          <p className="text-nh-text-secondary mb-6">Browse services and create your first order</p>
          <Link
            to="/explore"
            className="inline-block bg-nh-primary text-white px-6 py-2 rounded-lg hover:bg-nh-primary-hover transition"
          >
            Explore Services
          </Link>
        </div>
      )}
    </div>
  );
}

// ─── Order Card ──────────────────────────────────────────────────────────────

function OrderCard({ order, compact = false }: { order: OrderListItem; compact?: boolean }) {
  const statusColors = STATUS_COLORS[order.status] ?? {
    bg: 'bg-nh-surface-elevated',
    text: 'text-nh-text-muted',
  };
  const statusLabel = STATUS_LABELS[order.status] ?? order.status;

  const timeEstimate = useTimeEstimate(order.status, order.urgency, order.updatedAt);

  const isActive = !TERMINAL_STATUSES.includes(order.status);

  return (
    <Link
      to={`/orders/${order.id}`}
      className={`block bg-nh-surface rounded-lg border border-nh-border hover:border-nh-primary-hover transition-all duration-300 ${
        compact ? 'p-3' : 'p-4'
      } ${isActive ? 'animate-slide-in' : ''}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h3
            className={`font-medium text-nh-text truncate ${
              compact ? 'text-sm' : 'text-base'
            }`}
          >
            {order.serviceCatalog?.name || 'Service Order'}
          </h3>
          {!compact && order.matchedSummary?.package?.name && (
            <p className="text-sm text-nh-text-secondary mt-1">
              {order.matchedSummary.package.name}
            </p>
          )}
          {order.matchedSummary?.workspace?.name && (
            <p className="text-sm text-nh-text-secondary">
              Provider: {order.matchedSummary.workspace.name}
            </p>
          )}
          <p className="text-xs text-nh-text-muted mt-1">
            {new Date(order.createdAt).toLocaleDateString()}
          </p>
        </div>
        <div className="ml-3 flex flex-col items-end gap-1">
          <span
            className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors.bg} ${statusColors.text}`}
          >
            {statusLabel}
          </span>
          {isActive && timeEstimate.label && (
            <span className="text-xs text-nh-text-secondary font-medium">
              {timeEstimate.label}
            </span>
          )}
        </div>
      </div>

      {/* Progress Bar + Remaining Time (active orders only) */}
      {isActive && timeEstimate.totalMs > 0 && (
        <div className="mt-3 space-y-1">
          <div className="w-full bg-nh-surface-elevated rounded-full h-2 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 ease-linear ${progressBarColor(timeEstimate.percentage)}`}
              style={{ width: `${timeEstimate.percentage}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-nh-text-muted">
            <span>{timeEstimate.percentage}% completed</span>
            {timeEstimate.remainingText && (
              <span>{timeEstimate.remainingText} remaining</span>
            )}
          </div>
        </div>
      )}

      {/* Payment Info */}
      {!compact && order.payment && (
        <div className="mt-3 pt-3 border-t border-nh-border">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-nh-text-secondary">Payment:</span>
            <span className="font-medium text-nh-text">
              ${(order.payment.amount / 100).toFixed(2)}
            </span>
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                PAYMENT_STATUS_COLORS[order.payment.status] ?? 'bg-nh-surface-elevated text-nh-text-muted'
              }`}
            >
              {order.payment.status}
            </span>
            {order.payment.escrowReleaseAt && (
              <span className="text-xs text-nh-text-muted">
                Escrow release: {new Date(order.payment.escrowReleaseAt).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      )}
    </Link>
  );
}