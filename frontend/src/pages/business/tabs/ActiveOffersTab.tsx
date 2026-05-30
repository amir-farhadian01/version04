import { useState } from 'react'
import api from '../../../lib/api'

interface ActiveOffer {
  id: string
  title: string
  description: string | null
  customerName: string
  customerAvatarUrl: string | null
  serviceName: string
  budget: number | null
  status: string
  phase: string
  scheduledAt: string | null
  matchingExpiresAt: string | null
  createdAt: string
  workspaceId: string
}

interface Props {
  offers: ActiveOffer[]
  loading: boolean
  error: string | null
  onRefresh: () => void
}

export default function ActiveOffersTab({ offers, loading, error, onRefresh }: Props) {
  const [actionState, setActionState] = useState<Record<string, 'accepting' | 'declining'>>({})
  const [declineOrderId, setDeclineOrderId] = useState<string | null>(null)
  const [declineReason, setDeclineReason] = useState('')

  const formatCurrency = (cents: number | null) => {
    if (cents == null) return '—'
    return '$' + (cents / 100).toFixed(2)
  }

  const formatDate = (iso: string | null) => {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const formatExpiry = (iso: string | null) => {
    if (!iso) return null
    const diff = new Date(iso).getTime() - Date.now()
    if (diff <= 0) return 'Expired'
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `${mins}m remaining`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ${mins % 60}m remaining`
    const days = Math.floor(hours / 24)
    return `${days}d remaining`
  }

  const handleAccept = async (orderId: string) => {
    setActionState((p) => ({ ...p, [orderId]: 'accepting' }))
    try {
      await api.post(`/orders/${orderId}/accept-invite`, { accepted: true })
      onRefresh()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to accept'
      alert(msg)
    } finally {
      setActionState((p) => ({ ...p, [orderId]: undefined as unknown as 'accepting' | 'declining' }))
    }
  }

  const handleDecline = async (orderId: string) => {
    if (!declineReason.trim() || declineReason.length < 5) {
      alert('Please provide a reason (at least 5 characters)')
      return
    }
    setActionState((p) => ({ ...p, [orderId]: 'declining' }))
    try {
      await api.post(`/orders/${orderId}/accept-invite`, { accepted: false, declineReason: declineReason.trim() })
      setDeclineOrderId(null)
      setDeclineReason('')
      onRefresh()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to decline'
      alert(msg)
    } finally {
      setActionState((p) => ({ ...p, [orderId]: undefined as unknown as 'accepting' | 'declining' }))
    }
  }

  const openDeclineDialog = (orderId: string) => {
    setDeclineOrderId(orderId)
    setDeclineReason('')
  }

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
        Loading active offers...
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ margin: 14, padding: 14, borderRadius: 10, background: 'rgba(255,59,48,0.15)', color: 'var(--red)', fontSize: 12 }}>
        {error}
      </div>
    )
  }

  if (offers.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
        <div style={{ fontWeight: 600, color: 'var(--text2)', marginBottom: 4 }}>No active offers</div>
        <div>When customers submit orders, offers will appear here.</div>
      </div>
    )
  }

  return (
    <div style={{ paddingBottom: 40 }}>
      {offers.map((offer) => {
        const expiry = formatExpiry(offer.matchingExpiresAt)
        const isExpired = expiry === 'Expired'
        const acting = actionState[offer.id]

        return (
          <div
            key={offer.id}
            style={{
              background: 'var(--card)',
              borderRadius: 14,
              padding: 14,
              margin: '8px 14px',
              border: '1px solid var(--border)',
              opacity: isExpired ? 0.6 : 1,
            }}
          >
            {/* Customer Info Row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  background: 'var(--bg3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 14,
                  fontWeight: 600,
                  color: 'var(--text2)',
                  overflow: 'hidden',
                  flexShrink: 0,
                }}
              >
                {offer.customerAvatarUrl ? (
                  <img src={offer.customerAvatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  (offer.customerName?.[0] ?? '?').toUpperCase()
                )}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{offer.customerName}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                  {offer.serviceName} · {formatDate(offer.createdAt)}
                </div>
              </div>
              {offer.budget != null && (
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--primary)', fontFamily: "'Space Grotesk', sans-serif" }}>
                  {formatCurrency(offer.budget)}
                </div>
              )}
            </div>

            {/* Offer Details */}
            {offer.description && (
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--text2)',
                  marginBottom: 8,
                  padding: '8px 10px',
                  background: 'var(--bg)',
                  borderRadius: 8,
                  lineHeight: 1.4,
                }}
              >
                {offer.description}
              </div>
            )}

            {/* Phase Badge + Expiry */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  borderRadius: 6,
                  padding: '2px 8px',
                  background: 'rgba(43,110,255,0.12)',
                  color: 'var(--primary)',
                  textTransform: 'uppercase',
                }}
              >
                {offer.phase?.replace(/_/g, ' ') ?? offer.status?.replace(/_/g, ' ')}
              </span>
              {expiry && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    borderRadius: 6,
                    padding: '2px 8px',
                    background: isExpired ? 'rgba(255,59,48,0.12)' : 'rgba(255,184,0,0.12)',
                    color: isExpired ? 'var(--red)' : 'var(--warn)',
                  }}
                >
                  ⏱ {expiry}
                </span>
              )}
              {offer.scheduledAt && (
                <span style={{ fontSize: 10, color: 'var(--text3)' }}>
                  📅 {formatDate(offer.scheduledAt)}
                </span>
              )}
            </div>

            {/* Action Buttons */}
            {!isExpired && offer.status !== 'contracted' && offer.status !== 'in_progress' && (
              <>
                {declineOrderId === offer.id ? (
                  <div style={{ marginTop: 6 }}>
                    <textarea
                      placeholder="Why are you declining? (min 5 chars)..."
                      value={declineReason}
                      onChange={(e) => setDeclineReason(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: 8,
                        border: '1px solid var(--border)',
                        background: 'var(--bg)',
                        color: 'var(--text)',
                        fontSize: 12,
                        resize: 'vertical',
                        minHeight: 56,
                        fontFamily: 'inherit',
                        boxSizing: 'border-box',
                      }}
                    />
                    <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                      <button
                        onClick={() => handleDecline(offer.id)}
                        disabled={acting === 'declining'}
                        style={{
                          flex: 1,
                          padding: '8px 12px',
                          borderRadius: 8,
                          border: 'none',
                          background: 'var(--red)',
                          color: '#fff',
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                          opacity: acting === 'declining' ? 0.6 : 1,
                        }}
                      >
                        {acting === 'declining' ? 'Declining...' : 'Confirm Decline'}
                      </button>
                      <button
                        onClick={() => setDeclineOrderId(null)}
                        style={{
                          padding: '8px 16px',
                          borderRadius: 8,
                          border: '1px solid var(--border)',
                          background: 'transparent',
                          color: 'var(--text2)',
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                    <button
                      onClick={() => handleAccept(offer.id)}
                      disabled={acting === 'accepting'}
                      style={{
                        flex: '1 1 calc(50% - 3px)',
                        minWidth: 90,
                        padding: '9px 0',
                        borderRadius: 10,
                        border: 'none',
                        background: 'var(--primary)',
                        color: '#fff',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                        opacity: acting === 'accepting' ? 0.6 : 1,
                      }}
                    >
                      {acting === 'accepting' ? 'Accepting...' : '✅ Accept'}
                    </button>
                    <button
                      onClick={() => openDeclineDialog(offer.id)}
                      style={{
                        flex: '1 1 calc(50% - 3px)',
                        minWidth: 90,
                        padding: '9px 0',
                        borderRadius: 10,
                        border: '1px solid var(--border)',
                        background: 'transparent',
                        color: 'var(--text2)',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      ❌ Decline
                    </button>
                    <button
                      onClick={() => {
                        const price = prompt('Enter counter-offer amount ($):', offer.budget != null ? String(offer.budget / 100) : '')
                        if (price && !isNaN(Number(price))) {
                          api.post(`/orders/${offer.id}/accept-invite`, {
                            accepted: true,
                            counterOfferAmount: Math.round(Number(price) * 100),
                          }).then(() => onRefresh()).catch(() => {})
                        }
                      }}
                      style={{
                        flex: '1 1 calc(50% - 3px)',
                        minWidth: 90,
                        padding: '9px 0',
                        borderRadius: 10,
                        border: '1px solid var(--warn)',
                        background: 'transparent',
                        color: 'var(--warn)',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      💰 Counter-offer
                    </button>
                    <button
                      onClick={() => {
                        window.open(`/orders/${offer.id}`, '_blank')
                      }}
                      style={{
                        flex: '1 1 calc(50% - 3px)',
                        minWidth: 90,
                        padding: '9px 0',
                        borderRadius: 10,
                        border: '1px solid var(--secondary)',
                        background: 'transparent',
                        color: 'var(--secondary)',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      💬 Open Chat
                    </button>
                  </div>
                )
                }
              </>
            )}

            {/* Action buttons for contracted/in_progress — Open Chat only */}
            {!isExpired && (offer.status === 'contracted' || offer.status === 'in_progress') && (
              <div style={{ marginTop: 6 }}>
                <button
                  onClick={() => {
                    window.open(`/orders/${offer.id}`, '_blank')
                  }}
                  style={{
                    width: '100%',
                    padding: '9px 0',
                    borderRadius: 10,
                    border: '1px solid var(--secondary)',
                    background: 'transparent',
                    color: 'var(--secondary)',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  💬 Open Chat
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}