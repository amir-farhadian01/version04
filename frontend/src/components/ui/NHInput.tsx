import type { InputHTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/cn'

interface NHInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  icon?: ReactNode
}

/**
 * NHInput — NeighborHub base text input.
 * Dark surface with subtle border, primary focus ring, error state.
 */
export function NHInput({
  label,
  error,
  icon,
  className,
  id,
  ...rest
}: NHInputProps) {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined)

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-nh-text-secondary">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-nh-text-muted">
            {icon}
          </div>
        )}
        <input
          id={inputId}
          className={cn(
            'w-full rounded-nh-input bg-nh-surface px-4 py-2.5 text-sm text-nh-text placeholder:text-nh-text-muted border border-nh-border transition-all duration-200',
            'focus:border-nh-primary focus:outline-none focus:ring-1 focus:ring-nh-primary',
            error && 'border-red-500 focus:border-red-500 focus:ring-red-500',
            icon && 'pl-10',
            className,
          )}
          {...rest}
        />
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}