import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { OverviewTab } from './OverviewTab';
import { OrdersTab } from './OrdersTab';
import { MessagesTab } from './MessagesTab';
import { getMyOrders } from '../../services/orders';
import type { OrderListItem, MyOrdersResponse } from '../../services/orders';
import { cn } from '../../lib/cn';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'orders', label: 'Orders' },
  { id: 'messages', label: 'Messages' },
] as const;

type TabId = (typeof TABS)[number]['id'];

/**
 * ServicesPage — Client Services tab with Overview, Orders, Messages sub-tabs.
 * Route: /app/services
 */
export default function ServicesPage() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [facets, setFacets] = useState<MyOrdersResponse['facets'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const fetchOrders = useCallback(async () => {
    try {
      const res = await getMyOrders({ pageSize: 200 });
      setOrders(res.items);
      setFacets(res.facets ?? null);
      setError(null);
    } catch {
      setError('Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" role="status">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        <span className="sr-only">Loading...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 px-4">
        <p className="text-red-500 mb-4">{error}</p>
        <button
          onClick={fetchOrders}
          className="text-blue-600 hover:underline focus:outline-none"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full px-4 pt-4 pb-20">
      {/* Page Header */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-nh-text">Services</h1>
        <p className="text-sm text-nh-text-secondary mt-1">
          Track your orders and messages
        </p>
      </div>

      {/* Tab Bar */}
      <div className="flex border-b border-nh-border mb-4">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            className={cn(
              'relative px-4 py-3 text-sm font-medium transition-colors duration-200 focus:outline-none',
              activeTab === tab.id
                ? 'text-nh-primary'
                : 'text-nh-text-secondary hover:text-nh-text',
            )}
          >
            {tab.label}
            {activeTab === tab.id && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-nh-primary rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'overview' && (
          <OverviewTab
            orders={orders}
            facets={facets}
            onNavigate={(orderId) => navigate(`/orders/${orderId}`)}
            onCreateOrder={() => navigate('/order/new')}
          />
        )}
        {activeTab === 'orders' && (
          <OrdersTab
            orders={orders}
            onNavigate={(orderId) => navigate(`/orders/${orderId}`)}
          />
        )}
        {activeTab === 'messages' && (
          <MessagesTab
            onNavigate={(orderId) => navigate(`/orders/${orderId}`)}
          />
        )}
      </div>
    </div>
  );
}