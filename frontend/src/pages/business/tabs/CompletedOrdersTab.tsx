interface CompletedOrder {
  id: string
  title: string
  clientName: string
  clientAvatarUrl: string | null
  packageName: string | null
  staffName: string | null
  amount: number
  commission: number | null
  paymentRef: string | null
  completedAt: string
  status: string
}

interface Props {
  orders: CompletedOrder[]
  loading: boolean
  error: string | null
}

export default function CompletedOrdersTab({ orders, loading, error }: Props) {
  const formatCurrency = (cents: number) => {
    return '$' + (cents / 100).toFixed(2)
  }

  const formatDate = (iso: string | null) => {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const statusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return { label: 'Completed', bg: 'rgba(15,201,138,0.12)', color: 'var(--secondary)' }
      case 'closed':
        return { label: 'Closed', bg: 'rgba(15,201,138,0.12)', color: 'var(--secondary)' }
      case 'disputed':
        return { label: 'Disputed', bg: 'rgba(255,59,48,0.12)', color: 'var(--red)' }
      default:
        return { label: status.replace(/_/g, ' '), bg: 'var(--border)', color: 'var(--text3)' }
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
        Loading completed orders...
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

  if (orders.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>📦</div>
        <div style={{ fontWeight: 600, color: 'var(--text2)', marginBottom: 4 }}>No completed orders</div>
        <div>Completed jobs will appear here with payment and commission details.</div>
      </div>
    )
  }

  return (
    <div style={{ paddingBottom: 40 }}>
      {/* Table Header - hidden on small cards, shown as sections */}
      <div
        style={{
          display: 'none', // hide on mobile-like view; cards are self-describing
        }}
      />

      {orders.map((order) => {
        const badge = statusBadge(order.status)
        return (
          <div
            key={order.id}
            style={{
              background: 'var(--card)',
              borderRadius: 14,
              padding: 14,
              margin: '8px 14px',
              border: '1px solid var(--border)',
            }}
          >
            {/* Top Row: Client + Status */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
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
                {order.clientAvatarUrl ? (
                  <img src={order.clientAvatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  (order.clientName?.[0] ?? '?').toUpperCase()
                )}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{order.clientName}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                  {order.packageName ?? '—'} · {formatDate(order.completedAt)}
                </div>
              </div>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  borderRadius: 6,
                  padding: '3px 8px',
                  background: badge.bg,
                  color: badge.color,
                }}
              >
                {badge.label}
              </span>
            </div>

            {/* Detail Rows */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px', marginBottom: 10 }}>
              {order.staffName && (
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Staff</div>
                  <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 1 }}>{order.staffName}</div>
                </div>
              )}
              <div>
                <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Amount</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', fontFamily: "'Space Grotesk', sans-serif", marginTop: 1 }}>
                  {formatCurrency(order.amount)}
                </div>
              </div>
              {order.commission != null && (
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Commission</div>
                  <div style={{ fontSize: 12, color: 'var(--warn)', marginTop: 1 }}>{formatCurrency(order.commission)}</div>
                </div>
              )}
              {order.paymentRef && (
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Payment Ref</div>
                  <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 1, fontFamily: 'monospace', wordBreak: 'break-all' }}>
                    {order.paymentRef.length > 16 ? order.paymentRef.slice(0, 16) + '...' : order.paymentRef}
                  </div>
                </div>
              )}
            </div>

            {/* Actions Row */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, display: 'flex', gap: 6 }}>
              <button
                onClick={() => window.open(`/orders/${order.id}`, '_blank')}
                style={{
                  flex: 1,
                  padding: '7px 0',
                  borderRadius: 8,
                  border: '1px solid var(--primary)',
                  background: 'transparent',
                  color: 'var(--primary)',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                📄 View Details
              </button>
              {order.paymentRef && (
                <button
                  onClick={() => window.open(`/api/orders/${order.id}/invoice`, '_blank')}
                  style={{
                    flex: 1,
                    padding: '7px 0',
                    borderRadius: 8,
                    border: '1px solid var(--secondary)',
                    background: 'transparent',
                    color: 'var(--secondary)',
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  🧾 Invoice
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}