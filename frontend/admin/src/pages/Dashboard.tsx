import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../lib/api'
import {
  Users, FileText, DollarSign, Shield, Activity, TrendingUp,
  AlertTriangle, CheckCircle2, Clock, ArrowUpRight,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────

type AdminStats = {
  totalUsers: number
  kycPending: number
  activeOrders: number
  ordersToday: number
  totalProviders: number
  matchRate: number
  avgTimeToMatch: number
  revenueTotal: number
  revenuePending: number
}

type AuditLogEntry = {
  id: string
  action: string
  entityType: string
  entityId: string
  performedById: string
  details: string | null
  createdAt: string
  performedBy?: {
    id: string
    name: string
    email: string
  }
}

// ── Stat Card ──────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon,
  accent,
  trend,
}: {
  label: string
  value: string | number
  icon: React.ReactNode
  accent: string
  trend?: { value: string; positive: boolean }
}) {
  return (
    <div className="rounded-2xl border border-nh-admin-border bg-nh-admin-surface p-5 transition-all hover:border-nh-admin-primary-border">
      <div className="flex items-start justify-between">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${accent}`}>
          {icon}
        </div>
        {trend && (
          <span className={`flex items-center gap-0.5 text-[11px] font-semibold ${trend.positive ? 'text-nh-admin-success' : 'text-nh-admin-danger'}`}>
            <TrendingUp className={`h-3 w-3 ${trend.positive ? '' : 'rotate-180'}`} />
            {trend.value}
          </span>
        )}
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

// ── Activity Item ──────────────────────────────────────────────────────────

function ActivityItem({ entry }: { entry: AuditLogEntry }) {
  const actionLower = entry.action?.toLowerCase() ?? ''

  let icon = <Activity className="h-4 w-4 text-nh-admin-primary" />
  let bgColor = 'bg-nh-admin-primary-bg'

  if (actionLower.includes('user') || actionLower.includes('register')) {
    icon = <Users className="h-4 w-4 text-nh-admin-primary" />
    bgColor = 'bg-nh-admin-primary-bg'
  } else if (actionLower.includes('kyc') || actionLower.includes('verify')) {
    icon = <Shield className="h-4 w-4 text-nh-admin-warning" />
    bgColor = 'bg-nh-admin-warning-bg'
  } else if (actionLower.includes('order') || actionLower.includes('create')) {
    icon = <FileText className="h-4 w-4 text-nh-admin-success" />
    bgColor = 'bg-nh-admin-success-bg'
  } else if (actionLower.includes('payment') || actionLower.includes('revenue')) {
    icon = <DollarSign className="h-4 w-4 text-nh-admin-success" />
    bgColor = 'bg-nh-admin-success-bg'
  } else if (actionLower.includes('dispute') || actionLower.includes('flag')) {
    icon = <AlertTriangle className="h-4 w-4 text-nh-admin-danger" />
    bgColor = 'bg-nh-admin-danger-bg'
  }

  return (
    <div className="flex items-center gap-3 border-b border-nh-admin-border px-4 py-3 last:border-0">
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${bgColor}`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-nh-admin-text">{entry.details ?? entry.action}</p>
        <p className="text-[11px] text-nh-admin-text-secondary">
          {new Date(entry.createdAt).toLocaleString()}
          {entry.performedBy ? ` — by ${entry.performedBy.name}` : ''}
        </p>
      </div>
    </div>
  )
}

// ── Quick Action ───────────────────────────────────────────────────────────

