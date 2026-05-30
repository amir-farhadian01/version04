import { useState, useEffect } from 'react'
import api from '../../lib/api'
import { FileText, Search, RefreshCw } from 'lucide-react'

type AdminContract = {
  id: string
  status: string
  createdAt: string
  updatedAt: string
  amount: number | null
  orderId: string
  customerId: string
  providerId: string
  order?: {
    id: string
    status: string
    serviceRequest?: { title: string }
  }
  customer?: { id: string; email: string; displayName: string | null }
  provider?: { id: string; email: string; displayName: string | null }
  versions?: Array<{
    id: string
    version: number
    status: string
    sentById: string | null
  }>
}

export default function AdminContracts() {
  const [contracts, setContracts] = useState<AdminContract[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)

  const fetchContracts = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.get<{ items: AdminContract[] }>('/admin/contracts/queue')
      setContracts(res.data.items ?? [])
    } catch (err: any) {
      setError(err?.response?.data?.error ?? err.message ?? 'Failed to load contracts')
      setContracts([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchContracts() }, [])

  const filtered = search
    ? contracts.filter((c) =>
        [c.id, c.orderId, c.customer?.email, c.provider?.email, c.order?.serviceRequest?.title]
          .filter(Boolean)
          .some((f) => f!.toLowerCase().includes(search.toLowerCase())),
      )
    : contracts

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black text-[#f0f2ff]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Contracts</h1>
          <p className="mt-1 text-sm text-[#6a6e88]">Manage service contracts between customers and providers</p>
        </div>
        <button onClick={fetchContracts} className="flex items-center gap-2 rounded-xl border border-[#2a2f4a] bg-[#1e2235] px-4 py-2 text-sm text-[#f0f2ff] transition-all hover:border-[#2b6eff]">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#4a4f70]" />
        <input type="text" placeholder="Search contracts..." value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-[#2a2f4a] bg-[#1e2235] py-2.5 pl-10 pr-4 text-sm text-[#f0f2ff] placeholder-[#4a4f70] outline-none transition-all focus:border-[#2b6eff]" />
      </div>

      {error && <div className="rounded-2xl border border-[#ff4d4d]/30 bg-[#ff4d4d]/10 p-4 text-sm text-[#ff4d4d]">{error}</div>}

      <div className="overflow-hidden rounded-2xl border border-[#2a2f4a] bg-[#1e2235]">
        {loading ? (
          <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-2 border-[#2a2f4a] border-t-[#2b6eff]" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <FileText className="h-12 w-12 text-[#4a4f70]" />
            <p className="text-sm text-[#6a6e88]">No contracts found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[#2a2f4a] bg-[#1a1d2e]">
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#6a6e88]">Contract</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#6a6e88]">Order</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#6a6e88]">Customer</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#6a6e88]">Provider</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#6a6e88]">Status</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#6a6e88]">Amount</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#6a6e88]">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2a2f4a]">
                {filtered.map((c) => (
                  <tr key={c.id} className="transition-colors hover:bg-[#1a1d2e]/50">
                    <td className="px-4 py-3 text-sm font-mono text-[#f0f2ff]">{c.id.slice(0, 8)}...</td>
                    <td className="px-4 py-3 text-sm text-[#6a6e88]">{c.order?.serviceRequest?.title ?? c.orderId.slice(0, 8) ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-[#6a6e88]">{c.customer?.displayName ?? c.customer?.email ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-[#6a6e88]">{c.provider?.displayName ?? c.provider?.email ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium bg-[#2a2f4a]/50 text-[#6a6e88]">{c.status}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-[#6a6e88]">{c.amount != null ? `$${c.amount.toLocaleString()}` : '—'}</td>
                    <td className="px-4 py-3 text-sm text-[#6a6e88]">{new Date(c.createdAt).toLocaleDateString()}</td>
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
