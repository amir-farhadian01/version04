import { Outlet } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { PhoneContainer } from '../ui/phone/PhoneContainer'
import { StatusBar } from '../ui/phone/StatusBar'
import { BottomNav, NavIcons } from '../ui/phone/BottomNav'
import { AccountAvatarBadge } from '../ui/AccountAvatarBadge'

/**
 * AppShell — Persistent shared shell for all main pages.
 *
 * Provides:
 * - PhoneContainer framing (375×812)
 * - Sticky header with StatusBar + user avatar
 * - Scrollable content area via <Outlet />
 * - Floating bottom navigation bar
 *
 * Auth pages (Login) and full-screen flows (OrderWizard) are excluded
 * from this shell by using different layouts.
 */
export function AppShell() {
  const { user } = useAuthStore()

  return (
    <div className="flex min-h-screen items-center justify-center bg-nh-bg px-4 py-5 pb-10 font-sans">
      <PhoneContainer>
        <div className="relative h-full flex flex-col bg-nh-bg">
          {/* ── Header ── */}
          <div className="sticky top-0 z-50 bg-nh-bg/90 backdrop-blur-lg border-b border-nh-border shrink-0">
            <div className="flex items-center justify-between px-4 py-2">
              <StatusBar title="9:41" showNotifDot />
              {user && (
                <AccountAvatarBadge user={user} size="sm" />
              )}
            </div>
          </div>

          {/* ── Content ── */}
          <div className="flex-1 overflow-auto">
            <Outlet />
          </div>

          {/* ── Bottom Nav ── */}
          <div className="absolute left-0 right-0 bottom-6 z-50 px-10">
            <BottomNav
              items={[
                { id: 'home', label: 'Home', icon: NavIcons.home },
                { id: 'social', label: 'Explorer', icon: NavIcons.social },
                { id: 'activity', label: 'Activity', icon: NavIcons.activity },
                { id: 'biz', label: 'Business', isBiz: true, icon: NavIcons.business },
              ]}
            />
          </div>
        </div>
      </PhoneContainer>
    </div>
  )
}