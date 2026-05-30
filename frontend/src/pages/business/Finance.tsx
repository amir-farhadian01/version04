import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../../lib/api'
import { StatusBar } from '../../components/ui/phone/StatusBar'
import { BottomNav, NavIcons } from '../../components/ui/phone/BottomNav'

interface FinanceData {
  summary: {
    estimatedEarnings: number
    pendingAmount: number
    completedJobCount: number
    disputedJobCount: number
  }
  pipeline: Array<{
    status: string
    count: number
    total: number
  }>
  ledger: Array<{
    id: string
    orderId: string
    type: string
    amount: number
    description: string
    createdAt: string
  }>
  invoices: Array<{
    id: string
    orderId: string
    invoiceNumber: string
    total: number
    status: string
    createdAt: string
  }>
}

const pipelineColorMap: Record<string, string> = {
  draft: 'bg-nh-text-muted',
  submitted: 'bg-nh-warning',
  matched: 'bg-nh-primary',
  contracted: 'bg-nh-purple',
  in_progress: 'bg-nh-primary',
  completed: 'bg-nh-success',
  disputed: 'bg-nh-danger',
  cancelled: 'bg-nh-text-muted',
}

const invoiceStatusColorMap: Record<string, string> = {
  PENDING: 'text-nh-warning',
  PAID: 'text-nh-success',
  OVERDUE: 'text-nh-danger',
  CANCELLED: 'text-nh-text-muted',
}

const pipelineColor = (status: string): string => pipelineColorMap[status] ?? 'bg-nh-text-muted'

