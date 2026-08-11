import { useState } from 'react'
import { Link, useNavigate, useLocation, Outlet } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import {
  LogOut,
  Home,
  Bell,
  Menu,
  X,
  LayoutDashboard,
  Users,
  ShieldCheck,
  ShoppingCart,
  FileText,
  CreditCard,
  Image,
  Settings,
  ShieldAlert,
  Newspaper,
  BarChart3,
  Wrench,
} from 'lucide-react'
import { cn } from '../lib/cn'
import { motion, AnimatePresence } from 'motion/react'
import { AccountAvatarBadge } from './AccountAvatarBadge'

const SIDEBAR_LINKS = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/admin' },
  { label: 'Users', icon: Users, path: '/admin/users' },
  { label: 'KYC', icon: ShieldCheck, path: '/admin/kyc' },
  { label: 'Orders', icon: ShoppingCart, path: '/admin/orders' },
  { label: 'Contracts', icon: FileText, path: '/admin/contracts' },
  { label: 'Payments', icon: CreditCard, path: '/admin/payments' },
  { label: 'Media', icon: Image, path: '/admin/media' },
  { label: 'Home Content', icon: Newspaper, path: '/admin/home-content' },
  { label: 'Moderation', icon: ShieldAlert, path: '/admin/moderation' },
  { label: 'Analytics', icon: BarChart3, path: '/admin/analytics' },
  { label: 'Services', icon: Wrench, path: '/admin/orders' },
  { label: 'Settings', icon: Settings, path: '/admin/settings' },
]

export function AdminLayout() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const isActive = (path: string) => {
    const base = '/admin'
    if (!path) return location.pathname === base
    return location.pathname === `${base}/${path}`
  }

  return (
    <div className="min-h-screen bg-nh-admin-bg font-sans text-nh-admin-text flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-nh-admin-border bg-nh-admin-bg/95 backdrop-blur-xl">
        <div className="w-full px-3 sm:px-5 lg:px-6 h-16 flex items-center">
          <Link to="/admin" className="flex items-center gap-2 shrink-0">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-nh-admin-primary-border bg-nh-admin-primary-bg text-nh-admin-primary">
              <Home className="h-5 w-5 fill-current" />
            </span>
            <span>
              <span className="block text-lg font-black tracking-tight text-white">NeighborHub</span>
              <span className="hidden text-[10px] font-bold uppercase tracking-[0.12em] text-nh-admin-text-muted sm:block">Admin Panel</span>
            </span>
          </Link>

          <div className="ml-auto flex items-center gap-3 sm:gap-4">
            {user?.email && (
              <span className="hidden md:inline max-w-[220px] truncate text-xs text-nh-admin-text-muted font-medium" title={user.email}>
                {user.email}
              </span>
            )}
            {user && (
              <Link
                to="/notifications"
                className="relative flex h-10 w-10 items-center justify-center rounded-full border border-nh-admin-border bg-nh-admin-surface text-nh-admin-text-secondary transition hover:border-nh-admin-primary hover:text-white"
                aria-label="Notifications"
              >
                <Bell className="h-5 w-5" />
                <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-nh-admin-danger ring-2 ring-nh-admin-surface" />
              </Link>
            )}
            {user && <AccountAvatarBadge user={user} />}

            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-nh-admin-border bg-nh-admin-surface text-nh-admin-text-secondary transition hover:border-nh-admin-primary hover:text-white lg:hidden"
              aria-label="Toggle sidebar"
            >
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Sidebar - Desktop */}
        <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:border-r lg:border-nh-admin-border lg:bg-nh-admin-bg">
          <div className="flex flex-col h-full p-4">
            <nav className="flex-1 space-y-1">
              {SIDEBAR_LINKS.map((item) => (
                <Link
                  key={item.label}
                  to={item.path}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold transition-all",
                    isActive(item.path)
                      ? "bg-nh-admin-primary-bg text-nh-admin-primary border border-nh-admin-primary-border"
                      : "text-nh-admin-text-secondary hover:bg-nh-admin-surface-hover hover:text-white border border-transparent"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="mt-auto pt-4 border-t border-nh-admin-border space-y-2">
              <Link
                to="/"
                className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold text-nh-admin-text-secondary transition-all hover:bg-nh-admin-surface-hover hover:text-white"
              >
                <Home className="h-5 w-5" />
                Back to Site
              </Link>
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold text-nh-admin-danger transition-all hover:bg-nh-admin-danger-bg"
              >
                <LogOut className="h-5 w-5" />
                Sign Out
              </button>
            </div>
          </div>
        </aside>

        {/* Sidebar - Mobile Overlay */}
        <AnimatePresence>
          {sidebarOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSidebarOpen(false)}
                className="fixed inset-0 bg-nh-admin-backdrop-light backdrop-blur-sm z-[100] lg:hidden"
              />
              <motion.div
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed bottom-0 left-0 top-0 z-[110] flex w-72 flex-col border-r border-nh-admin-border bg-nh-admin-bg p-6 shadow-2xl lg:hidden"
              >
                <div className="flex justify-between items-center mb-8">
                  <h2 className="text-xl font-black italic uppercase tracking-tight text-nh-admin-text">Admin</h2>
                  <button onClick={() => setSidebarOpen(false)} className="rounded-full border border-nh-admin-border bg-nh-admin-surface p-2 text-nh-admin-text transition-colors hover:border-nh-admin-primary">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <nav className="flex-1 space-y-1">
                  {SIDEBAR_LINKS.map((item) => (
                    <Link
                      key={item.label}
                      to={item.path}
                      onClick={() => setSidebarOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold transition-all",
                        isActive(item.path)
                          ? "bg-nh-admin-primary-bg text-nh-admin-primary border border-nh-admin-primary-border"
                          : "text-nh-admin-text-secondary hover:bg-nh-admin-surface-hover hover:text-white border border-transparent"
                      )}
                    >
                      <item.icon className="h-5 w-5" />
                      {item.label}
                    </Link>
                  ))}
                </nav>

                <div className="mt-auto pt-4 border-t border-nh-admin-border space-y-2">
                  <Link
                    to="/"
                    onClick={() => setSidebarOpen(false)}
                    className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold text-nh-admin-text-secondary transition-all hover:bg-nh-admin-surface-hover hover:text-white"
                  >
                    <Home className="h-5 w-5" />
                    Back to Site
                  </Link>
                  <button
                    onClick={() => { setSidebarOpen(false); handleLogout() }}
                    className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold text-nh-admin-danger transition-all hover:bg-nh-admin-danger-bg"
                  >
                    <LogOut className="h-5 w-5" />
                    Sign Out
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Main Content */}
        <main className="flex-1 bg-nh-admin-bg">
          <div className="mx-auto w-full max-w-7xl px-4 py-8 pb-28 sm:px-6 lg:px-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
