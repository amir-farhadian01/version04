import { useState, useEffect, useCallback } from 'react'
import api from '../lib/api'
import {
  ShieldAlert, Search, Filter, ChevronDown, X, AlertTriangle,
  CheckCircle2, Clock, MessageSquare, User, ExternalLink,
  Eye, Ban, BellOff, FileText, ArrowUpRight,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────

type ModerationStatus = 'clean' | 'masked' | 'blocked' | 'flagged'

type FlaggedMessage = {
  id: string
  threadId: string
  senderId: string
  senderRole: string
  type: string
  originalText: string
  displayText: string
  moderationStatus: ModerationStatus
  moderationReasons: string[] | null
  createdAt: string
  editedAt: string | null
  metadata: Record<string, unknown> | null
  thread: {
    id: string
    orderId: string
    customerId: string
    providerId: string
    order: {
      matchedWorkspaceId: string | null
      matchedWorkspace: { id: string; name: string } | null
      matchedPackageId: string | null
      serviceCatalogId: string
      status: string
    } | null
  }
}

type ModerationStats = {
  totalFlagged: number
  flaggedToday: number
  mostCommonPiiType: string
  topOffenders: Array<{ userId: string; displayName: string; count: number }>
  avgResponseTime: string
}

type FilterState = {
  status: string
  piiType: string
  search: string
  dateFrom: string
  dateTo: string
}

// ── Helpers ────────────────────────────────────────────────────────────────

const PII_TYPE_LABELS: Record<string, string> = {
  email_detected: 'Email',
  phone_detected: 'Phone',
  address_detected: 'Address',
  link_detected: 'Link',
  contact_handle_detected: 'Handle',
  external_platform_detected: 'Platform',
  contact_exchange_pattern: 'Contact Exchange',
  explicit_contact_share: 'Explicit Share',
}

const PII_TYPE_COLORS: Record<string, string> = {
  email_detected: 'bg-nh-admin-primary-bg text-nh-admin-primary border-nh-admin-primary-border',
  phone_detected: 'bg-nh-admin-amber-bg text-nh-admin-amber border-nh-admin-amber/30',
  address_detected: 'bg-nh-admin-purple-bg text-nh-admin-purple border-nh-admin-purple/30',
  link_detected: 'bg-nh-admin-info-bg text-nh-admin-info border-nh-admin-info/30',
  contact_handle_detected: 'bg-nh-admin-rose-bg text-nh-admin-rose border-nh-admin-rose/30',
  external_platform_detected: 'bg-nh-admin-warning-bg text-nh-admin-warning border-nh-admin-warning/30',
  contact_exchange_pattern: 'bg-nh-admin-danger-bg text-nh-admin-danger border-nh-admin-danger/30',
  explicit_contact_share: 'bg-nh-admin-danger-bg text-nh-admin-danger border-nh-admin-danger/30',
}

const STATUS_COLORS: Record<string, string> = {
  flagged: 'text-nh-admin-warning bg-nh-admin-warning-bg border-nh-admin-warning/30',
  masked: 'text-nh-admin-amber bg-nh-admin-amber-bg border-nh-admin-amber/30',
  blocked: 'text-nh-admin-danger bg-nh-admin-danger-bg border-nh-admin-danger/30',
  clean: 'text-nh-admin-success bg-nh-admin-success-bg border-nh-admin-success/30',
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function truncate(text: string, max = 80): string {
  if (text.length <= max) return text
  return text.slice(0, max) + '...'
}

// ── Stats Card ─────────────────────────────────────────────────────────────

function StatsCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string
  value: string | number
  icon: React.ReactNode
  accent: string
}) {
  return (
    <div className="rounded-2xl border border-nh-admin-border bg-nh-admin-surface p-5 transition-all hover:border-nh-admin-primary-border">
      <div className="flex items-start justify-between">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${accent}`}>
          {icon}
        </div>
      </div>
      <div className="mt-4">
        <p className="text-2xl font-black text-nh-admin-text">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </p>
        <p className="mt-1 text-[11px] font-medium uppercase tracking-wider text-nh-admin-text-secondary">{label}</p>
      </div>
    </div>
  )
}

// ── PII Badge ──────────────────────────────────────────────────────────────

function PiiBadge({ reason }: { reason: string }) {
  const label = PII_TYPE_LABELS[reason] || reason
  const color = PII_TYPE_COLORS[reason] || 'bg-nh-admin-border text-nh-admin-text-secondary border-nh-admin-border-hover'
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${color}`}>
      {label}
    </span>
  )
}

