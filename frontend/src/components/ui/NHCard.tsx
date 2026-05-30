import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/cn'

interface NHCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  elevated?: boolean
  clickable?: boolean
}

/**
 * NHCard — NeighborHub base card.
 * Dark surface with subtle border and shadow.
 * Use elevated for modals/drawers, clickable for interactive cards.
 */
export function NHCard({
  children,
  elevated = false,
  clickable = false,
  className,
  ...rest
}: NHCardProps) {
  return (
    <div
      className={cn(
        'rounded-nh-card border border-nh-border shadow-nh-card',
        elevated ? 'bg-nh-surface-elevated' : 'bg-nh-surface',
        clickable && 'cursor-pointer transition-colors hover:border-nh-primary/30',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  )
}