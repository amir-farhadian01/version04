import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/cn'

interface NHButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  children: ReactNode
}

const sizeClasses = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-5 py-2.5 text-sm',
  lg: 'px-6 py-3 text-base',
} as const

const variantClasses = {
  primary:
    'bg-nh-primary text-white hover:bg-nh-primary-hover active:bg-nh-primary-hover/80',
  secondary:
    'bg-nh-surface text-nh-text border border-nh-border hover:border-nh-primary/30 hover:text-nh-primary',
  ghost: 'bg-transparent text-nh-primary hover:bg-nh-primary/10',
} as const

/**
 * NHButton — NeighborHub base button.
 * Variants: primary (filled blue), secondary (outlined dark), ghost (transparent).
 */
export function NHButton({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  className,
  children,
  ...rest
}: NHButtonProps) {
  const isDisabled = disabled || loading

  return (
    <button
      disabled={isDisabled}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-nh-btn font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-nh-primary/50',
        sizeClasses[size],
        variantClasses[variant],
        isDisabled && 'cursor-not-allowed opacity-50',
        className,
      )}
      {...rest}
    >
      {loading && (
        <svg
          className="h-4 w-4 animate-spin"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  )
}