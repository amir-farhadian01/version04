import { Link } from 'react-router-dom'
import { cn } from '../../lib/cn'
import type { User } from '../../store/authStore'

function initialsFromUser(u: Pick<User, 'firstName' | 'lastName' | 'email'>): string {
  const fn = u.firstName?.trim()
  const ln = u.lastName?.trim()
  if (fn && ln) return `${fn[0]!}${ln[0]!}`.toUpperCase()
  const em = u.email?.trim()
  if (em && em.length >= 2) return em.slice(0, 2).toUpperCase()
  return '?'
}

export interface AccountAvatarBadgeProps {
  user: User
  className?: string
  /** Pixel-ish size tier */
  size?: 'sm' | 'md'
}

/**
 * Circular framed account photo (or initials) for persistent top-bar identity.
 */
export function AccountAvatarBadge({ user, className, size = 'md' }: AccountAvatarBadgeProps) {
  const href = '/profile'
  const label = [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.email
  const box = size === 'sm' ? 'h-9 w-9 min-h-9 min-w-9' : 'h-10 w-10 min-h-10 min-w-10'
  const textSize = size === 'sm' ? 'text-[10px]' : 'text-xs'

  return (
    <Link
      to={href}
      title={label}
      aria-label={`Account: ${label}`}
      className={cn(
        'shrink-0 rounded-full p-0.5 ring-2 ring-nh-border-elevated bg-nh-surface-elevated shadow-sm',
        'hover:ring-nh-text-secondary transition-[box-shadow,ring-color]',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white',
        className
      )}
    >
      {user.avatarUrl ? (
        <img
          src={user.avatarUrl}
          alt=""
          className={cn('rounded-full object-cover', box)}
        />
      ) : (
        <span
          className={cn(
            'flex items-center justify-center rounded-full font-black text-nh-primary bg-nh-primary/15',
            box,
            textSize
          )}
        >
          {initialsFromUser(user)}
        </span>
      )}
    </Link>
  )
}
