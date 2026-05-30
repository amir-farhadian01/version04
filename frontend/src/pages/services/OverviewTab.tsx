import type { OrderListItem, MyOrdersResponse } from '../../services/orders';
import { NHCard } from '../../components/ui/NHCard';

interface OverviewTabProps {
  orders: OrderListItem[];
  facets: MyOrdersResponse['facets'] | null;
  onNavigate: (orderId: string) => void;
  onCreateOrder: () => void;
}

const TERMINAL_STATUSES = new Set(['completed', 'cancelled', 'closed']);

function countByStatus(orders: OrderListItem[], statuses: string[]): number {
  return orders.filter((o) => statuses.includes(o.status)).length;
}

/**
 * OverviewTab — Stats cards for client services (Orders Placed, Completed, Cancelled, Active).
 */
export function OverviewTab({ orders, facets, onNavigate, onCreateOrder }: OverviewTabProps) {
  const active = orders.filter((o) => !TERMINAL_STATUSES.has(o.status));
  const completed = countByStatus(orders, ['completed', 'closed']);
  const cancelled = countByStatus(orders, ['cancelled']);
  const total = orders.length;

  const stats = [
    { label: 'Orders Placed', value: total, icon: '📋', color: 'text-nh-primary' },
    { label: 'Active', value: active.length, icon: '🔄', color: 'text-yellow-400' },
    { label: 'Completed', value: completed, icon: '✅', color: 'text-green-400' },
    { label: 'Cancelled', value: cancelled, icon: '❌', color: 'text-red-400' },
  ];

  return (
    <div className="space-y-4">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        {stats.map((stat) => (
          <NHCard key={stat.label} className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{stat.icon}</span>
              <span className="text-xs font-medium text-nh-text-secondary uppercase tracking-wide">
                {stat.label}
              </span>
            </div>
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
          </NHCard>
        ))}
      </div>

      {/* Phase Facets */}
      {facets?.phase && (
        <NHCard className="p-4">
          <h3 className="text-sm font-semibold text-nh-text mb-3">Order Pipeline</h3>
          <div className="space-y-2">
            <FacetRow label="Offers" count={facets.phase.offer} total={total} color="bg-nh-primary" />
            <FacetRow label="Orders" count={facets.phase.order} total={total} color="bg-yellow-500" />
            <FacetRow label="Jobs" count={facets.phase.job} total={total} color="bg-green-500" />
            {facets.phase.cancelledOffer + facets.phase.cancelledOrder + facets.phase.cancelledJob > 0 && (
              <FacetRow
                label="Cancelled"
                count={facets.phase.cancelledOffer + facets.phase.cancelledOrder + facets.phase.cancelledJob}
                total={total}
                color="bg-red-500"
              />
            )}
          </div>
        </NHCard>
      )}

      {/* Quick Actions */}
      <NHCard className="p-4">
        <h3 className="text-sm font-semibold text-nh-text mb-3">Quick Actions</h3>
        <div className="space-y-2">
          <button
            onClick={onCreateOrder}
            className="w-full text-left px-4 py-3 rounded-nh-btn bg-nh-primary text-white text-sm font-medium hover:bg-nh-primary-hover transition-colors"
          >
            + Create New Order
          </button>
          {active.length > 0 && (
            <button
              onClick={() => onNavigate(active[0].id)}
              className="w-full text-left px-4 py-3 rounded-nh-btn bg-nh-surface border border-nh-border text-nh-text text-sm font-medium hover:border-nh-primary/30 transition-colors"
            >
              View Active Orders ({active.length})
            </button>
          )}
        </div>
      </NHCard>

      {/* Recent Orders */}
      {active.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-nh-text mb-2">
            Recent Active Orders
          </h3>
          <div className="space-y-2">
            {active.slice(0, 3).map((order) => (
              <NHCard
                key={order.id}
                clickable
                className="p-3"
                onClick={() => onNavigate(order.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-nh-text truncate">
                      {order.serviceCatalog?.name || 'Service Order'}
                    </p>
                    <p className="text-xs text-nh-text-secondary mt-0.5">
                      {new Date(order.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="ml-3 px-2 py-0.5 rounded-full text-xs font-medium bg-nh-primary/20 text-nh-primary">
                    {order.status}
                  </span>
                </div>
              </NHCard>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {total === 0 && (
        <div className="text-center py-8">
          <div className="text-5xl mb-3">📭</div>
          <p className="text-nh-text-secondary text-sm mb-1">No orders yet</p>
          <p className="text-nh-text-muted text-xs mb-4">
            Create your first service order to get started
          </p>
          <button
            onClick={onCreateOrder}
            className="inline-flex items-center px-5 py-2.5 rounded-nh-btn bg-nh-primary text-white text-sm font-semibold hover:bg-nh-primary-hover transition-colors"
          >
            Create New Order
          </button>
        </div>
      )}
    </div>
  );
}

function FacetRow({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-nh-text-secondary w-16">{label}</span>
      <div className="flex-1 h-2 bg-nh-surface rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-medium text-nh-text w-8 text-right">{count}</span>
    </div>
  );
}