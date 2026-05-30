import { useState, useEffect } from 'react'
import api from '../../lib/api'
import { Shield, Search, CheckCircle2, XCircle, Clock, RefreshCw, Building2, UserCheck, User } from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────

type KycTab = 'personal' | 'business' | 'level0'

type KycResponse<T> = {
  page: number
  pageSize: number
  total: number
  rows: T[]
}

// ── Component ──────────────────────────────────────────────────────────────

export default function AdminKyc() {
  const [tab, setTab] = useState<KycTab>('personal')
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [error, setError] = useState<string | null>(null)

  const fetchKyc = async () => {
    setLoading(true)
    setError(null)
    try {
      const params: Record<string, string> = {}
      if (statusFilter) params.status = statusFilter
      if (search) params.q = search

      let endpoint: string
      if (tab === 'personal') endpoint = '/admin/kyc/personal'
      else if (tab === 'business') endpoint = '/admin/kyc/business'
      else endpoint = '/admin/kyc/level0'

      const res = await api.get<KycResponse<any>>(endpoint, { params })
      setItems(res.data.rows ?? [])
    } catch (err: any) {
      setError(err?.response?.data?.error ?? err.message ?? 'Failed to load KYC submissions')
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchKyc() }, [tab, statusFilter])

  const filtered = search
    ? items.filter((k) => {
        const user = k.user ?? k
        const email = user.email ?? ''
        const name = user.displayName ?? user.declaredLegalName ?? ''
        const companyName = k.company?.name ?? ''
        return (
          email.toLowerCase().includes(search.toLowerCase()) ||
          name.toLowerCase().includes(search.toLowerCase()) ||
          companyName.toLowerCase().includes(search.toLowerCase())
        )
      })
    : items

  const statusBadge = (status: string) => {
    const map: Record<string, { color: string; icon: React.ReactNode }> = {
      approved: { color: 'text-[#0fc98a] bg-[#0fc98a]/10', icon: <CheckCircle2 className="h-3 w-3" /> },
      rejected: { color: 'text-[#ff4d4d] bg-[#ff4d4d]/10', icon: <XCircle className="h-3 w-3" /> },
      pending: { color: 'text-[#ffb800] bg-[#ffb800]/10', icon: <Clock className="h-3 w-3" /> },
      submitted: { color: 'text-[#2b6eff] bg-[#2b6eff]/10', icon: <Clock className="h-3 w-3" /> },
    }
    const s = map[status.toLowerCase()] ?? { color: 'text-[#6a6e88] bg-[#2a2f4a]/50', icon: <Clock className="h-3 w-3" /> }
    return (
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${s.color}`}>
        {s.icon}
        {status}
      </span>
    )
  }

  const tabs: { key: KycTab; label: string; icon: React.ReactNode }[] = [
    { key: 'personal', label: 'Personal', icon: <User className="h-4 w-4" /> },
    { key: 'business', label: 'Business', icon: <Building2 className="h-4 w-4" /> },
    { key: 'level0', label: 'Level 0', icon: <UserCheck className="h-4 w-4" /> },
  ]

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black text-[#f0f2ff]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            KYC Verification
          </h1>
          <p className="mt-1 text-sm text-[#6a6e88]">Identity verification submissions</p>
        </div>
        <button
          onClick={fetchKyc}
          className="flex items-center gap-2 rounded-xl border border-[#2a2f4a] bg-[#1e2235] px-4 py-2 text-sm text-[#f0f2ff] transition-all hover:border-[#2b6eff]"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-[#2a2f4a] bg-[#1a1d2e] p-1 w-fit">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setStatusFilter(''); setSearch('') }}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              tab === t.key
                ? 'bg-[#2b6eff] text-white'
                : 'text-[#6a6e88] hover:text-[#f0f2ff]'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#4a4f70]" />
          <input
            type="text"
            placeholder="Search by name, email, or company..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-[#2a2f4a] bg-[#1e2235] py-2.5 pl-10 pr-4 text-sm text-[#f0f2ff] placeholder-[#4a4f70] outline-none transition-all focus:border-[#2b6eff]"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-xl border border-[#2a2f4a] bg-[#1e2235] px-4 py-2.5 text-sm text-[#f0f2ff] outline-none transition-all focus:border-[#2b6eff]"
        >
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="submitted">Submitted</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {error && (
        <div className="rounded-2xl border border-[#ff4d4d]/30 bg-[#ff4d4d]/10 p-4 text-sm text-[#ff4d4d]">{error}</div>
      )}

      <div className="overflow-hidden rounded-2xl border border-[#2a2f4a] bg-[#1e2235]">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#2a2f4a] border-t-[#2b6eff]" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <Shield className="h-12 w-12 text-[#4a4f70]" />
            <p className="text-sm text-[#6a6e88]">No KYC submissions found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[#2a2f4a] bg-[#1a1d2e]">
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#6a6e88]">User</th>
                  {tab === 'business' && (
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#6a6e88]">Company</th>
                  )}
                  {tab === 'personal' && (
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#6a6e88]">Legal Name</th>
                  )}
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#6a6e88]">Status</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#6a6e88]">Submitted</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#6a6e88]">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2a2f4a]">
                {filtered.map((item: any) => {
                  const user = item.user ?? item
                  const displayName = user.displayName ?? user.declaredLegalName ?? user.email ?? '—'
                  const email = user.email ?? ''
                  const initial = (displayName[0] ?? '?').toUpperCase()

                  return (
                    <tr key={item.id} className="transition-colors hover:bg-[#1a1d2e]/50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#2b6eff]/10 text-[#2b6eff] text-sm font-bold">
                            {initial}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-[#f0f2ff]">{displayName}</p>
                            <p className="text-[11px] text-[#4a4f70]">{email}</p>
                          </div>
                        </div>
                      </td>
                      {tab === 'business' && (
                        <td className="px-4 py-3 text-sm text-[#6a6e88]">
                          {item.company?.name ?? '—'}
                        </td>
                      )}
                      {tab === 'personal' && (
                        <td className="px-4 py-3 text-sm text-[#6a6e88]">
                          {item.declaredLegalName ?? '—'}
                        </td>
                      )}
                      <td className="px-4 py-3">{statusBadge(item.status)}</td>
                      <td className="px-4 py-3 text-sm text-[#6a6e88]">
                        {new Date(item.submittedAt ?? item.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-[#6a6e88]">
                        {new Date(item.updatedAt).toLocaleDateString()}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
