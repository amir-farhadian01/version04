import { useState, useEffect } from 'react'
import api from '../../lib/api'
import { DollarSign, Search, RefreshCw } from 'lucide-react'

type PaymentRow = {
  orderId: string
  customerName: string
  providerName: string
  amount: number
  currency: string
  status: string
  date: string
  lastTransactionId: string
}

type PaymentsResponse = {
  items: PaymentRow[]
  page: number
  pageSize: number
  total: number
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-amber-500/20 text-amber-400',
  CAPTURED: 'bg-emerald-500/20 text-emerald-400',
  REFUNDED: 'bg-rose-500/20 text-rose-400',
  FAILED: 'bg-red-500/20 text-red-400',
}

function statusBadge(status: string) {
  const color = STATUS_COLORS[status.toLowerCase()] ?? 'bg-[#2a2f4a]/50 text-[#6a6e88]'
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${color}`}>
      {status}
    </span>
  )
}

export default function AdminPayments() {
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const pageSize = 20

  const fetchPayments = async (p = page) => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.get<PaymentsResponse>(`/admin/payments?page=${p}&pageSize=${pageSize}`)
      setPayments(res.data.items ?? [])
      setTotal(res.data.total ?? 0)
      setPage(res.data.page ?? p)
    } catch (err: any) {
      setError(err?.response?.data?.error ?? err.message ?? 'Failed to load payments')
      setPayments([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchPayments(1) }, [])

  const filtered = search
    ? payments.filter((p) =>
        [p.orderId, p.customerName, p.providerName, p.status]
          .filter(Boolean)
          .some((f) => f!.toLowerCase().includes(search.toLowerCase())),
      )
    : payments

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black text-[#f0f2ff]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Payments</h1>
          <p className="mt-1 text-sm text-[#6a6e88]">View payment transactions across all orders</p>
        </div>
        <button onClick={() => fetchPayments(page)} className="flex items-center gap-2 rounded-xl border border-[#2a2f4a] bg-[#1e2235] px-4 py-2 text-sm text-[#f0f2ff] transition-all hover:border-[#2b6eff]">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#4a4f70]" />
        <input type="text" placeholder="Search by order ID, customer, provider..." value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-[#2a2f4a] bg-[#1e2235] py-2.5 pl-10 pr-4 text-sm text-[#f0f2ff] placeholder-[#4a4f70] outline-none transition-all focus:border-[#2b6eff]" />
      </div>

      {error && <div className="rounded-2xl border border-[#ff4d4d]/30 bg-[#ff4d4d]/10 p-4 text-sm text-[#ff4d4d]">{error}</div>}

      <div className="overflow-hidden rounded-2xl border border-[#2a2f4a] bg-[#1e2235]">
        {loading ? (
          <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-2 border-[#2a2f4a] border-t-[#2b6eff]" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <DollarSign className="h-12 w-12 text-[#4a4f70]" />
            <p className="text-sm text-[#6a6e88]">No payments found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[#2a2f4a] bg-[#1a1d2e]">
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#6a6e88]">Order ID</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#6a6e88]">Customer</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#6a6e88]">Provider</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#6a6e88]">Amount</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#6a6e88]">Status</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#6a6e88]">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2a2f4a]">
                {filtered.map((p) => (
                  <tr key={p.orderId} className="transition-colors hover:bg-[#1a1d2e]/50">
                    <td className="px-4 py-3 text-sm font-mono text-[#f0f2ff]">{p.orderId.slice(0, 8)}...</td>
                    <td className="px-4 py-3 text-sm text-[#6a6e88]">{p.customerName || '—'}</td>
                    <td className="px-4 py-3 text-sm text-[#6a6e88]">{p.providerName || '—'}</td>
                    <td className="px-4 py-3 text-sm text-[#f0f2ff] font-mono">{p.currency} {p.amount.toLocaleString()}</td>
                    <td className="px-4 py-3">{statusBadge(p.status)}</td>
                    <td className="px-4 py-3 text-sm text-[#6a6e88]">{new Date(p.date).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button disabled={page <= 1} onClick={() => fetchPayments(page - 1)}
            className="rounded-lg border border-[#2a2f4a] bg-[#1e2235] px-3 py-1.5 text-sm text-[#f0f2ff] disabled:opacity-40 hover:border-[#2b6eff] transition-all">
            Previous
          </button>
          <span className="text-sm text-[#6a6e88]">Page {page} of {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => fetchPayments(page + 1)}
            className="rounded-lg border border-[#2a2f4a] bg-[#1e2235] px-3 py-1.5 text-sm text-[#f0f2ff] disabled:opacity-40 hover:border-[#2b6eff] transition-all">
            Next
          </button>
        </div>
      )}
    </div>
  )
}
