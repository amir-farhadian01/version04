import { Outlet } from 'react-router-dom'
import { PhoneContainer } from '../ui/phone/PhoneContainer'

/**
 * SimpleLayout — Minimal phone-frame wrapper without AppShell chrome.
 *
 * Used for auth pages (Login) and full-screen flows (OrderWizard)
 * that should not show the persistent header avatar or bottom nav.
 */
export function SimpleLayout() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-nh-bg px-4 py-5 pb-10 font-sans">
      <PhoneContainer>
        <Outlet />
      </PhoneContainer>
    </div>
  )
}