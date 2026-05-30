import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../../lib/api'
import { StatusBar } from '../../components/ui/phone/StatusBar'
import { BottomNav, NavIcons } from '../../components/ui/phone/BottomNav'

interface CustomerDetail {
  customer: {
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
  orderHistory: Array<{
    id: string
    title: string
    status: string
    total: number
    createdAt: string
    serviceName: string | null
  }>
  reviews: Array<{
    id: string
    rating: number
    comment: string | null
    createdAt: string
  }>
  notes: Array<{
    id: string
    content: string
    authorName: string | null
    createdAt: string
    updatedAt: string
    archivedAt: string | null
  }>
}

const orderStatusColor = (status: string): string => {
  switch (status) {
    case 'draft': return 'text-nh-text-muted'
    case 'submitted': return 'text-nh-warning'
    case 'matched': return 'text-nh-primary'
    case 'contracted': return 'text-nh-purple'
    case 'in_progress': return 'text-nh-primary'
    case 'completed': return 'text-nh-success'
    case 'disputed': return 'text-nh-danger'
    case 'cancelled': return 'text-nh-text-muted'
    default: return 'text-nh-text-muted'
  }
}

export default function ClientDetail() {
  const { workspaceId, customerId } = useParams<{ workspaceId: string; customerId: string }>()
  const navigate = useNavigate()
  const [data, setData] = useState<CustomerDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [noteText, setNoteText] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [activeTab, setActiveTab] = useState<'orders' | 'notes' | 'reviews'>('orders')

  const fetchDetail = () => {
    if (!workspaceId || !customerId) return
    setLoading(true)
    api.get(`/workspace/${workspaceId}/crm/customers/${customerId}`)
      .then((res) => setData(res.data))
      .catch((err) => setError(err?.response?.data?.error ?? 'Failed to load customer details'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchDetail() }, [workspaceId, customerId])

  const handleAddNote = async () => {
    if (!workspaceId || !customerId || !noteText.trim()) return
    setSavingNote(true)
    try {
      await api.post(`/workspace/${workspaceId}/crm/customers/${customerId}/notes`, {
        content: noteText.trim(),
      })
      setNoteText('')
      fetchDetail()
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to save note')
    } finally {
      setSavingNote(false)
    }
  }

  const handleDeleteNote = async (noteId: string) => {
    if (!workspaceId) return
    try {
      await api.delete(`/workspace/${workspaceId}/crm/notes/${noteId}`)
      fetchDetail()
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to delete note')
    }
  }

  const formatCurrency = (cents: number) => {
    return '$' + (cents / 100).toFixed(2)
  }

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const customer = data?.customer

  return (
    <div className="relative h-full flex flex-col bg-nh-bg">
      <StatusBar title="9:41" showNotifDot />

      {/* Header */}
      <div className="bg-nh-bg px-[18px] py-[14px] border-b border-nh-border">
        <div className="flex items-center gap-3">
          <div onClick={() => navigate(`/business/${workspaceId}/clients`)} className="cursor-pointer">
            <svg width="22" height="22" viewBox="0 0 24 24" className="fill-nh-text">
              <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
            </svg>
          </div>
          <div className="flex-1">
            <div className="font-heading text-lg font-bold text-nh-text">Client Details</div>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mx-[14px] mt-2.5 px-[14px] py-2.5 rounded-[10px] bg-nh-danger/15 text-nh-danger text-xs">{error}</div>
      )}

      <div className="flex-1 overflow-y-auto scrollbar-none">
        {loading ? (
          <div className="text-center py-10 text-[13px] text-nh-text-muted">Loading customer details...</div>
        ) : !customer ? (
          <div className="text-center py-10 text-[13px] text-nh-text-muted">Customer not found.</div>
        ) : (
          <>
            {/* Customer Info Card */}
            <div className="p-[14px]">
              <div className="bg-nh-surface rounded-[14px] p-4 border border-nh-border">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-nh-surface-elevated flex items-center justify-center text-lg font-semibold text-nh-text-secondary overflow-hidden shrink-0">
                    {customer.avatarUrl ? (
                      <img src={customer.avatarUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      (customer.firstName?.[0] ?? customer.displayName?.[0] ?? '?').toUpperCase()
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="text-base font-bold text-nh-text font-heading">
                      {customer.displayName ?? `${customer.firstName ?? ''} ${customer.lastName ?? ''}`}
                    </div>
                    <div className="text-xs text-nh-text-muted mt-0.5">{customer.email}</div>
                    {customer.phone && <div className="text-xs text-nh-text-muted">{customer.phone}</div>}
                  </div>
                </div>

                {/* Stats Row */}
                <div className="flex gap-4 mt-[14px] pt-[14px] border-t border-nh-border">
                  <div className="flex-1 text-center">
                    <div className="text-lg font-bold text-nh-text">{customer.totalOrders}</div>
                    <div className="text-[10px] text-nh-text-muted mt-0.5">Orders</div>
                  </div>
                  <div className="flex-1 text-center">
                    <div className="text-lg font-bold text-nh-success">{formatCurrency(customer.totalSpent)}</div>
                    <div className="text-[10px] text-nh-text-muted mt-0.5">Total Spent</div>
                  </div>
                  <div className="flex-1 text-center">
                    <div className="text-lg font-bold text-nh-primary">{customer.completedOrders}</div>
                    <div className="text-[10px] text-nh-text-muted mt-0.5">Completed</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-nh-border mx-[14px]">
              {(['orders', 'notes', 'reviews'] as const).map((tab) => (
                <div
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-2.5 text-center text-xs font-semibold cursor-pointer capitalize border-b-2 ${
                    activeTab === tab ? 'text-nh-primary border-nh-primary' : 'text-nh-text-muted border-transparent'
                  }`}
                >
                  {tab}
                  {tab === 'notes' && data.notes.length > 0 && (
                    <span className="ml-1 text-[10px] text-nh-text-muted">({data.notes.length})</span>
                  )}
                </div>
              ))}
            </div>

            {/* Tab Content */}
            <div className="px-[14px]">
              {/* Orders Tab */}
              {activeTab === 'orders' && (
                <div>
                  {data.orderHistory.length === 0 ? (
                    <div className="text-center py-[30px] text-xs text-nh-text-muted">No orders yet.</div>
                  ) : (
                    data.orderHistory.map((order) => (
                      <div key={order.id} className="bg-nh-surface rounded-xl p-3 mt-2 border border-nh-border">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="text-[13px] font-semibold text-nh-text">{order.title}</div>
                            {order.serviceName && (
                              <div className="text-[11px] text-nh-text-muted mt-0.5">{order.serviceName}</div>
                            )}
                            <div className="text-[11px] text-nh-text-muted mt-0.5">{formatDate(order.createdAt)}</div>
                          </div>
                          <div className="text-right ml-3">
                            <div className="text-sm font-bold text-nh-text">{formatCurrency(order.total)}</div>
                            <div className={`text-[10px] font-semibold mt-0.5 capitalize ${orderStatusColor(order.status)}`}>
                              {order.status.replace(/_/g, ' ')}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Notes Tab */}
              {activeTab === 'notes' && (
                <div>
                  {/* Add Note */}
                  <div className="mt-2.5">
                    <textarea
                      placeholder="Add an internal note about this customer..."
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      rows={3}
                      className="w-full px-[14px] py-2.5 rounded-[10px] border border-nh-border bg-nh-surface text-nh-text text-xs outline-none resize-y font-inherit box-border"
                    />
                    <button
                      onClick={handleAddNote}
                      disabled={savingNote || !noteText.trim()}
                      className={`mt-2 px-[18px] py-2 rounded-lg border-0 text-xs font-semibold ${!noteText.trim() ? 'bg-nh-border text-nh-text-muted cursor-default' : 'bg-nh-primary text-white cursor-pointer'}`}
                    >
                      {savingNote ? 'Saving...' : 'Add Note'}
                    </button>
                  </div>

                  {/* Notes List */}
                  <div className="mt-2.5">
                    {data.notes.length === 0 ? (
                      <div className="text-center py-5 text-xs text-nh-text-muted">No internal notes yet.</div>
                    ) : (
                      data.notes.map((note) => (
                        <div key={note.id} className={`bg-nh-surface rounded-xl p-3 mt-2 border border-nh-border ${note.archivedAt ? 'opacity-50' : ''}`}>
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="text-xs text-nh-text whitespace-pre-wrap leading-relaxed">{note.content}</div>
                              <div className="text-[10px] text-nh-text-muted mt-1.5">
                                {note.authorName ?? 'Unknown'} · {formatDate(note.createdAt)}
                                {note.updatedAt !== note.createdAt && ' (edited)'}
                              </div>
                            </div>
                            {!note.archivedAt && (
                              <button
                                onClick={() => handleDeleteNote(note.id)}
                                className="bg-transparent border-0 text-nh-danger text-[11px] cursor-pointer px-1.5 py-0.5 shrink-0"
                                title="Delete note"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Reviews Tab */}
              {activeTab === 'reviews' && (
                <div>
                  {data.reviews.length === 0 ? (
                    <div className="text-center py-[30px] text-xs text-nh-text-muted">No reviews yet.</div>
                  ) : (
                    data.reviews.map((review) => (
                      <div key={review.id} className="bg-nh-surface rounded-xl p-3 mt-2 border border-nh-border">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm">{'⭐'.repeat(review.rating)}</span>
                          <span className="text-[11px] text-nh-text-muted">{formatDate(review.createdAt)}</span>
                        </div>
                        {review.comment && (
                          <div className="text-xs text-nh-text-secondary mt-1.5 leading-relaxed">{review.comment}</div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="h-[100px]" />
          </>
        )}
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