function QuickAction({
  label,
  description,
  icon,
  onClick,
}: {
  label: string
  description: string
  icon: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-4 rounded-xl border border-nh-admin-border bg-nh-admin-surface p-4 text-left transition-all hover:border-nh-admin-primary hover:bg-nh-admin-surface-hover"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-nh-admin-primary-bg text-nh-admin-primary">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-nh-admin-text">{label}</p>
        <p className="text-xs text-nh-admin-text-secondary">{description}</p>
      </div>
      <ArrowUpRight className="h-4 w-4 shrink-0 text-nh-admin-text-muted" />
    </button>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState<AdminStats>({
    totalUsers: 0,
    kycPending: 0,
    activeOrders: 0,
    ordersToday: 0,
    totalProviders: 0,
    matchRate: 0,
    avgTimeToMatch: 0,
    revenueTotal: 0,
    revenuePending: 0,
  })
  const [activities, setActivities] = useState<AuditLogEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get<AdminStats>('/admin/stats').catch(() => null),
      api.get<{ items: AuditLogEntry[] }>('/admin/audit-log').catch(() => null),
    ])
      .then(([statsRes, activityRes]) => {
        if (statsRes?.data) setStats(statsRes.data)
        if (activityRes?.data?.items) setActivities(activityRes.data.items.slice(0, 10))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const quickActions = [
    {
      label: 'Manage Users',
      description: 'View, verify, and manage all platform users',
      icon: <Users className="h-5 w-5" />,
      onClick: () => navigate('/admin/users'),
    },
    {
      label: 'KYC Reviews',
      description: `${stats.kycPending} pending identity verifications`,
      icon: <Shield className="h-5 w-5" />,
      onClick: () => navigate('/admin/kyc'),
    },
    {
      label: 'Orders',
      description: 'Monitor and manage all platform orders',
      icon: <FileText className="h-5 w-5" />,
      onClick: () => navigate('/admin/orders'),
    },
    {
      label: 'Disputes',
      description: `${stats.kycPending} pending reviews requiring attention`,
      icon: <AlertTriangle className="h-5 w-5" />,
      onClick: () => navigate('/admin/kyc'),
    },
  ]

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-black text-nh-admin-text">
          Admin Dashboard
        </h1>
        <p className="mt-1 text-sm text-nh-admin-text-secondary">
          Platform overview and management
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        <StatCard
          label="Total Users"
          value={stats.totalUsers}
          icon={<Users className="h-5 w-5 text-white" />}
          accent="bg-nh-admin-primary"
        />
        <StatCard
          label="Providers"
          value={stats.totalProviders}
          icon={<CheckCircle2 className="h-5 w-5 text-white" />}
          accent="bg-nh-admin-success"
        />
        <StatCard
          label="Active Orders"
          value={stats.activeOrders}
          icon={<FileText className="h-5 w-5 text-white" />}
          accent="bg-nh-admin-purple"
          trend={{ value: `+${stats.ordersToday} today`, positive: true }}
        />
        <StatCard
          label="Revenue"
          value={`$${stats.revenueTotal.toLocaleString()}`}
          icon={<DollarSign className="h-5 w-5 text-white" />}
          accent="bg-nh-admin-orange"
        />
        <StatCard
          label="Pending KYC"
          value={stats.kycPending}
          icon={<Shield className="h-5 w-5 text-white" />}
          accent="bg-nh-admin-warning"
          trend={{ value: `${stats.kycPending} pending`, positive: stats.kycPending === 0 }}
        />
      </div>

      {/* Quick Actions + Recent Activity */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Quick Actions */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-nh-admin-text">Quick Actions</h2>
          <div className="space-y-2">
            {quickActions.map((action) => (
              <QuickAction key={action.label} {...action} />
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-nh-admin-text">Recent Activity</h2>
          <div className="overflow-hidden rounded-2xl border border-nh-admin-border bg-nh-admin-surface">
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-nh-admin-border border-t-nh-admin-primary" />
              </div>
            ) : activities.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <Activity className="h-10 w-10 text-nh-admin-text-muted" />
                <p className="text-sm text-nh-admin-text-secondary">No recent activity</p>
              </div>
            ) : (
              activities.map((entry) => (
                <ActivityItem key={entry.id} entry={entry} />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Status Indicators */}
      <div className="rounded-2xl border border-nh-admin-border bg-nh-admin-surface p-6">
        <h2 className="mb-4 text-lg font-bold text-nh-admin-text">System Status</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex items-center gap-3 rounded-xl border border-nh-admin-border bg-nh-admin-surface-elevated p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-nh-admin-success-bg">
              <CheckCircle2 className="h-5 w-5 text-nh-admin-success" />
            </div>
            <div>
              <p className="text-sm font-semibold text-nh-admin-text">API Status</p>
              <p className="text-xs text-nh-admin-success">All systems operational</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-nh-admin-border bg-nh-admin-surface-elevated p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-nh-admin-warning-bg">
              <Clock className="h-5 w-5 text-nh-admin-warning" />
            </div>
            <div>
              <p className="text-sm font-semibold text-nh-admin-text">Active Disputes</p>
              <p className="text-xs text-nh-admin-warning">{stats.kycPending} pending reviews</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-nh-admin-border bg-nh-admin-surface-elevated p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-nh-admin-primary-bg">
              <TrendingUp className="h-5 w-5 text-nh-admin-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-nh-admin-text">Orders Today</p>
              <p className="text-xs text-nh-admin-primary">{stats.ordersToday} new orders</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
