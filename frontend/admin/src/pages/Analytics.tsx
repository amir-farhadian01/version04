import { useState, useEffect } from 'react'
import api from '../lib/api'
import {
  BarChart3,
  TrendingUp,
  Users,
  ShoppingCart,
  DollarSign,
  CheckCircle2,
  Clock,
  XCircle,
} from 'lucide-react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts'

// ── Types ──────────────────────────────────────────────────────────────────

interface OverviewStats {
  totalOrders: number
  totalRevenue: number
  totalRevenueFormatted: string
  activeUsers: number
  kycCompletionRate: number
  totalCommission: number
  totalCommissionFormatted: string
  orderCompletionRate: number
  avgOrderValue: number
}

interface OrderTimelinePoint {
  date: string
  count: number
  completed: number
  cancelled: number
}

interface TopCategory {
  categoryId: string
  categoryName: string
  orderCount: number
}

interface OrderAnalytics {
  orderTimeline: OrderTimelinePoint[]
  topCategories: TopCategory[]
  totalOrders: number
}

interface RevenueTimelinePoint {
  date: string
  revenue: number
  revenueFormatted: string
  commission: number
  commissionFormatted: string
  count: number
}

interface RevenueAnalytics {
  revenueTimeline: RevenueTimelinePoint[]
  totalRevenue: number
  totalRevenueFormatted: string
  totalCommission: number
  totalCommissionFormatted: string
  transactionCount: number
}

interface RegistrationPoint {
  date: string
  total: number
  customers: number
  providers: number
}

interface RoleDistribution {
  role: string
  count: number
}

interface UserAnalytics {
  registrationTimeline: RegistrationPoint[]
  roleDistribution: RoleDistribution[]
  newUsersLast30Days: number
  totalUsers: number
  activeUsers: number
}

interface KycBreakdown {
  status: string
  type: string
  count: number
}

interface KycAnalytics {
  kycBreakdown: KycBreakdown[]
  total: number
  pending: number
  approved: number
  rejected: number
  approvalRate: number
  rejectionRate: number
  pendingCount: number
}

// ── Colors ──────────────────────────────────────────────────────────────────

