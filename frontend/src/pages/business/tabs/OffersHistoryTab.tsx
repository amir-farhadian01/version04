interface HistoryOffer {
  id: string
  title: string
  customerName: string
  customerAvatarUrl: string | null
  serviceName: string
  budget: number | null
  status: string
  phase: string
  declinedAt: string | null
  declineReason: string | null
  matchedAt: string | null
  createdAt: string
  completedAt: string | null
}

interface Props {
  offers: HistoryOffer[]
  loading: boolean
  error: string | null
}

export default function OffersHistoryTab({ offers, loading, error }: Props) {
  const formatCurrency = (cents: number | null) => {
    if (cents == null) return '—'
    return '$' + (cents / 100).toFixed(2)
  }

  const formatDate = (iso: string | null) => {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const formatFullDate = (iso: string | null) => {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const getOutcomeBadge = (offer: HistoryOffer) => {
    if (offer.status === 'completed') {
      return { label: 'Won ✅', bg: 'rgba(15,201,138,0.12)', color: 'var(--secondary)' }
    }
    if (offer.status === 'cancelled' || offer.declineReason) {
      return { label: 'Lost ❌', bg: 'rgba(255,59,48,0.12)', color: 'var(--red)' }
    }
    if (offer.status === 'contracted' || offer.matchedAt) {
      return { label: 'Accepted 🤝', bg: 'rgba(43,110,255,0.12)', color: 'var(--primary)' }
    }
    return { label: offer.status.replace(/_/g, ' '), bg: 'var(--border)', color: 'var(--text3)' }
  }

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
        Loading history...
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
        <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
        <div style={{ fontWeight: 600, color: 'var(--text2)', marginBottom: 4 }}>No history</div>
        <div>Accepted and declined offers will appear here.</div>
      </div>
    )
  }

  return (
    <div style={{ paddingBottom: 40 }}>
      {offers.map((offer) => {
        const outcome = getOutcomeBadge(offer)
        return (
          <div
            key={offer.id}
            style={{
              background: 'var(--card)',
              borderRadius: 14,
              padding: 14,
              margin: '8px 14px',
              border: '1px solid var(--border)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: 'var(--bg3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
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
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{offer.title || offer.customerName}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                  {offer.serviceName} · {formatDate(offer.createdAt)}
                </div>
              </div>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  borderRadius: 6,
                  padding: '3px 8px',
                  background: outcome.bg,
                  color: outcome.color,
                }}
              >
                {outcome.label}
              </span>
            </div>

            {/* Budget + dates */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                {offer.declineReason && (
                  <span style={{ color: 'var(--red)' }}>Reason: {offer.declineReason}</span>
                )}
                {offer.matchedAt && (
                  <span>Accepted: {formatFullDate(offer.matchedAt)}</span>
                )}
                {offer.declinedAt && (
                  <span>Declined: {formatFullDate(offer.declinedAt)}</span>
                )}
              </div>
              {offer.budget != null && (
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', fontFamily: "'Space Grotesk', sans-serif" }}>
                  {formatCurrency(offer.budget)}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}