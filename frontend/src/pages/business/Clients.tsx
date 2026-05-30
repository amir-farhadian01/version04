import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../../lib/api'
import { StatusBar } from '../../components/ui/phone/StatusBar'
import { BottomNav, NavIcons } from '../../components/ui/phone/BottomNav'

interface CustomerRow {
  userId: string
  displayName: string | null
  firstName: string | null
  lastName: string | null
  avatarUrl: string | null
  email: string
  phone: string | null
  totalOrders: number
  totalSpent: number
  completedOrders: number
  lastOrderDate: string | null
}

export default function Clients() {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const navigate = useNavigate()
  const [customers, setCustomers] = useState<CustomerRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  const fetchCustomers = () => {
    if (!workspaceId) return
    setLoading(true)
    const params: Record<string, string | number> = { page, limit: 20 }
    if (search.trim()) params.search = search.trim()
    api.get(`/workspace/${workspaceId}/crm/customers`, { params })
      .then((res) => {
        setCustomers(res.data.customers ?? [])
        setTotalPages(res.data.totalPages ?? 1)
      })
      .catch((err) => setError(err?.response?.data?.error ?? 'Failed to load customers'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchCustomers() }, [workspaceId, page])

  const handleSearch = () => {
    setPage(1)
    fetchCustomers()
  }

  const formatCurrency = (cents: number) => {
    return '$' + (cents / 100).toFixed(2)
  }

  const formatDate = (iso: string | null) => {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <div className="relative h-full flex flex-col bg-nh-bg">
      <StatusBar title="9:41" showNotifDot />

      {/* Header */}
      <div className="bg-nh-bg px-[18px] py-[14px] border-b border-nh-border">
        <div className="flex items-center gap-3">
          <div onClick={() => navigate(`/business/${workspaceId}`)} className="cursor-pointer">
            <svg width="22" height="22" viewBox="0 0 24 24" className="fill-nh-text">
              <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
            </svg>
          </div>
          <div className="flex-1">
            <div className="font-heading text-lg font-bold text-nh-text">My Clients</div>
            <div className="text-xs text-nh-text-muted mt-0.5">{customers.length} customer{customers.length !== 1 ? 's' : ''}</div>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="px-[14px] py-2.5">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Search customers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="flex-1 px-[14px] py-2.5 rounded-[10px] border border-nh-border bg-nh-surface text-nh-text text-[13px] outline-none"
          />
          <button onClick={handleSearch} className="px-4 py-2.5 rounded-[10px] border-0 bg-nh-primary text-white text-[13px] font-semibold cursor-pointer">
            Search
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mx-[14px] mb-2.5 px-[14px] py-2.5 rounded-[10px] bg-nh-danger/15 text-nh-danger text-xs">{error}</div>
      )}

      {/* Customer List */}
      <div className="flex-1 overflow-y-auto scrollbar-none px-[14px]">
        {loading ? (
          <div className="text-center py-10 text-[13px] text-nh-text-muted">Loading customers...</div>
        ) : customers.length === 0 ? (
          <div className="text-center py-10 text-[13px] text-nh-text-muted">
            {search.trim() ? 'No customers match your search.' : 'No customers yet. Orders will appear here once customers start booking.'}
          </div>
        ) : (
          customers.map((c) => (
            <div
              key={c.userId}
              onClick={() => navigate(`/business/${workspaceId}/clients/${c.userId}`)}
              className="bg-nh-surface rounded-xl p-3 mb-2 flex items-center gap-2.5 border border-nh-border cursor-pointer"
            >
              {/* Avatar */}
              <div className="w-10 h-10 rounded-full bg-nh-surface-elevated flex items-center justify-center text-sm font-semibold text-nh-text-secondary overflow-hidden shrink-0">
                {c.avatarUrl ? (
                  <img src={c.avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  (c.firstName?.[0] ?? c.displayName?.[0] ?? '?').toUpperCase()
                )}
              </div>
              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold text-nh-text">
                  {c.displayName ?? `${c.firstName ?? ''} ${c.lastName ?? ''}`}
                </div>
                <div className="text-[11px] text-nh-text-muted mt-0.5">{c.email}</div>
                <div className="flex gap-3 mt-1 text-[11px] text-nh-text-secondary">
                  <span>{c.totalOrders} order{c.totalOrders !== 1 ? 's' : ''}</span>
                  <span>{formatCurrency(c.totalSpent)}</span>
                  <span>Last: {formatDate(c.lastOrderDate)}</span>
                </div>
              </div>
              {/* Chevron */}
              <svg width="16" height="16" viewBox="0 0 24 24" className="fill-nh-text-muted">
                <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
              </svg>
            </div>
          ))
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center gap-2 py-[14px]">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className={`px-[14px] py-1.5 rounded-lg border border-nh-border bg-nh-surface text-xs ${page <= 1 ? 'text-nh-text-muted cursor-default' : 'text-nh-text cursor-pointer'}`}
            >
              Previous
            </button>
            <span className="text-xs text-nh-text-muted self-center">Page {page} of {totalPages}</span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className={`px-[14px] py-1.5 rounded-lg border border-nh-border bg-nh-surface text-xs font-bold ${page >= totalPages ? 'text-nh-text-muted cursor-default' : 'text-nh-text cursor-pointer'}`}
            >
              Next
            </button>
          </div>
        )}

        <div className="h-[100px]" />
      </div>

      {/* Bottom Nav */}
      <div className="absolute left-0 right-0 bottom-6 z-50">
        <BottomNav
          items={[
            { id: 'home', label: 'Home', icon: NavIcons.home },
            { id: 'social', label: 'Social', icon: NavIcons.social },
            { id: 'activity', label: 'Activity', icon: NavIcons.activity },
            { id: 'biz', label: 'Business', isBiz: true, active: true, icon: NavIcons.business },
          ]}
        />
      </div>
    </div>
  )
}