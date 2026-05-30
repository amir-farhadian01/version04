import { useState, useEffect } from 'react'
import api from '../lib/api'
import { ShoppingCart, Search, RefreshCw } from 'lucide-react'

type AdminOrder = {
  id: string
  status: string
  phase: string | null
  entryPoint: string
  address: string
  addressTruncated: string
  photoCount: number
  answersFieldCount: number
  createdAt: string
  updatedAt: string
  cancelledAt: string | null
  cancelReason: string | null
  matchedProviderName: string | null
  matchedWorkspaceName: string | null
  customer: {
    id: string
    displayName: string | null
    email: string
    avatarUrl: string | null
  }
  serviceCatalog: {
    id: string
    name: string
  }
}

export default function AdminOrders() {
  const [orders, setOrders] = useState<AdminOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)

  const fetchOrders = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.get<{ items: AdminOrder[]; total: number }>('/admin/orders')
      setOrders(res.data.items ?? [])
    } catch (err: any) {
      setError(err?.response?.data?.error ?? err.message ?? 'Failed to load orders')
      setOrders([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchOrders() }, [])

  const filtered = search
    ? orders.filter((o) =>
        [o.id, o.customer?.email, o.customer?.displayName, o.matchedProviderName, o.serviceCatalog?.name]
          .filter(Boolean)
          .some((f) => f!.toLowerCase().includes(search.toLowerCase())),
      )
    : orders

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      pending: 'text-nh-admin-warning bg-nh-admin-warning-bg',
      active: 'text-nh-admin-primary bg-nh-admin-primary-bg',
      completed: 'text-nh-admin-success bg-nh-admin-success-bg',
      cancelled: 'text-nh-admin-danger bg-nh-admin-danger-bg',
      disputed: 'text-nh-admin-danger bg-nh-admin-danger-bg',
    }
    const c = map[status.toLowerCase()] ?? 'text-nh-admin-text-secondary bg-nh-admin-border'
    return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${c}`}>{status}</span>
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black text-nh-admin-text">Orders</h1>
          <p className="mt-1 text-sm text-nh-admin-text-secondary">Monitor and manage all platform orders</p>
        </div>
        <button onClick={fetchOrders} className="flex items-center gap-2 rounded-xl border border-nh-admin-border bg-nh-admin-surface px-4 py-2 text-sm text-nh-admin-text transition-all hover:border-nh-admin-primary">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-nh-admin-text-muted" />
        <input type="text" placeholder="Search orders..." value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-nh-admin-border bg-nh-admin-surface py-2.5 pl-10 pr-4 text-sm text-nh-admin-text placeholder-nh-admin-text-muted outline-none transition-all focus:border-nh-admin-primary-border" />
      </div>

      {error && <div className="rounded-2xl border border-nh-admin-danger/30 bg-nh-admin-danger-bg p-4 text-sm text-nh-admin-danger">{error}</div>}

      <div className="overflow-hidden rounded-2xl border border-nh-admin-border bg-nh-admin-surface">
        {loading ? (
          <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-2 border-nh-admin-border border-t-nh-admin-primary" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <ShoppingCart className="h-12 w-12 text-nh-admin-text-muted" />
            <p className="text-sm text-nh-admin-text-secondary">No orders found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-nh-admin-border bg-nh-admin-surface-elevated">
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-nh-admin-text-secondary">Order ID</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-nh-admin-text-secondary">Service</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-nh-admin-text-secondary">Customer</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-nh-admin-text-secondary">Provider</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-nh-admin-text-secondary">Status</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-nh-admin-text-secondary">Phase</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-nh-admin-text-secondary">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-nh-admin-border">
                {filtered.map((order) => (
                  <tr key={order.id} className="transition-colors hover:bg-nh-admin-surface-hover">
                    <td className="px-4 py-3 text-sm font-mono text-nh-admin-text">{order.id.slice(0, 8)}...</td>
                    <td className="px-4 py-3 text-sm text-nh-admin-text">{order.serviceCatalog?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-nh-admin-text-secondary">{order.customer?.displayName ?? order.customer?.email ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-nh-admin-text-secondary">{order.matchedProviderName ?? order.matchedWorkspaceName ?? '—'}</td>
                    <td className="px-4 py-3">{statusBadge(order.status)}</td>
                    <td className="px-4 py-3 text-sm text-nh-admin-text-secondary">{order.phase}</td>
                    <td className="px-4 py-3 text-sm text-nh-admin-text-secondary">{new Date(order.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