const COLORS = ['#2b6eff', '#0fc98a', '#ff4d4d', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4']
const CHART_BG = '#0d0f1a'

// ── Stat Card ──────────────────────────────────────────────────────────────

function StatCard({
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
        <p className="text-2xl font-black text-white">{value}</p>
        <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-nh-admin-text-muted">{label}</p>
      </div>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function Analytics() {
  const [tab, setTab] = useState<'overview' | 'orders' | 'revenue' | 'users' | 'kyc'>('overview')
  const [overview, setOverview] = useState<OverviewStats | null>(null)
  const [orderData, setOrderData] = useState<OrderAnalytics | null>(null)
  const [revenueData, setRevenueData] = useState<RevenueAnalytics | null>(null)
  const [userData, setUserData] = useState<UserAnalytics | null>(null)
  const [kycData, setKycData] = useState<KycAnalytics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [tab])

  async function loadData() {
    setLoading(true)
    try {
      switch (tab) {
        case 'overview': {
          const res = await api.get('/admin/analytics/overview')
          setOverview(res.data.data)
          break
        }
        case 'orders': {
          const res = await api.get('/admin/analytics/orders')
          setOrderData(res.data.data)
          break
        }
        case 'revenue': {
          const res = await api.get('/admin/analytics/revenue')
          setRevenueData(res.data.data)
          break
        }
        case 'users': {
          const res = await api.get('/admin/analytics/users')
          setUserData(res.data.data)
          break
        }
        case 'kyc': {
          const res = await api.get('/admin/analytics/kyc')
          setKycData(res.data.data)
          break
        }
      }
    } catch (err) {
      console.error('Failed to load analytics:', err)
    } finally {
      setLoading(false)
    }
  }

  const tabs = [
    { key: 'overview' as const, label: 'Overview', icon: BarChart3 },
    { key: 'orders' as const, label: 'Orders', icon: ShoppingCart },
    { key: 'revenue' as const, label: 'Revenue', icon: DollarSign },
    { key: 'users' as const, label: 'Users', icon: Users },
    { key: 'kyc' as const, label: 'KYC', icon: CheckCircle2 },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white">Analytics</h1>
        <p className="mt-1 text-sm text-nh-admin-text-secondary">Platform metrics and performance insights</p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${
              tab === t.key
                ? 'bg-nh-admin-primary text-white border border-nh-admin-primary'
                : 'text-nh-admin-text-secondary border border-nh-admin-border hover:bg-nh-admin-surface-hover hover:text-white'
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-nh-admin-primary border-t-transparent" />
        </div>
      ) : (
        <div className="space-y-6">
          {tab === 'overview' && overview && (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard label="Total Orders" value={overview.totalOrders} icon={<ShoppingCart className="h-5 w-5 text-white" />} accent="bg-nh-admin-primary-bg text-nh-admin-primary" />
                <StatCard label="Total Revenue" value={overview.totalRevenueFormatted} icon={<DollarSign className="h-5 w-5 text-white" />} accent="bg-nh-admin-success-bg text-nh-admin-success" />
                <StatCard label="Active Users" value={overview.activeUsers} icon={<Users className="h-5 w-5 text-white" />} accent="bg-nh-admin-purple/20 text-nh-admin-purple" />
                <StatCard label="Commission" value={overview.totalCommissionFormatted} icon={<TrendingUp className="h-5 w-5 text-white" />} accent="bg-nh-admin-warning-bg text-amber-500" />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-2xl border border-nh-admin-border bg-nh-admin-surface p-5">
                  <p className="text-sm font-semibold text-nh-admin-text-secondary">KYC Completion Rate</p>
                  <p className="mt-2 text-2xl font-black text-white">{overview.kycCompletionRate}%</p>
                  <div className="mt-3 h-2 rounded-full bg-nh-admin-bg">
                    <div className="h-2 rounded-full bg-nh-admin-success" style={{ width: `${overview.kycCompletionRate}%` }} />
                  </div>
                </div>
                <div className="rounded-2xl border border-nh-admin-border bg-nh-admin-surface p-5">
                  <p className="text-sm font-semibold text-nh-admin-text-secondary">Order Completion Rate</p>
                  <p className="mt-2 text-2xl font-black text-white">{overview.orderCompletionRate}%</p>
                  <div className="mt-3 h-2 rounded-full bg-nh-admin-bg">
                    <div className="h-2 rounded-full bg-app-primary" style={{ width: `${overview.orderCompletionRate}%` }} />
                  </div>
                </div>
                <div className="rounded-2xl border border-nh-admin-border bg-nh-admin-surface p-5">
                  <p className="text-sm font-semibold text-nh-admin-text-secondary">Avg Order Value</p>
                  <p className="mt-2 text-2xl font-black text-white">{overview.avgOrderValue > 0 ? `$${(overview.avgOrderValue / 100).toFixed(2)}` : '$0.00'}</p>
                </div>
              </div>
            </>
          )}

          {tab === 'orders' && orderData && (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <StatCard label="Orders (30d)" value={orderData.totalOrders} icon={<ShoppingCart className="h-5 w-5 text-white" />} accent="bg-nh-admin-primary-bg text-nh-admin-primary" />
              </div>

              {/* Order Timeline Chart */}
              <div className="rounded-2xl border border-nh-admin-border bg-nh-admin-surface p-6">
                <h3 className="text-lg font-bold text-white mb-4">Order Volume Over Time</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={orderData.orderTimeline}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2f4a" />
                    <XAxis dataKey="date" stroke="#4a4f70" fontSize={12} />
                    <YAxis stroke="#4a4f70" fontSize={12} />
                    <Tooltip
                      contentStyle={{ background: '#1e2235', border: '1px solid #2a2f4a', borderRadius: '12px' }}
                      labelStyle={{ color: '#f0f2ff' }}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="count" stroke="#2b6eff" name="Total Orders" strokeWidth={2} />
                    <Line type="monotone" dataKey="completed" stroke="#0fc98a" name="Completed" strokeWidth={2} />
                    <Line type="monotone" dataKey="cancelled" stroke="#ff4d4d" name="Cancelled" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Top Categories */}
              {orderData.topCategories.length > 0 && (
                <div className="rounded-2xl border border-nh-admin-border bg-nh-admin-surface p-6">
                  <h3 className="text-lg font-bold text-white mb-4">Top Categories by Orders</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={orderData.topCategories}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2a2f4a" />
                      <XAxis dataKey="categoryName" stroke="#4a4f70" fontSize={12} />
                      <YAxis stroke="#4a4f70" fontSize={12} />
                      <Tooltip
                        contentStyle={{ background: '#1e2235', border: '1px solid #2a2f4a', borderRadius: '12px' }}
                        labelStyle={{ color: '#f0f2ff' }}
                      />
                      <Bar dataKey="orderCount" fill="#2b6eff" name="Orders" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </>
          )}

          {tab === 'revenue' && revenueData && (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <StatCard label="Revenue (30d)" value={revenueData.totalRevenueFormatted} icon={<DollarSign className="h-5 w-5 text-white" />} accent="bg-nh-admin-success-bg text-nh-admin-success" />
                <StatCard label="Commission" value={revenueData.totalCommissionFormatted} icon={<TrendingUp className="h-5 w-5 text-white" />} accent="bg-nh-admin-warning-bg text-amber-500" />
                <StatCard label="Transactions" value={revenueData.transactionCount} icon={<CheckCircle2 className="h-5 w-5 text-white" />} accent="bg-nh-admin-primary-bg text-nh-admin-primary" />
              </div>

              {/* Revenue Timeline */}
              <div className="rounded-2xl border border-nh-admin-border bg-nh-admin-surface p-6">
                <h3 className="text-lg font-bold text-white mb-4">Revenue Over Time</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={revenueData.revenueTimeline}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2f4a" />
                    <XAxis dataKey="date" stroke="#4a4f70" fontSize={12} />
                    <YAxis stroke="#4a4f70" fontSize={12} tickFormatter={(v: number) => `$${(v / 100).toFixed(0)}`} />
                    <Tooltip
                      contentStyle={{ background: '#1e2235', border: '1px solid #2a2f4a', borderRadius: '12px' }}
                      labelStyle={{ color: '#f0f2ff' }}
                      formatter={(value: number, name: string) => [name === 'commission' ? `$${(value / 100).toFixed(2)}` : `$${(value / 100).toFixed(2)}`, name]}
                    />
                    <Legend />
                    <Bar dataKey="revenue" fill="#0fc98a" name="Revenue" radius={[8, 8, 0, 0]} />
                    <Bar dataKey="commission" fill="#f59e0b" name="Commission" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}

          {tab === 'users' && userData && (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <StatCard label="Total Users" value={userData.totalUsers} icon={<Users className="h-5 w-5 text-white" />} accent="bg-nh-admin-purple/20 text-nh-admin-purple" />
                <StatCard label="Active Users" value={userData.activeUsers} icon={<CheckCircle2 className="h-5 w-5 text-white" />} accent="bg-nh-admin-success-bg text-nh-admin-success" />
                <StatCard label="New (30d)" value={userData.newUsersLast30Days} icon={<TrendingUp className="h-5 w-5 text-white" />} accent="bg-nh-admin-primary-bg text-nh-admin-primary" />
              </div>

              {/* Registration Timeline */}
              <div className="rounded-2xl border border-nh-admin-border bg-nh-admin-surface p-6">
                <h3 className="text-lg font-bold text-white mb-4">New Registrations</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={userData.registrationTimeline}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2f4a" />
                    <XAxis dataKey="date" stroke="#4a4f70" fontSize={12} />
                    <YAxis stroke="#4a4f70" fontSize={12} />
                    <Tooltip
                      contentStyle={{ background: '#1e2235', border: '1px solid #2a2f4a', borderRadius: '12px' }}
                      labelStyle={{ color: '#f0f2ff' }}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="total" stroke="#2b6eff" name="Total" strokeWidth={2} />
                    <Line type="monotone" dataKey="customers" stroke="#0fc98a" name="Customers" strokeWidth={2} />
                    <Line type="monotone" dataKey="providers" stroke="#8b5cf6" name="Providers" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Role Distribution */}
              <div className="rounded-2xl border border-nh-admin-border bg-nh-admin-surface p-6">
                <h3 className="text-lg font-bold text-white mb-4">Role Distribution</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={userData.roleDistribution}
                      dataKey="count"
                      nameKey="role"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={({ role, count }: { role: string; count: number }) => `${role} (${count})`}
                    >
                      {userData.roleDistribution.map((_entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: '#1e2235', border: '1px solid #2a2f4a', borderRadius: '12px' }}
                      labelStyle={{ color: '#f0f2ff' }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </>
          )}

          {tab === 'kyc' && kycData && (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                <StatCard label="Total KYC" value={kycData.total} icon={<Users className="h-5 w-5 text-white" />} accent="bg-nh-admin-primary-bg text-nh-admin-primary" />
                <StatCard label="Approved" value={kycData.approved} icon={<CheckCircle2 className="h-5 w-5 text-white" />} accent="bg-nh-admin-success-bg text-nh-admin-success" />
                <StatCard label="Pending" value={kycData.pending} icon={<Clock className="h-5 w-5 text-white" />} accent="bg-nh-admin-warning-bg text-amber-500" />
                <StatCard label="Rejected" value={kycData.rejected} icon={<XCircle className="h-5 w-5 text-white" />} accent="bg-nh-admin-danger-bg text-nh-admin-danger" />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-nh-admin-border bg-nh-admin-surface p-5">
                  <p className="text-sm font-semibold text-nh-admin-text-secondary">Approval Rate</p>
                  <p className="mt-2 text-2xl font-black text-nh-admin-success">{kycData.approvalRate}%</p>
                  <div className="mt-3 h-2 rounded-full bg-nh-admin-bg">
                    <div className="h-2 rounded-full bg-nh-admin-success" style={{ width: `${kycData.approvalRate}%` }} />
                  </div>
                </div>
                <div className="rounded-2xl border border-nh-admin-border bg-nh-admin-surface p-5">
                  <p className="text-sm font-semibold text-nh-admin-text-secondary">Rejection Rate</p>
                  <p className="mt-2 text-2xl font-black text-nh-admin-danger">{kycData.rejectionRate}%</p>
                  <div className="mt-3 h-2 rounded-full bg-nh-admin-bg">
                    <div className="h-2 rounded-full bg-app-red" style={{ width: `${kycData.rejectionRate}%` }} />
                  </div>
                </div>
              </div>

              {/* KYC Breakdown Table */}
              <div className="rounded-2xl border border-nh-admin-border bg-nh-admin-surface overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-nh-admin-bg text-nh-admin-text-secondary">
                      <tr>
                        <th className="px-5 py-3 font-semibold">Status</th>
                        <th className="px-5 py-3 font-semibold">Type</th>
                        <th className="px-5 py-3 font-semibold text-right">Count</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-nh-admin-border">
                      {kycData.kycBreakdown.map((row, i) => (
                        <tr key={i} className="hover:bg-nh-admin-bg/50">
                          <td className="px-5 py-3">
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${
                              row.status === 'approved' ? 'bg-nh-admin-success/15 text-nh-admin-success' :
                              row.status === 'rejected' ? 'bg-nh-admin-danger-15 text-nh-admin-danger' :
                              row.status === 'pending' ? 'bg-amber-500/15 text-amber-500' :
                              'bg-nh-admin-text-secondary/15 text-nh-admin-text-secondary'
                            }`}>
                              {row.status}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-white">{row.type}</td>
                          <td className="px-5 py-3 text-right font-bold text-white">{row.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}