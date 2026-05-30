import { useState } from 'react'
import { Link, useNavigate, useLocation, Outlet } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
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
} from 'lucide-react'
import { cn } from '../../lib/cn'
import { motion, AnimatePresence } from 'motion/react'
import { AccountAvatarBadge } from '../ui/AccountAvatarBadge'

const SIDEBAR_LINKS = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '' },
  { label: 'Users', icon: Users, path: 'users' },
  { label: 'KYC', icon: ShieldCheck, path: 'kyc' },
  { label: 'Orders', icon: ShoppingCart, path: 'orders' },
  { label: 'Contracts', icon: FileText, path: 'contracts' },
  { label: 'Payments', icon: CreditCard, path: 'payments' },
  { label: 'Media', icon: Image, path: 'media' },
  { label: 'Settings', icon: Settings, path: 'settings' },
]

export function AdminLayout() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/auth/login')
  }

  const isActive = (path: string) => {
    const base = '/admin'
    if (!path) return location.pathname === base
    return location.pathname === `${base}/${path}`
  }

  return (
    <div className="min-h-screen bg-[#0d0f1a] font-sans text-[#f0f2ff] flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-[#2a2f4a] bg-[#0d0f1a]/95 backdrop-blur-xl">
        <div className="w-full px-3 sm:px-5 lg:px-6 h-16 flex items-center">
          <Link to="/admin" className="flex items-center gap-2 shrink-0">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#2b6eff]/30 bg-[#2b6eff]/15 text-[#2b6eff]">
              <Home className="h-5 w-5 fill-current" />
            </span>
            <span>
              <span className="block text-lg font-black tracking-tight text-white">NeighborHub</span>
              <span className="hidden text-[10px] font-bold uppercase tracking-[0.12em] text-[#4a4f70] sm:block">Admin Panel</span>
            </span>
          </Link>

          <div className="ml-auto flex items-center gap-3 sm:gap-4">
            {user?.email && (
              <span className="hidden md:inline max-w-[220px] truncate text-xs text-[#4a4f70] font-medium" title={user.email}>
                {user.email}
              </span>
            )}
            {user && (
              <Link
                to="/notifications"
                className="relative flex h-10 w-10 items-center justify-center rounded-full border border-[#2a2f4a] bg-[#1e2235] text-[#8b90b0] transition hover:border-[#2b6eff] hover:text-white"
                aria-label="Notifications"
              >
                <Bell className="h-5 w-5" />
                <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-[#ff4d4d] ring-2 ring-[#1e2235]" />
              </Link>
            )}
            {user && <AccountAvatarBadge user={user} />}

            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-[#2a2f4a] bg-[#1e2235] text-[#8b90b0] transition hover:border-[#2b6eff] hover:text-white lg:hidden"
              aria-label="Toggle sidebar"
            >
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Sidebar - Desktop */}
        <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:border-r lg:border-[#2a2f4a] lg:bg-[#0d0f1a]">
          <div className="flex flex-col h-full p-4">
            <nav className="flex-1 space-y-1">
              {SIDEBAR_LINKS.map((item) => (
                <Link
                  key={item.label}
                  to={item.path}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold transition-all",
                    isActive(item.path)
                      ? "bg-[#2b6eff]/15 text-[#2b6eff] border border-[#2b6eff]/30"
                      : "text-[#8b90b0] hover:bg-[#1e2235] hover:text-white border border-transparent"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="mt-auto pt-4 border-t border-[#2a2f4a] space-y-2">
              <Link
                to="/"
                className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold text-[#8b90b0] transition-all hover:bg-[#1e2235] hover:text-white"
              >
                <Home className="h-5 w-5" />
                Back to Site
              </Link>
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold text-[#ff4d4d] transition-all hover:bg-red-500/10"
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
                className="fixed inset-0 bg-neutral-900/40 backdrop-blur-sm z-[100] lg:hidden"
              />
              <motion.div
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed bottom-0 left-0 top-0 z-[110] flex w-72 flex-col border-r border-[#2a2f4a] bg-[#0d0f1a] p-6 shadow-2xl lg:hidden"
              >
                <div className="flex justify-between items-center mb-8">
                  <h2 className="text-xl font-black italic uppercase tracking-tight text-[#f0f2ff]">Admin</h2>
                  <button onClick={() => setSidebarOpen(false)} className="rounded-full border border-[#2a2f4a] bg-[#1e2235] p-2 text-[#f0f2ff] transition-colors hover:border-[#2b6eff]">
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
                          ? "bg-[#2b6eff]/15 text-[#2b6eff] border border-[#2b6eff]/30"
                          : "text-[#8b90b0] hover:bg-[#1e2235] hover:text-white border border-transparent"
                      )}
                    >
                      <item.icon className="h-5 w-5" />
                      {item.label}
                    </Link>
                  ))}
                </nav>

                <div className="mt-auto pt-4 border-t border-[#2a2f4a] space-y-2">
                  <Link
                    to="/"
                    onClick={() => setSidebarOpen(false)}
                    className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold text-[#8b90b0] transition-all hover:bg-[#1e2235] hover:text-white"
                  >
                    <Home className="h-5 w-5" />
                    Back to Site
                  </Link>
                  <button
                    onClick={() => { setSidebarOpen(false); handleLogout() }}
                    className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold text-[#ff4d4d] transition-all hover:bg-red-500/10"
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
        <main className="flex-1 bg-[#0d0f1a]">
          <div className="mx-auto w-full max-w-7xl px-4 py-8 pb-28 sm:px-6 lg:px-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
