import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../../lib/api'
import { StatusBar } from '../../components/ui/phone/StatusBar'
import { BottomNav, NavIcons } from '../../components/ui/phone/BottomNav'

interface StaffMember {
  id: string
  displayName: string | null
  firstName: string | null
  lastName: string | null
  avatarUrl: string | null
  role: string
  active: boolean
}

interface DashboardData {
  activeOrders: number
  pendingQuotes: number
  todayAppointments: number
  upcomingAppointments: Array<{
    id: string
    title: string
    customerName: string
    scheduledAt: string
    status: string
  }>
  recentOrders: Array<{
    id: string
    title: string
    description: string
    total: number
    status: string
    createdAt: string
  }>
  staff: StaffMember[]
  revenueThisMonth: number
  pipeline: Array<{
    status: string
    count: number
    total: number
  }>
  topCustomers: Array<{
    userId: string
    displayName: string | null
    totalSpent: number
    orderCount: number
  }>
  recentActivity: Array<{
    id: string
    type: string
    message: string
    createdAt: string
  }>
}

const MENU_ITEMS: { label: string; icon: string; route?: string }[] = [
  { label: 'My Business', icon: '🏢' },
  { label: 'Users & Roles', icon: '👥', route: 'staff' },
  { label: 'Services', icon: '🔧', route: 'services' },
  { label: 'Packages', icon: '📦', route: 'packages' },
  { label: 'Inventory', icon: '📄', route: 'inventory' },
  { label: 'Calendar & Appointments', icon: '📅', route: 'calendar' },
  { label: 'My Clients', icon: '👤', route: 'clients' },
  { label: 'Offers, Orders & Jobs', icon: '💼' },
  { label: 'Payment Settings', icon: '💳' },
  { label: 'Finance', icon: '🧾', route: 'finance' },
]

function statusColor(status: string): string {
  switch (status) {
    case 'confirmed': return 'text-nh-primary'
    case 'pending': return 'text-nh-warning'
    case 'done': return 'text-nh-success'
    default: return 'text-nh-text-muted'
  }
}

function statusBg(status: string): string {
  switch (status) {
    case 'confirmed': return 'bg-nh-primary/15'
    case 'pending': return 'bg-nh-warning/15'
    case 'done': return 'bg-nh-success/15'
    default: return 'bg-nh-border'
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case 'confirmed': return 'Confirmed'
    case 'pending': return 'Pending'
    case 'done': return 'Done'
    default: return status
  }
}