const pipelineLabel = (status: string) => {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

const invoiceStatusColor = (status: string): string => invoiceStatusColorMap[status] ?? 'text-nh-text-muted'

export default function Finance() {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const navigate = useNavigate()
  const [data, setData] = useState<FinanceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'ledger' | 'invoices'>('overview')

  useEffect(() => {
    if (!workspaceId) return
    setLoading(true)
    api.get(`/workspace/${workspaceId}/finance`)
      .then((res) => setData(res.data))
      .catch((err) => setError(err?.response?.data?.error ?? 'Failed to load finance data'))
      .finally(() => setLoading(false))
  }, [workspaceId])

  const formatCurrency = (cents: number) => {
    const abs = Math.abs(cents)
    const formatted = '$' + (abs / 100).toFixed(2)
    return cents < 0 ? `-${formatted}` : formatted
  }

  const formatDate = (iso: string) => {
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
            <div className="font-heading text-lg font-bold text-nh-text">Finance</div>
            <div className="text-xs text-nh-text-muted mt-0.5">Revenue & Pipeline</div>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mx-[14px] mt-2.5 px-[14px] py-2.5 rounded-[10px] bg-nh-danger/15 text-nh-danger text-xs">{error}</div>
      )}

      <div className="flex-1 overflow-y-auto scrollbar-none">
        {loading ? (
          <div className="text-center py-10 text-[13px] text-nh-text-muted">Loading finance data...</div>
        ) : !data ? (
          <div className="text-center py-10 text-[13px] text-nh-text-muted">No finance data available.</div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 gap-2.5 p-[14px]">
              <div className="bg-nh-surface rounded-[14px] p-[14px] border border-nh-border">
                <div className="text-[22px] font-bold font-heading text-nh-success mb-1">{formatCurrency(data.summary.estimatedEarnings)}</div>
                <div className="text-[11px] text-nh-text-muted">Estimated Earnings</div>
              </div>
              <div className="bg-nh-surface rounded-[14px] p-[14px] border border-nh-border">
                <div className="text-[22px] font-bold font-heading text-nh-warning mb-1">{formatCurrency(data.summary.pendingAmount)}</div>
                <div className="text-[11px] text-nh-text-muted">Pending Amount</div>
              </div>
              <div className="bg-nh-surface rounded-[14px] p-[14px] border border-nh-border">
                <div className="text-[22px] font-bold font-heading text-nh-primary mb-1">{data.summary.completedJobCount}</div>
                <div className="text-[11px] text-nh-text-muted">Completed Jobs</div>
              </div>
              <div className="bg-nh-surface rounded-[14px] p-[14px] border border-nh-border">
                <div className={`text-[22px] font-bold font-heading mb-1 ${data.summary.disputedJobCount > 0 ? 'text-nh-danger' : 'text-nh-text-muted'}`}>{data.summary.disputedJobCount}</div>
                <div className="text-[11px] text-nh-text-muted">Disputed Jobs</div>
              </div>
            </div>

            {/* Pipeline Section */}
            {data.pipeline.length > 0 && (
              <div className="px-[14px] mb-2.5">
                <div className="text-[13px] font-semibold text-nh-text-secondary mb-2">Pipeline Revenue</div>
                {data.pipeline.map((stage) => {
                  const maxTotal = Math.max(...data.pipeline.map((s) => s.total), 1)
                  const pct = maxTotal > 0 ? (stage.total / maxTotal) * 100 : 0
                  return (
                    <div key={stage.status} className="bg-nh-surface rounded-[10px] px-3 py-2.5 mb-1.5 border border-nh-border">
                      <div className="flex justify-between items-center mb-1.5">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${pipelineColor(stage.status)}`} />
                          <span className="text-xs font-semibold text-nh-text">{pipelineLabel(stage.status)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-nh-text-muted">{stage.count} order{stage.count !== 1 ? 's' : ''}</span>
                          <span className="text-[13px] font-bold text-nh-text">{formatCurrency(stage.total)}</span>
                        </div>
                      </div>
                      {/* Progress Bar */}
                      <div className="h-1 rounded-sm bg-nh-border overflow-hidden">
                        <div className={`h-full rounded-sm transition-[width] duration-300 ${pipelineColor(stage.status)}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Tabs */}
            <div className="flex border-b border-nh-border mx-[14px]">
              {(['overview', 'ledger', 'invoices'] as const).map((tab) => (
                <div
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-2.5 text-center text-xs font-semibold cursor-pointer capitalize border-b-2 ${
                    activeTab === tab ? 'text-nh-primary border-nh-primary' : 'text-nh-text-muted border-transparent'
                  }`}
                >
                  {tab}
                </div>
              ))}
            </div>

            {/* Tab Content */}
            <div className="px-[14px]">
              {activeTab === 'overview' && (
                <div className="text-center py-5 text-xs text-nh-text-muted">
                  Summary and pipeline shown above. Switch to Ledger or Invoices for detailed records.
                </div>
              )}

              {/* Ledger Tab */}
              {activeTab === 'ledger' && (
                <div>
                  {data.ledger.length === 0 ? (
                    <div className="text-center py-[30px] text-xs text-nh-text-muted">No ledger entries yet.</div>
                  ) : (
                    data.ledger.map((entry) => (
                      <div key={entry.id} className="bg-nh-surface rounded-xl p-3 mt-2 border border-nh-border flex justify-between items-center">
                        <div className="flex-1">
                          <div className="text-xs font-semibold text-nh-text">{entry.description}</div>
                          <div className="text-[11px] text-nh-text-muted mt-0.5">{entry.type.replace(/_/g, ' ')} · {formatDate(entry.createdAt)}</div>
                        </div>
                        <div className={`text-sm font-bold ml-3 ${entry.amount >= 0 ? 'text-nh-success' : 'text-nh-danger'}`}>
                          {entry.amount >= 0 ? '+' : ''}{formatCurrency(entry.amount)}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Invoices Tab */}
              {activeTab === 'invoices' && (
                <div>
                  {data.invoices.length === 0 ? (
                    <div className="text-center py-[30px] text-xs text-nh-text-muted">No invoices yet.</div>
                  ) : (
                    data.invoices.map((inv) => (
                      <div key={inv.id} className="bg-nh-surface rounded-xl p-3 mt-2 border border-nh-border flex justify-between items-center">
                        <div className="flex-1">
                          <div className="text-xs font-semibold text-nh-text">{inv.invoiceNumber}</div>
                          <div className="text-[11px] text-nh-text-muted mt-0.5">{formatDate(inv.createdAt)}</div>
                        </div>
                        <div className="text-right ml-3">
                          <div className="text-sm font-bold text-nh-text">{formatCurrency(inv.total)}</div>
                          <div className={`text-[10px] font-semibold mt-0.5 ${invoiceStatusColor(inv.status)}`}>{inv.status}</div>
                        </div>
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