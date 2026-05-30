import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../../lib/api'

interface InvoiceRow {
  id: string
  workspaceId: string
  customerId: string | null
  customer: { id: string; displayName: string; email: string; avatarUrl: string | null } | null
  orderId: string | null
  status: string
  lineItems: Array<{ description: string; quantity: number; unitPrice: number }>
  subtotal: number
  tax: number
  total: number
  dueDate: string | null
  sentAt: string | null
  paidAt: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-nh-surface-elevated text-nh-text-muted',
  SENT: 'bg-nh-primary/15 text-nh-primary',
  PAID: 'bg-nh-success/15 text-nh-success',
  OVERDUE: 'bg-nh-danger/15 text-nh-danger',
  CANCELLED: 'bg-nh-warning/15 text-nh-warning',
}

export default function Invoices() {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const navigate = useNavigate()
  const [invoices, setInvoices] = useState<InvoiceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [search, setSearch] = useState('')

  const fetchInvoices = () => {
    if (!workspaceId) return
    setLoading(true)
    setError(null)
    const params: Record<string, string | number> = { page, pageSize: 20 }
    if (statusFilter) params.status = statusFilter
    if (search.trim()) params.search = search.trim()
    api.get(`/workspace/${workspaceId}/invoices`, { params })
      .then((res) => {
        setInvoices(res.data.data ?? [])
        setTotalPages(Math.ceil((res.data.total ?? 0) / (res.data.pageSize ?? 20)))
      })
      .catch((err) => setError(err?.response?.data?.message ?? 'Failed to load invoices'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchInvoices() }, [workspaceId, page, statusFilter])

  const handleSearch = () => {
    setPage(1)
    fetchInvoices()
  }

  const formatCents = (cents: number) => {
    return '$' + (cents / 100).toFixed(2)
  }

  const formatDate = (iso: string | null) => {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const handleCreateInvoice = () => {
    navigate(`/business/${workspaceId}/invoices/new`)
  }

  const handleSendInvoice = async (id: string) => {
    try {
      await api.post(`/workspace/${workspaceId}/invoices/${id}/send`)
      fetchInvoices()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to send invoice'
      alert(msg)
    }
  }

  const handleMarkPaid = async (id: string) => {
    try {
      await api.put(`/workspace/${workspaceId}/invoices/${id}/mark-paid`)
      fetchInvoices()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to mark as paid'
      alert(msg)
    }
  }

  const handleCancel = async (id: string) => {
    if (!confirm('Cancel this invoice?')) return
    try {
      await api.delete(`/workspace/${workspaceId}/invoices/${id}`)
      fetchInvoices()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to cancel invoice'
      alert(msg)
    }
  }

  const handleDownloadPdf = (id: string) => {
    window.open(`/api/workspace/${workspaceId}/invoices/${id}/pdf`, '_blank')
  }

  return (
    <div className="min-h-screen bg-nh-bg">
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-nh-text">Invoices</h1>
            <p className="text-sm text-nh-text-secondary mt-1">Manage and track customer invoices</p>
          </div>
          <button
            onClick={handleCreateInvoice}
            className="px-4 py-2 bg-nh-primary text-white rounded-lg hover:bg-nh-primary-hover transition-colors text-sm font-medium"
          >
            + Create Invoice
          </button>
        </div>

        {/* Filters */}
        <div className="bg-nh-surface rounded-xl shadow-nh-card border border-nh-border p-4 mb-6">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex gap-2">
              {['', 'DRAFT', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED'].map((s) => (
                <button
                  key={s}
                  onClick={() => { setStatusFilter(s); setPage(1) }}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    statusFilter === s
                      ? 'bg-nh-primary text-white'
                      : 'bg-nh-surface-elevated text-nh-text-secondary hover:bg-nh-surface'
                  }`}
                >
                  {s || 'All'}
                </button>
              ))}
            </div>
            <div className="flex-1" />
            <div className="flex gap-2">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search by customer name or email..."
                className="px-3 py-1.5 border border-nh-border rounded-lg text-sm w-64 bg-nh-bg text-nh-text focus:outline-none focus:ring-2 focus:ring-nh-primary"
              />
              <button
                onClick={handleSearch}
                className="px-3 py-1.5 bg-nh-surface-elevated text-nh-text-secondary rounded-lg text-sm hover:bg-nh-surface"
              >
                Search
              </button>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-nh-danger/10 border border-nh-danger/20 text-nh-danger px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="text-center py-12 text-nh-text-muted">Loading invoices...</div>
        )}

        {/* Empty */}
        {!loading && !error && invoices.length === 0 && (
          <div className="text-center py-12 bg-nh-surface rounded-xl border border-nh-border">
            <p className="text-nh-text-secondary text-lg">No invoices found</p>
            <p className="text-nh-text-muted text-sm mt-1">Create your first invoice to get started</p>
          </div>
        )}

        {/* Invoice List */}
        {!loading && invoices.length > 0 && (
          <>
            {/* Summary stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              {['DRAFT', 'SENT', 'PAID', 'OVERDUE'].map((status) => {
                const count = invoices.filter((i) => i.status === status).length
                const total = invoices.filter((i) => i.status === status).reduce((s, i) => s + i.total, 0)
                return (
                  <div key={status} className="bg-nh-surface rounded-lg border border-nh-border p-3">
                    <p className="text-xs text-nh-text-muted uppercase tracking-wider">{status}</p>
                    <p className="text-lg font-bold text-nh-text">{count}</p>
                    <p className="text-xs text-nh-text-secondary">{formatCents(total)}</p>
                  </div>
                )
              })}
            </div>

            {/* Table */}
            <div className="bg-nh-surface rounded-xl shadow-nh-card border border-nh-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-nh-surface border-b border-nh-border">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-nh-text-secondary">Invoice #</th>
                      <th className="text-left px-4 py-3 font-medium text-nh-text-secondary">Customer</th>
                      <th className="text-left px-4 py-3 font-medium text-nh-text-secondary">Status</th>
                      <th className="text-right px-4 py-3 font-medium text-nh-text-secondary">Total</th>
                      <th className="text-left px-4 py-3 font-medium text-nh-text-secondary">Due Date</th>
                      <th className="text-left px-4 py-3 font-medium text-nh-text-secondary">Created</th>
                      <th className="text-right px-4 py-3 font-medium text-nh-text-secondary">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((inv) => (
                      <tr key={inv.id} className="border-b border-nh-border hover:bg-nh-surface">
                        <td className="px-4 py-3 font-mono text-xs text-nh-text-muted">
                          {inv.id.substring(0, 8)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {inv.customer?.avatarUrl && (
                              <img src={inv.customer.avatarUrl} alt="" className="w-6 h-6 rounded-full" />
                            )}
                            <span className="text-nh-text">{inv.customer?.displayName ?? '—'}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[inv.status] || 'bg-nh-surface-elevated text-nh-text-muted'}`}>
                            {inv.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-nh-text">
                          {formatCents(inv.total)}
                        </td>
                        <td className="px-4 py-3 text-nh-text-muted">
                          {formatDate(inv.dueDate)}
                        </td>
                        <td className="px-4 py-3 text-nh-text-muted">
                          {formatDate(inv.createdAt)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            {(inv.status === 'DRAFT' || inv.status === 'OVERDUE') && (
                              <button
                                onClick={() => handleSendInvoice(inv.id)}
                                className="px-2 py-1 text-xs bg-nh-primary/10 text-nh-primary rounded hover:bg-nh-primary/20"
                              >
                                Send
                              </button>
                            )}
                            {(inv.status === 'SENT' || inv.status === 'OVERDUE') && (
                              <button
                                onClick={() => handleMarkPaid(inv.id)}
                                className="px-2 py-1 text-xs bg-nh-success/10 text-nh-success rounded hover:bg-nh-success/20"
                              >
                                Paid
                              </button>
                            )}
                            <button
                              onClick={() => handleDownloadPdf(inv.id)}
                              className="px-2 py-1 text-xs bg-nh-purple/10 text-nh-purple rounded hover:bg-nh-purple/20"
                            >
                              PDF
                            </button>
                            {inv.status === 'DRAFT' && (
                              <button
                                onClick={() => handleCancel(inv.id)}
                                className="px-2 py-1 text-xs bg-nh-danger/10 text-nh-danger rounded hover:bg-nh-danger/20"
                              >
                                Cancel
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 text-sm border border-nh-border rounded-lg disabled:opacity-50 text-nh-text-secondary"
                >
                  Previous
                </button>
                <span className="text-sm text-nh-text-muted">Page {page} of {totalPages}</span>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 text-sm border border-nh-border rounded-lg disabled:opacity-50 text-nh-text-secondary"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}