function orderStatusColor(status: string): string {
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

export default function BusinessDashboard() {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!workspaceId) return
    setLoading(true)
    api.get(`/workspaces/${workspaceId}/dashboard/overview`)
      .then((res) => setData(res.data))
      .catch((err) => setError(err?.response?.data?.error ?? 'Failed to load dashboard'))
      .finally(() => setLoading(false))
  }, [workspaceId])

  const formatCurrency = (cents: number) => {
    return '$' + (cents / 100).toFixed(2)
  }

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const formatTime = (iso: string) => {
    return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  }

  const handleMenuClick = (item: typeof MENU_ITEMS[0]) => {
    if (item.route && workspaceId) {
      setMenuOpen(false)
      navigate(`/business/${workspaceId}/${item.route}`)
    }
  }

  const stats = data ? [
    { num: String(data.todayAppointments), lbl: "Today's Appointments", trend: `${data.upcomingAppointments.length} upcoming`, accent: 'text-nh-primary' },
    { num: String(data.pendingQuotes), lbl: 'Pending Quotes', trend: 'Awaiting response', accent: 'text-nh-warning' },
    { num: formatCurrency(data.revenueThisMonth), lbl: 'Revenue This Month', trend: `${data.activeOrders} active orders`, accent: 'text-nh-success' },
    { num: `${data.staff.length}`, lbl: 'Staff Members', trend: `${data.activeOrders} active orders`, accent: 'text-nh-purple' },
  ] : []

  return (
    <div className="relative h-full flex flex-col bg-nh-bg">
      <StatusBar title="9:41" showNotifDot />

      {/* Dashboard Header */}
      <div className="bg-nh-bg px-4 sm:px-6 lg:px-8 py-3 sm:py-4 border-b border-nh-border">
        <div className="flex items-center gap-3">
          <div onClick={() => setMenuOpen(true)} className="cursor-pointer lg:hidden">
            <svg width="22" height="22" viewBox="0 0 24 24" className="fill-nh-text">
              <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" />
            </svg>
          </div>
          <div className="flex-1">
            <div className="font-heading text-lg sm:text-xl font-bold text-nh-text">My Business</div>
            <div className="text-xs text-nh-text-muted mt-0.5">Workspace · Dashboard</div>
          </div>
          {/* Live Badge */}
          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-nh-success/30 bg-nh-success/10">
            <svg width="8" height="8" viewBox="0 0 24 24" className="fill-nh-success">
              <circle cx="12" cy="12" r="8" />
            </svg>
            <span className="text-[11px] font-semibold text-nh-success">● Live</span>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto scrollbar-none">
        {loading ? (
          <div className="text-center py-10 text-[13px] text-nh-text-muted">Loading dashboard...</div>
        ) : error ? (
          <div className="m-4 p-4 rounded-xl bg-nh-danger/15 text-nh-danger text-xs">{error}</div>
        ) : (
          <div className="max-w-5xl mx-auto">
            {/* Stats Grid - responsive columns */}
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 p-4 sm:p-6 lg:p-8">
              {stats.map((stat, i) => (
                <div key={i} className="bg-nh-surface rounded-xl sm:rounded-2xl p-4 sm:p-5 border border-nh-border flex flex-col transition hover:border-nh-border-elevated">
                  <div className={`text-2xl sm:text-[26px] font-bold font-heading ${stat.accent} mb-1`}>{stat.num}</div>
                  <div className="text-[11px] sm:text-xs text-nh-text-muted">{stat.lbl}</div>
                  <div className="text-[11px] mt-1.5 text-nh-text-muted">{stat.trend}</div>
                </div>
              ))}
            </div>

            {/* Quick Links */}
            <div className="flex gap-2 sm:gap-3 px-4 sm:px-6 lg:px-8 pb-3 sm:pb-4">
              <div onClick={() => workspaceId && navigate(`/business/${workspaceId}/clients`)} className="flex-1 bg-nh-surface rounded-xl px-3 sm:px-4 py-3 border border-nh-border cursor-pointer flex items-center gap-2 hover:border-nh-primary/30 transition">
                <span className="text-lg">👤</span>
                <span className="text-xs sm:text-sm font-semibold text-nh-text">My Clients</span>
              </div>
              <div onClick={() => workspaceId && navigate(`/business/${workspaceId}/finance`)} className="flex-1 bg-nh-surface rounded-xl px-3 sm:px-4 py-3 border border-nh-border cursor-pointer flex items-center gap-2 hover:border-nh-primary/30 transition">
                <span className="text-lg">🧾</span>
                <span className="text-xs sm:text-sm font-semibold text-nh-text">Finance</span>
              </div>
              <div onClick={() => workspaceId && navigate(`/business/${workspaceId}/staff`)} className="flex-1 bg-nh-surface rounded-xl px-3 sm:px-4 py-3 border border-nh-border cursor-pointer flex items-center gap-2 hover:border-nh-primary/30 transition">
                <span className="text-lg">👥</span>
                <span className="text-xs sm:text-sm font-semibold text-nh-text">Staff</span>
              </div>
            </div>

            {/* Pipeline Section */}
            {data?.pipeline && data.pipeline.length > 0 && (
              <div className="px-4 sm:px-6 lg:px-8 mb-3 sm:mb-4">
                <div className="text-xs sm:text-[13px] font-semibold text-nh-text-secondary mb-2">Pipeline</div>
                <div className="flex gap-1.5 sm:gap-2 overflow-x-auto">
                  {data.pipeline.slice(0, 6).map((stage) => (
                    <div key={stage.status} className="flex-1 min-w-[60px] bg-nh-surface rounded-xl p-2 sm:p-3 border border-nh-border text-center">
                      <div className={`text-base sm:text-lg font-bold ${orderStatusColor(stage.status)}`}>{stage.count}</div>
                      <div className="text-[9px] sm:text-[10px] text-nh-text-muted mt-0.5 capitalize">{stage.status.replace(/_/g, ' ')}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Desktop/Tablet: side by side sections */}
            <div className="hidden lg:grid lg:grid-cols-2 lg:gap-6 px-6 lg:px-8">
              <div>
                {/* Upcoming Appointments */}
                <div className="flex justify-between items-center py-2.5">
                  <span className="text-[13px] font-semibold text-nh-text-secondary">Upcoming Appointments</span>
                  <span className="text-[11px] text-nh-primary cursor-pointer" onClick={() => workspaceId && navigate(`/business/${workspaceId}/calendar`)}>See all →</span>
                </div>
                {data?.upcomingAppointments && data.upcomingAppointments.length > 0 ? (
                  data.upcomingAppointments.slice(0, 5).map((apt) => (
                    <div key={apt.id} className="bg-nh-surface rounded-xl p-3 mb-2 flex items-center gap-2 border border-nh-border" style={{ borderLeft: `3px solid var(--${statusColor(apt.status).replace('text-', '')})` }}>
                      <div className="text-[11px] text-nh-text-muted w-10 shrink-0 leading-snug">{formatTime(apt.scheduledAt)}</div>
                      <div className="flex-1">
                        <div className="text-[13px] font-semibold text-nh-text">{apt.customerName}</div>
                        <div className="text-[11px] text-nh-text-secondary mt-0.5">{apt.title}</div>
                      </div>
                      <div className={`text-[11px] font-semibold rounded-md px-2 py-0.5 ${statusBg(apt.status)} ${statusColor(apt.status)}`}>
                        {statusLabel(apt.status)}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-5 text-xs text-nh-text-muted">No upcoming appointments.</div>
                )}
              </div>
              <div>
                {/* Recent Orders */}
                <div className="flex justify-between items-center py-2.5">
                  <span className="text-[13px] font-semibold text-nh-text-secondary">Recent Orders</span>
                </div>
                {data?.recentOrders && data.recentOrders.length > 0 ? (
                  data.recentOrders.slice(0, 5).map((order) => (
                    <div key={order.id} className="bg-nh-surface rounded-xl p-3 mb-2 flex justify-between items-center border border-nh-border">
                      <div className="flex-1">
                        <div className="text-[13px] font-semibold text-nh-text">{order.title}</div>
                        <div className="text-[11px] text-nh-text-muted mt-0.5">{order.description || formatDate(order.createdAt)}</div>
                      </div>
                      <div className="text-right ml-3">
                        <div className="text-sm font-bold text-nh-text">{formatCurrency(order.total)}</div>
                        <div className={`text-[10px] mt-0.5 capitalize ${orderStatusColor(order.status)}`}>{order.status.replace(/_/g, ' ')}</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-5 text-xs text-nh-text-muted">No recent orders.</div>
                )}
              </div>
            </div>

            {/* Mobile: stacked sections */}
            <div className="lg:hidden">
              {/* Upcoming Appointments */}
              <div className="px-4 sm:px-6">
                <div className="flex justify-between items-center py-2.5">
                  <span className="text-[13px] font-semibold text-nh-text-secondary">Upcoming Appointments</span>
                  <span className="text-[11px] text-nh-primary cursor-pointer" onClick={() => workspaceId && navigate(`/business/${workspaceId}/calendar`)}>See all →</span>
                </div>
                {data?.upcomingAppointments && data.upcomingAppointments.length > 0 ? (
                  data.upcomingAppointments.slice(0, 5).map((apt) => (
                    <div key={apt.id} className="bg-nh-surface rounded-xl p-3 mb-2 flex items-center gap-2 border border-nh-border" style={{ borderLeft: `3px solid var(--${statusColor(apt.status).replace('text-', '')})` }}>
                      <div className="text-[11px] text-nh-text-muted w-10 shrink-0 leading-snug">{formatTime(apt.scheduledAt)}</div>
                      <div className="flex-1">
                        <div className="text-[13px] font-semibold text-nh-text">{apt.customerName}</div>
                        <div className="text-[11px] text-nh-text-secondary mt-0.5">{apt.title}</div>
                      </div>
                      <div className={`text-[11px] font-semibold rounded-md px-2 py-0.5 ${statusBg(apt.status)} ${statusColor(apt.status)}`}>
                        {statusLabel(apt.status)}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-5 text-xs text-nh-text-muted">No upcoming appointments.</div>
                )}
              </div>

              {/* Recent Orders */}
              <div className="px-4 sm:px-6">
                <div className="flex justify-between items-center py-2.5">
                  <span className="text-[13px] font-semibold text-nh-text-secondary">Recent Orders</span>
                </div>
                {data?.recentOrders && data.recentOrders.length > 0 ? (
                  data.recentOrders.slice(0, 5).map((order) => (
                    <div key={order.id} className="bg-nh-surface rounded-xl p-3 mb-2 flex justify-between items-center border border-nh-border">
                      <div className="flex-1">
                        <div className="text-[13px] font-semibold text-nh-text">{order.title}</div>
                        <div className="text-[11px] text-nh-text-muted mt-0.5">{order.description || formatDate(order.createdAt)}</div>
                      </div>
                      <div className="text-right ml-3">
                        <div className="text-sm font-bold text-nh-text">{formatCurrency(order.total)}</div>
                        <div className={`text-[10px] mt-0.5 capitalize ${orderStatusColor(order.status)}`}>{order.status.replace(/_/g, ' ')}</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-5 text-xs text-nh-text-muted">No recent orders.</div>
                )}
              </div>
            </div>

            {/* Staff Section */}
            <div className="px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between items-center py-2.5">
                <span className="text-[13px] font-semibold text-nh-text-secondary">Staff</span>
                <span className="text-[11px] text-nh-primary cursor-pointer" onClick={() => workspaceId && navigate(`/business/${workspaceId}/staff`)}>Manage →</span>
              </div>
              {data?.staff && data.staff.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {data.staff.map((member) => (
                    <div key={member.id} className="bg-nh-surface rounded-xl p-3 flex items-center gap-2.5 border border-nh-border">
                      <div className={`w-9 h-9 rounded-full bg-nh-surface-elevated flex items-center justify-center text-xs font-semibold text-nh-text-secondary overflow-hidden shrink-0 border-2 ${member.active ? 'border-nh-success' : 'border-nh-border'}`}
                        title={member.displayName ?? `${member.firstName ?? ''} ${member.lastName ?? ''}`}>
                        {member.avatarUrl ? (
                          <img src={member.avatarUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          (member.firstName?.[0] ?? member.displayName?.[0] ?? '?').toUpperCase()
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="text-[13px] font-semibold text-nh-text">{member.displayName ?? `${member.firstName ?? ''} ${member.lastName ?? ''}`}</div>
                        <div className="text-[11px] text-nh-text-muted mt-0.5">{member.role}</div>
                      </div>
                      <div className={`text-[10px] font-semibold rounded-md px-2 py-0.5 ${member.active ? 'bg-nh-success/15 text-nh-success' : 'bg-nh-border text-nh-text-muted'}`}>
                        {member.active ? 'Active' : 'Offline'}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-5 text-xs text-nh-text-muted">No staff members.</div>
              )}
            </div>

            {/* Top Customers */}
            {data?.topCustomers && data.topCustomers.length > 0 && (
              <div className="px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center py-2.5">
                  <span className="text-[13px] font-semibold text-nh-text-secondary">Top Customers</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {data.topCustomers.slice(0, 5).map((c, i) => (
                    <div key={c.userId} onClick={() => workspaceId && navigate(`/business/${workspaceId}/clients/${c.userId}`)} className="bg-nh-surface rounded-xl p-3 flex items-center gap-2.5 border border-nh-border cursor-pointer hover:border-nh-primary/30 transition">
                      <div className="w-5 text-xs font-bold text-nh-text-muted text-center">#{i + 1}</div>
                      <div className="flex-1">
                        <div className="text-[13px] font-semibold text-nh-text">{c.displayName ?? `Customer #${c.userId.slice(0, 6)}`}</div>
                        <div className="text-[11px] text-nh-text-muted mt-0.5">{c.orderCount} orders</div>
                      </div>
                      <div className="text-sm font-bold text-nh-success">{formatCurrency(c.totalSpent)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="h-24 lg:h-16" />
          </div>
        )}
      </div>

      {/* Floating Bottom Nav - mobile only */}
      <div className="lg:hidden absolute left-0 right-0 bottom-6 z-50">
        <BottomNav
          items={[
            { id: 'home', label: 'Home', icon: NavIcons.home },
            { id: 'social', label: 'Social', icon: NavIcons.social },
            { id: 'activity', label: 'Activity', icon: NavIcons.activity },
            { id: 'biz', label: 'Business', isBiz: true, active: true, icon: NavIcons.business },
          ]}
        />
      </div>

      {/* Desktop Side Navigation - visible on lg+ */}
      <div className="hidden lg:block fixed left-0 top-0 bottom-0 w-60 border-r border-nh-border bg-nh-bg pt-20 pb-4 px-3 z-40">
        <nav className="flex flex-col gap-0.5">
          {MENU_ITEMS.map((item, i) => {
            const highlighted = i === 0
            return (
              <div
                key={i}
                onClick={() => handleMenuClick(item)}
                className={`flex items-center gap-3 px-4 py-3 text-sm cursor-pointer rounded-xl transition border-l-[3px] ${highlighted ? 'text-nh-primary border-l-nh-primary bg-nh-primary/8' : 'text-nh-text-secondary border-l-transparent hover:bg-nh-surface-elevated hover:text-white'}`}
              >
                <span className="text-lg w-5 text-center">{item.icon}</span>
                {item.label}
              </div>
            )
          })}
        </nav>
      </div>

      {/* Menu Sidebar Overlay - mobile */}
      {menuOpen && (
        <div className="absolute inset-0 z-[200] lg:hidden">
          <div className="absolute inset-0 bg-black/60 cursor-pointer" onClick={() => setMenuOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-[260px] bg-nh-bg flex flex-col">
            {/* Menu Header */}
            <div className="pt-[52px] px-[18px] pb-5 border-b border-nh-border">
              <div className="w-12 h-12 rounded-[14px] bg-nh-accent flex items-center justify-center mb-3">
                <span className="text-xl font-bold text-white font-heading">A</span>
              </div>
              <div className="text-[15px] font-bold text-nh-text font-heading">Workspace</div>
              <div className="text-[11px] text-nh-text-muted mt-0.5">Business Dashboard</div>
              <div className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-md bg-nh-success/15">
                <svg width="8" height="8" viewBox="0 0 24 24" className="fill-nh-success">
                  <circle cx="12" cy="12" r="8" />
                </svg>
                <span className="text-[11px] font-semibold text-nh-success">Active</span>
              </div>
            </div>

            {/* Menu Items */}
            {MENU_ITEMS.map((item, i) => {
              const highlighted = i === 0
              return (
                <div key={i} onClick={() => handleMenuClick(item)} className={`flex items-center gap-3 px-[18px] py-[13px] text-sm cursor-pointer border-l-[3px] ${highlighted ? 'text-nh-primary border-l-nh-primary bg-nh-primary/8' : 'text-nh-text-secondary border-l-transparent'}`}>
                  <span className="text-lg w-5 text-center">{item.icon}</span>
                  {item.label}
                </div>
              )
            })}

            <div className="flex-1" />

            {/* Settings */}
            <div className="flex items-center gap-3 px-[18px] py-[13px] text-sm text-nh-text-secondary cursor-pointer">
              <svg width="18" height="18" viewBox="0 0 24 24" className="fill-nh-text-secondary">
                <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 00.12-.61l-1.92-3.32a.488.488 0 00-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 00-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58a.49.49 0 00-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6A3.6 3.6 0 1115.6 12 3.611 3.611 0 0112 15.6z" />
              </svg>
              Settings
            </div>

            {/* Logout */}
            <div className="flex items-center gap-3 px-[18px] py-[13px] text-sm text-nh-danger cursor-pointer">
              <svg width="18" height="18" viewBox="0 0 24 24" className="fill-nh-danger">
                <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z" />
              </svg>
              Logout
            </div>

            <div className="h-5" />
          </div>
        </div>
      )}
    </div>
  )
}