// ── Detail Drawer ──────────────────────────────────────────────────────────

function DetailDrawer({
  message,
  onClose,
  onAction,
}: {
  message: FlaggedMessage | null
  onClose: () => void
  onAction: (action: string) => void
}) {
  if (!message) return null

  const reasons: string[] = message.moderationReasons || []
  const metadata = message.metadata || {}
  const review = metadata.moderationReview as Record<string, unknown> | undefined

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-nh-admin-backdrop-light backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg border-l border-nh-admin-border bg-nh-admin-bg p-6 shadow-2xl overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-nh-admin-text">Message Detail</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-nh-admin-border bg-nh-admin-surface text-nh-admin-text-secondary hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Status */}
        <div className="mb-4">
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wider ${STATUS_COLORS[message.moderationStatus] || ''}`}>
            {message.moderationStatus}
          </span>
        </div>

        {/* PII Reasons */}
        {reasons.length > 0 && (
          <div className="mb-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-nh-admin-text-secondary">Detected PII</p>
            <div className="flex flex-wrap gap-1.5">
              {reasons.map((r) => (
                <PiiBadge key={r} reason={r} />
              ))}
            </div>
          </div>
        )}

        {/* Original Text */}
        <div className="mb-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-nh-admin-text-secondary">Original Text</p>
          <div className="rounded-xl border border-nh-admin-border bg-nh-admin-surface p-3">
            <p className="text-sm text-nh-admin-text whitespace-pre-wrap break-words">{message.originalText}</p>
          </div>
        </div>

        {/* Display Text */}
        {message.displayText !== message.originalText && (
          <div className="mb-4">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-nh-admin-text-secondary">Display Text (Masked)</p>
            <div className="rounded-xl border border-nh-admin-border bg-nh-admin-surface p-3">
              <p className="text-sm text-nh-admin-text-secondary whitespace-pre-wrap break-words">{message.displayText}</p>
            </div>
          </div>
        )}

        {/* Sender Info */}
        <div className="mb-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-nh-admin-text-secondary">Sender</p>
          <div className="flex items-center gap-2 rounded-xl border border-nh-admin-border bg-nh-admin-surface p-3">
            <User className="h-4 w-4 text-nh-admin-primary" />
            <span className="text-sm text-nh-admin-text">{message.senderId}</span>
            <span className="text-xs text-nh-admin-text-secondary">({message.senderRole})</span>
          </div>
        </div>

        {/* Order Info */}
        <div className="mb-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-nh-admin-text-secondary">Order</p>
          <div className="rounded-xl border border-nh-admin-border bg-nh-admin-surface p-3">
            <p className="text-sm text-nh-admin-text">{message.thread.orderId}</p>
            {message.thread.order && (
              <p className="text-xs text-nh-admin-text-secondary mt-1">
                Status: {message.thread.order.status}
                {message.thread.order.matchedWorkspace && ` · ${message.thread.order.matchedWorkspace.name}`}
              </p>
            )}
          </div>
        </div>

        {/* Timestamp */}
        <div className="mb-6">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-nh-admin-text-secondary">Sent At</p>
          <p className="text-sm text-nh-admin-text">{formatDate(message.createdAt)}</p>
        </div>

        {/* Review History */}
        {review && (
          <div className="mb-6">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-nh-admin-text-secondary">Review History</p>
            <div className="rounded-xl border border-nh-admin-border bg-nh-admin-surface p-3 space-y-2">
              {Boolean((review as Record<string, unknown>).reviewedAt) && (
                <p className="text-xs text-nh-admin-text-secondary">
                  Reviewed: {new Date((review as Record<string, string>).reviewedAt as string).toLocaleString()}
                </p>
              )}
              {Boolean((review as Record<string, unknown>).escalatedToSupport) && (
                <p className="text-xs text-nh-admin-warning">
                  Escalated to support
                  {Boolean((review as Record<string, unknown>).escalatedAt) && ` at ${new Date((review as Record<string, string>).escalatedAt as string).toLocaleString()}`}
                </p>
              )}
              {Boolean((review as Record<string, unknown>).internalNote) && (
                <div>
                  <p className="text-xs font-semibold text-nh-admin-text-secondary">Internal Note:</p>
                  <p className="text-xs text-nh-admin-text mt-1">{(review as Record<string, string>).internalNote as string}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-nh-admin-text-secondary mb-2">Actions</p>
          <button
            onClick={() => onAction('review')}
            className="flex w-full items-center gap-3 rounded-xl border border-nh-admin-border bg-nh-admin-surface px-4 py-3 text-sm font-semibold text-nh-admin-text transition-all hover:border-nh-admin-success hover:bg-nh-admin-success-bg"
          >
            <CheckCircle2 className="h-4 w-4 text-nh-admin-success" />
            Mark as Reviewed
          </button>
          <button
            onClick={() => onAction('escalate')}
            className="flex w-full items-center gap-3 rounded-xl border border-nh-admin-border bg-nh-admin-surface px-4 py-3 text-sm font-semibold text-nh-admin-text transition-all hover:border-nh-admin-warning hover:bg-nh-admin-warning-bg"
          >
            <AlertTriangle className="h-4 w-4 text-nh-admin-warning" />
            Escalate to Support
          </button>
          <button
            onClick={() => onAction('warn')}
            className="flex w-full items-center gap-3 rounded-xl border border-nh-admin-border bg-nh-admin-surface px-4 py-3 text-sm font-semibold text-nh-admin-text transition-all hover:border-nh-admin-amber hover:bg-nh-admin-amber-bg"
          >
            <BellOff className="h-4 w-4 text-nh-admin-amber" />
            Warn User
          </button>
          <button
            onClick={() => onAction('mute')}
            className="flex w-full items-center gap-3 rounded-xl border border-nh-admin-border bg-nh-admin-surface px-4 py-3 text-sm font-semibold text-nh-admin-text transition-all hover:border-nh-admin-danger hover:bg-nh-admin-danger-bg"
          >
            <Ban className="h-4 w-4 text-nh-admin-danger" />
            Mute User (24h)
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function Moderation() {
  const [messages, setMessages] = useState<FlaggedMessage[]>([])
  const [stats, setStats] = useState<ModerationStats>({
    totalFlagged: 0,
    flaggedToday: 0,
    mostCommonPiiType: 'N/A',
    topOffenders: [],
    avgResponseTime: 'N/A',
  })
  const [loading, setLoading] = useState(true)
  const [selectedMessage, setSelectedMessage] = useState<FlaggedMessage | null>(null)
  const [filters, setFilters] = useState<FilterState>({
    status: 'flagged,masked,blocked',
    piiType: '',
    search: '',
    dateFrom: '',
    dateTo: '',
  })
  const [showFilters, setShowFilters] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const fetchMessages = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = {
        limit: '100',
        status: filters.status || 'flagged,masked,blocked',
      }
      if (filters.dateFrom) params.from = filters.dateFrom
      if (filters.dateTo) params.to = filters.dateTo

      const res = await api.get<{ items: FlaggedMessage[]; total: number }>('/admin/chat/flags', { params })
      let items = res.data.items || []

      // Client-side search filter
      if (filters.search) {
        const q = filters.search.toLowerCase()
        items = items.filter(
          (m) =>
            m.originalText.toLowerCase().includes(q) ||
            m.displayText.toLowerCase().includes(q) ||
            m.senderId.toLowerCase().includes(q),
        )
      }

      // Client-side PII type filter
      if (filters.piiType) {
        items = items.filter((m) => (m.moderationReasons || []).includes(filters.piiType))
      }

      setMessages(items)

      // Compute stats from data
      const allReasons = items.flatMap((m) => m.moderationReasons || [])
      const reasonCounts: Record<string, number> = {}
      for (const r of allReasons) {
        reasonCounts[r] = (reasonCounts[r] || 0) + 1
      }
      const mostCommon = Object.entries(reasonCounts).sort((a, b) => b[1] - a[1])[0]

      // Count flagged today
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const flaggedToday = items.filter((m) => new Date(m.createdAt) >= today).length

      setStats({
        totalFlagged: res.data.total || items.length,
        flaggedToday,
        mostCommonPiiType: mostCommon ? (PII_TYPE_LABELS[mostCommon[0]] || mostCommon[0]) : 'N/A',
        topOffenders: [],
        avgResponseTime: 'N/A',
      })
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    fetchMessages()
  }, [fetchMessages])

  const handleAction = async (action: string) => {
    if (!selectedMessage) return
    setActionLoading(action)

    try {
      switch (action) {
        case 'review':
          await api.post(`/admin/chat/flags/${selectedMessage.id}/review`, {
            internalNote: 'Reviewed from moderation dashboard',
          })
          break
        case 'escalate':
          await api.post(`/admin/chat/flags/${selectedMessage.id}/escalate`, {
            internalNote: 'Escalated from moderation dashboard',
          })
          break
        case 'warn':
          await api.post(`/admin/chat/users/${selectedMessage.senderId}/warn`, {})
          break
        case 'mute':
          await api.post(`/admin/chat/users/${selectedMessage.senderId}/mute`, {})
          break
      }
      // Refresh after action
      await fetchMessages()
      setSelectedMessage(null)
    } catch {
      // silent
    } finally {
      setActionLoading(null)
    }
  }

  const filteredMessages = messages

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-black text-nh-admin-text">
          Moderation
        </h1>
        <p className="mt-1 text-sm text-nh-admin-text-secondary">
          Review and manage flagged messages across all chats
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatsCard
          label="Total Flagged"
          value={stats.totalFlagged}
          icon={<ShieldAlert className="h-5 w-5 text-white" />}
          accent="bg-nh-admin-danger"
        />
        <StatsCard
          label="Flagged Today"
          value={stats.flaggedToday}
          icon={<Clock className="h-5 w-5 text-white" />}
          accent="bg-nh-admin-warning"
        />
        <StatsCard
          label="Most Common PII"
          value={stats.mostCommonPiiType}
          icon={<AlertTriangle className="h-5 w-5 text-white" />}
          accent="bg-nh-admin-amber"
        />
        <StatsCard
          label="Avg Response"
          value={stats.avgResponseTime}
          icon={<CheckCircle2 className="h-5 w-5 text-white" />}
          accent="bg-nh-admin-primary"
        />
      </div>

      {/* Filters */}
      <div className="rounded-2xl border border-nh-admin-border bg-nh-admin-surface">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-nh-admin-text-secondary" />
              <input
                type="text"
                placeholder="Search messages..."
                value={filters.search}
                onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                className="w-64 rounded-xl border border-nh-admin-border bg-nh-admin-bg py-2 pl-10 pr-4 text-sm text-nh-admin-text placeholder-nh-admin-text-secondary focus:border-nh-admin-primary-border focus:outline-none"
              />
            </div>
            <select
              value={filters.status}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
              className="rounded-xl border border-nh-admin-border bg-nh-admin-bg px-3 py-2 text-sm text-nh-admin-text focus:border-nh-admin-primary-border focus:outline-none"
            >
              <option value="flagged,masked,blocked">All Flagged</option>
              <option value="flagged">Flagged Only</option>
              <option value="masked">Masked Only</option>
              <option value="blocked">Blocked Only</option>
              <option value="clean">Clean</option>
            </select>
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 rounded-xl border border-nh-admin-border bg-nh-admin-bg px-4 py-2 text-sm text-nh-admin-text-secondary hover:text-white"
          >
            <Filter className="h-4 w-4" />
            More Filters
            <ChevronDown className={`h-4 w-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {showFilters && (
          <div className="border-t border-nh-admin-border p-4">
            <div className="flex flex-wrap gap-4">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-nh-admin-text-secondary">PII Type</label>
                <select
                  value={filters.piiType}
                  onChange={(e) => setFilters((f) => ({ ...f, piiType: e.target.value }))}
                  className="rounded-xl border border-nh-admin-border bg-nh-admin-bg px-3 py-2 text-sm text-nh-admin-text focus:border-nh-admin-primary-border focus:outline-none"
                >
                  <option value="">All Types</option>
                  {Object.entries(PII_TYPE_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-nh-admin-text-secondary">From</label>
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
                  className="rounded-xl border border-nh-admin-border bg-nh-admin-bg px-3 py-2 text-sm text-nh-admin-text focus:border-nh-admin-primary-border focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-nh-admin-text-secondary">To</label>
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
                  className="rounded-xl border border-nh-admin-border bg-nh-admin-bg px-3 py-2 text-sm text-nh-admin-text focus:border-nh-admin-primary-border focus:outline-none"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Messages Table */}
      <div className="overflow-hidden rounded-2xl border border-nh-admin-border bg-nh-admin-surface">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-nh-admin-border border-t-nh-admin-primary" />
          </div>
        ) : filteredMessages.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <ShieldAlert className="h-12 w-12 text-nh-admin-text-muted" />
            <div>
              <p className="text-lg font-semibold text-nh-admin-text">No flagged messages</p>
              <p className="mt-1 text-sm text-nh-admin-text-secondary">All messages are clean. Great job!</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-nh-admin-border">
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-nh-admin-text-secondary">Message</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-nh-admin-text-secondary">Sender</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-nh-admin-text-secondary">PII Detected</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-nh-admin-text-secondary">Status</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-nh-admin-text-secondary">Date</th>
                  <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-nh-admin-text-secondary">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-nh-admin-border">
                {filteredMessages.map((msg) => (
                  <tr
                    key={msg.id}
                    className="transition-colors hover:bg-nh-admin-surface-hover cursor-pointer"
                    onClick={() => setSelectedMessage(msg)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 shrink-0 text-nh-admin-text-muted" />
                        <span className="text-sm text-nh-admin-text">{truncate(msg.displayText || msg.originalText)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-nh-admin-text-muted" />
                        <span className="text-xs text-nh-admin-text-secondary">{truncate(msg.senderId, 16)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(msg.moderationReasons || []).slice(0, 2).map((r) => (
                          <PiiBadge key={r} reason={r} />
                        ))}
                        {(msg.moderationReasons || []).length > 2 && (
                          <span className="text-[10px] text-nh-admin-text-secondary">+{msg.moderationReasons!.length - 2}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${STATUS_COLORS[msg.moderationStatus] || ''}`}>
                        {msg.moderationStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-nh-admin-text-secondary">{formatDate(msg.createdAt)}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedMessage(msg)
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-nh-admin-border bg-nh-admin-bg px-3 py-1.5 text-xs font-semibold text-nh-admin-primary transition-all hover:bg-nh-admin-primary-bg"
                      >
                        <Eye className="h-3 w-3" />
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail Drawer */}
      <DetailDrawer
        message={selectedMessage}
        onClose={() => setSelectedMessage(null)}
        onAction={handleAction}
      />

      {/* Action Loading Overlay */}
      {actionLoading && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-nh-admin-backdrop backdrop-blur-sm">
          <div className="flex items-center gap-3 rounded-2xl border border-nh-admin-border bg-nh-admin-surface px-6 py-4">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-nh-admin-border border-t-nh-admin-primary" />
            <span className="text-sm text-nh-admin-text">Processing...</span>
          </div>
        </div>
      )}
    </div>
  )
}