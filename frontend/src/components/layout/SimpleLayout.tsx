import { Outlet, useLocation } from 'react-router-dom'
import { PhoneContainer } from '../ui/phone/PhoneContainer'
import { PageHeader } from './PageHeader'

/**
 * SimpleLayout — Light chrome wrapper for standalone pages.
 *
 * Provides:
 * - PhoneContainer framing (375×812)
 * - Consistent sticky PageHeader with auto-derived title + back button
 * - Scrollable content area via <Outlet />
 * - Minimal footer with brand mark
 *
 * Used for: Auth (Login), Order flow (OrderWizard, OrderDetail), Order detail.
 * Does NOT include the full BottomNav — that's for AppShell only.
 */

/** Map route prefixes to page titles and back visibility */
const ROUTE_META: Record<string, { title: string; showBack: boolean }> = {
  '/auth': { title: 'Sign In', showBack: true },
  '/order/new': { title: 'New Order', showBack: true },
  '/orders/': { title: 'Order Details', showBack: true },
}

function getRouteMeta(pathname: string): { title: string; showBack: boolean } {
  // Check exact prefixes first (longer matches take priority)
  const matches = Object.entries(ROUTE_META)
    .filter(([prefix]) => pathname.startsWith(prefix))
    .sort((a, b) => b[0].length - a[0].length)
  if (matches.length > 0) {
    return matches[0][1]
  }
  return { title: '', showBack: false }
}

export function SimpleLayout() {
  const location = useLocation()
  const { title, showBack } = getRouteMeta(location.pathname)

  return (
    <div className="flex min-h-screen items-center justify-center bg-nh-bg px-4 py-5 pb-10 font-sans">
      <PhoneContainer>
        <div className="relative h-full flex flex-col bg-nh-bg">
          {/* ── Header ── */}
          <PageHeader title={title} showBack={showBack} />

          {/* ── Content ── */}
          <div className="flex-1 overflow-auto">
            <Outlet />
          </div>

          {/* ── Footer ── */}
          <div className="shrink-0 border-t border-nh-border bg-nh-bg/90 backdrop-blur-lg">
            <div className="flex items-center justify-center px-4 py-2">
              <span className="text-xs text-nh-text-muted">
                © Neighborly
              </span>
            </div>
          </div>
        </div>
      </PhoneContainer>
    </div>
  )
}