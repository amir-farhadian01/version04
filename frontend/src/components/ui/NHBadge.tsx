import { cn } from '../../lib/cn'

interface NHBadgeProps {
  variant: 'verified' | 'new' | 'featured' | 'category'
  label: string
  className?: string
}

const variantClasses = {
  verified: 'bg-nh-success/20 text-nh-success',
  new: 'bg-nh-primary/20 text-nh-primary',
  featured: 'bg-nh-accent/20 text-nh-accent',
  category: 'bg-nh-category-bg text-nh-text-secondary rounded-full',
} as const

/**
 * NHBadge — NeighborHub badge/tag.
 * Variants: verified (green checkmark), new (blue), featured (orange), category (rounded pill).
 */
export function NHBadge({ variant, label, className }: NHBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
        variantClasses[variant],
        className,
      )}
    >
      {variant === 'verified' && (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
        </svg>
      )}
      {label}
    </span>
  )
}