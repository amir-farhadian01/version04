import { useState, useEffect } from 'react'
import api from '../../lib/api'
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
      pending: 'text-[#ffb800] bg-[#ffb800]/10',
      active: 'text-[#2b6eff] bg-[#2b6eff]/10',
      completed: 'text-[#0fc98a] bg-[#0fc98a]/10',
      cancelled: 'text-[#ff4d4d] bg-[#ff4d4d]/10',
      disputed: 'text-[#ff4d4d] bg-[#ff4d4d]/10',
    }
    const c = map[status.toLowerCase()] ?? 'text-[#6a6e88] bg-[#2a2f4a]/50'
    return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${c}`}>{status}</span>
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black text-[#f0f2ff]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Orders</h1>
          <p className="mt-1 text-sm text-[#6a6e88]">Monitor and manage all platform orders</p>
        </div>
        <button onClick={fetchOrders} className="flex items-center gap-2 rounded-xl border border-[#2a2f4a] bg-[#1e2235] px-4 py-2 text-sm text-[#f0f2ff] transition-all hover:border-[#2b6eff]">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#4a4f70]" />
        <input type="text" placeholder="Search orders..." value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-[#2a2f4a] bg-[#1e2235] py-2.5 pl-10 pr-4 text-sm text-[#f0f2ff] placeholder-[#4a4f70] outline-none transition-all focus:border-[#2b6eff]" />
      </div>

      {error && <div className="rounded-2xl border border-[#ff4d4d]/30 bg-[#ff4d4d]/10 p-4 text-sm text-[#ff4d4d]">{error}</div>}

      <div className="overflow-hidden rounded-2xl border border-[#2a2f4a] bg-[#1e2235]">
        {loading ? (
          <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-2 border-[#2a2f4a] border-t-[#2b6eff]" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <ShoppingCart className="h-12 w-12 text-[#4a4f70]" />
            <p className="text-sm text-[#6a6e88]">No orders found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[#2a2f4a] bg-[#1a1d2e]">
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#6a6e88]">Order ID</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#6a6e88]">Service</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#6a6e88]">Customer</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#6a6e88]">Provider</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#6a6e88]">Status</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#6a6e88]">Phase</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#6a6e88]">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2a2f4a]">
                {filtered.map((order) => (
                  <tr key={order.id} className="transition-colors hover:bg-[#1a1d2e]/50">
                    <td className="px-4 py-3 text-sm font-mono text-[#f0f2ff]">{order.id.slice(0, 8)}...</td>
                    <td className="px-4 py-3 text-sm text-[#f0f2ff]">{order.serviceCatalog?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-[#6a6e88]">{order.customer?.displayName ?? order.customer?.email ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-[#6a6e88]">{order.matchedProviderName ?? order.matchedWorkspaceName ?? '—'}</td>
                    <td className="px-4 py-3">{statusBadge(order.status)}</td>
                    <td className="px-4 py-3 text-sm text-[#6a6e88]">{order.phase}</td>
                    <td className="px-4 py-3 text-sm text-[#6a6e88]">{new Date(order.createdAt).toLocaleDateString()}</td>
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
