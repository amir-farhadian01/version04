import { useState, useMemo } from 'react';
import type { OrderListItem, OrderStatus } from '../../services/orders';
import { NHCard } from '../../components/ui/NHCard';

interface OrdersTabProps {
  orders: OrderListItem[];
  onNavigate: (orderId: string) => void;
}

const TERMINAL_STATUSES: OrderStatus[] = ['completed', 'cancelled', 'closed'];

const STATUS_LABELS: Record<OrderStatus, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-700' },
  submitted: { label: 'Submitted', color: 'bg-blue-100 text-blue-700' },
  matching: { label: 'Matching', color: 'bg-yellow-100 text-yellow-700' },
  matched: { label: 'Matched', color: 'bg-green-100 text-green-700' },
  contracted: { label: 'Contracted', color: 'bg-purple-100 text-purple-700' },
  paid: { label: 'Paid', color: 'bg-indigo-100 text-indigo-700' },
  in_progress: { label: 'In Progress', color: 'bg-teal-100 text-teal-700' },
  completed: { label: 'Completed', color: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-700' },
  closed: { label: 'Closed', color: 'bg-gray-100 text-gray-700' },
};

type SegmentId = 'active' | 'completed';

/**
 * OrdersTab — Active orders list + Completed order history table.
 */
export function OrdersTab({ orders, onNavigate }: OrdersTabProps) {
  const [segment, setSegment] = useState<SegmentId>('active');

  const activeOrders = useMemo(
    () => orders.filter((o) => !TERMINAL_STATUSES.includes(o.status)),
    [orders],
  );

  const completedOrders = useMemo(
    () => orders.filter((o) => TERMINAL_STATUSES.includes(o.status)),
    [orders],
  );

  return (
    <div className="space-y-4">
      {/* Segment Toggle */}
      <div className="flex bg-nh-surface rounded-nh-card p-1 border border-nh-border">
        {([
          { id: 'active' as const, label: `Active (${activeOrders.length})` },
          { id: 'completed' as const, label: `Completed (${completedOrders.length})` },
        ]).map((seg) => (
          <button
            key={seg.id}
            onClick={() => setSegment(seg.id)}
            className={`flex-1 py-2 text-sm font-medium rounded-nh-btn transition-colors ${
              segment === seg.id
                ? 'bg-nh-primary text-white'
                : 'text-nh-text-secondary hover:text-nh-text'
            }`}
          >
            {seg.label}
          </button>
        ))}
      </div>

      {/* Active Orders */}
      {segment === 'active' && (
        <>
          {activeOrders.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-2">📦</div>
              <p className="text-nh-text-secondary text-sm">No active orders</p>
            </div>
          ) : (
            <div className="space-y-2">
              {activeOrders.map((order) => (
                <OrderCard key={order.id} order={order} onNavigate={onNavigate} />
              ))}
            </div>
          )}
        </>
      )}

      {/* Completed History Table */}
      {segment === 'completed' && (
        <>
          {completedOrders.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-2">📭</div>
              <p className="text-nh-text-secondary text-sm">No completed orders</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-nh-border text-nh-text-secondary">
                    <th className="text-left py-2 px-2 font-medium text-xs">Date</th>
                    <th className="text-left py-2 px-2 font-medium text-xs">Service</th>
                    <th className="text-left py-2 px-2 font-medium text-xs">Provider</th>
                    <th className="text-left py-2 px-2 font-medium text-xs">Staff</th>
                    <th className="text-right py-2 px-2 font-medium text-xs">Amount</th>
                    <th className="text-center py-2 px-2 font-medium text-xs">Invoice</th>
                  </tr>
                </thead>
                <tbody>
                  {completedOrders.map((order) => (
                      <tr
                        key={order.id}
                        className="border-b border-nh-border/50 hover:bg-nh-surface cursor-pointer transition-colors"
                        onClick={() => onNavigate(order.id)}
                      >
                        <td className="py-2 px-2 text-nh-text-secondary text-xs whitespace-nowrap">
                          {new Date(order.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-2 px-2 text-nh-text text-xs max-w-[120px] truncate">
                          {order.serviceCatalog?.name || 'Service Order'}
                        </td>
                        <td className="py-2 px-2 text-nh-text-secondary text-xs max-w-[100px] truncate">
                          {order.matchedSummary?.workspace?.name || '-'}
                        </td>
                        <td className="py-2 px-2 text-nh-text-secondary text-xs max-w-[100px] truncate">
                          {order.matchedSummary?.provider?.displayName ||
                            order.matchedSummary?.provider?.firstName ||
                            '-'}
                        </td>
                        <td className="py-2 px-2 text-nh-text text-xs text-right whitespace-nowrap">
                          {order.payment
                            ? `$${(order.payment.amount / 100).toFixed(2)}`
                            : '-'}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <span
                            className="text-xs text-nh-primary font-medium hover:underline cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              onNavigate(order.id);
                            }}
                          >
                            View
                          </span>
                        </td>
                      </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function OrderCard({
  order,
  onNavigate,
}: {
  order: OrderListItem;
  onNavigate: (id: string) => void;
}) {
  const statusInfo = STATUS_LABELS[order.status] ?? {
    label: order.status,
    color: 'bg-gray-100 text-gray-700',
  };

  return (
    <NHCard
      clickable
      className="p-3"
      onClick={() => onNavigate(order.id)}
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-nh-text truncate">
            {order.serviceCatalog?.name || 'Service Order'}
          </p>
          {order.matchedSummary?.workspace?.name && (
            <p className="text-xs text-nh-text-secondary mt-0.5">
              Provider: {order.matchedSummary.workspace.name}
            </p>
          )}
          <p className="text-xs text-nh-text-muted mt-0.5">
            {new Date(order.createdAt).toLocaleDateString()}
          </p>
        </div>
        <div className="ml-3 flex flex-col items-end gap-1">
          <span
            className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusInfo.color}`}
          >
            {statusInfo.label}
          </span>
          {order.payment && (
            <span className="text-xs font-medium text-nh-text">
              ${(order.payment.amount / 100).toFixed(2)}
            </span>
          )}
        </div>
      </div>
    </NHCard>
  );
}