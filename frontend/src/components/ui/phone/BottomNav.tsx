import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../../store/authStore'
import { cn } from '../../../lib/cn'

interface NavItem {
  id: string
  label: string
  active?: boolean
  isBiz?: boolean
  icon: React.ReactNode
  onClick?: () => void
}

interface BottomNavProps {
  items: NavItem[]
}

/**
 * BottomNav — Floating glassmorphic bottom navigation bar.
 * Matches Flutter's BottomNav exactly: positioned at bottom with 24px margin,
 * rounded 28px, backdrop blur, semi-transparent background, subtle border.
 */
export function BottomNav({ items }: BottomNavProps) {
  const navigate = useNavigate()
  const { user } = useAuthStore()

  // Business roles: provider, owner, platform_admin, developer, support, finance
  const hasBizRole = user?.roles?.some((role) =>
    ['provider', 'owner', 'platform_admin', 'developer', 'support', 'finance'].includes(role.toLowerCase())
  )

  // Filter items: show business/dashboard items only if user has a business role
  const filteredItems = items.filter((item) => {
    if (item.isBiz || item.id === 'dash' || item.id === 'biz') {
      return hasBizRole
    }
    return true
  })

  const handleNav = (item: NavItem) => {
    if (item.onClick) {
      item.onClick()
      return
    }

    switch (item.id) {
      case 'home':
        navigate('/')
        break
      case 'social':
        navigate('/explorer')
        break
      case 'activity':
        navigate('/app/activity')
        break
      case 'profile':
        navigate('/app/profile')
        break
      case 'biz':
      case 'dash':
        if (user?.companyId) {
          navigate(`/business/${user.companyId}`)
        } else {
          navigate('/business/default')
        }
        break
      default:
        break
    }
  }

  const getIconFill = (item: NavItem): string => {
    if (item.active) return 'var(--nh-primary)'
    if (item.isBiz) return 'var(--nh-accent)'
    return 'var(--nh-text-muted)'
  }

  const getLabelColor = (item: NavItem): string => {
    if (item.active) return 'text-nh-primary'
    if (item.isBiz) return 'text-nh-accent'
    return 'text-nh-text-muted'
  }

  return (
    <div className="px-10 pb-6">
      <div
        className="relative rounded-[28px] backdrop-blur-[20px]"
        style={{
          background: 'rgba(18, 18, 26, 0.85)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <div
          className="flex h-16 items-center"
        >
          {filteredItems.map((item) => (
            <div
              key={item.id}
              onClick={() => handleNav(item)}
              className={cn(
                'flex flex-1 cursor-pointer flex-col items-center justify-center gap-1 transition-all duration-200',
                item.active && 'active',
                item.isBiz && 'nav-biz'
              )}
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill={getIconFill(item)}
                className="transition-all duration-200"
              >
                {item.icon}
              </svg>
              <span
                className={cn(
                  'text-[10px] font-medium transition-all duration-200',
                  getLabelColor(item)
                )}
              >
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Common nav icons as React elements — matching Flutter's Material Icons
export const NavIcons = {
  home: <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />,
  social: <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />,
  activity: <path d="M19.03 2.97c-.38-.38-.9-.59-1.42-.59-.52 0-1.04.21-1.43.59l-8.06 8.06-.31 2.35 2.35-.31 8.06-8.06c.39-.39.59-.91.59-1.43 0-.52-.2-1.04-.59-1.43zM17 7.34L10.94 13.4l-1.05.14.14-1.05L16.34 6.4l.66.94zM3 5v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V9h-2v10H5V5h7V3H5c-1.1 0-2 .9-2 2z" />,
  business: <path d="M20 6h-4V4c0-1.11-.89-2-2-2h-4c-1.11 0-2 .89-2 2v2H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-6 0h-4V4h4v2z" />,
}
