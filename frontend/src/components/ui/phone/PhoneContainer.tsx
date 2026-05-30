import type { ReactNode } from 'react'

interface PhoneContainerProps {
  children: ReactNode
  className?: string
}

export function PhoneContainer({ children, className = '' }: PhoneContainerProps) {
  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-[44px] border-[1.5px] border-nh-border bg-nh-bg shadow-[0_32px_80px_rgba(0,0,0,0.6)] ${className}`}
      style={{ width: 375, height: 812 }}
    >
      <div className="absolute inset-0 overflow-y-auto overflow-x-hidden scrollbar-hide">
        {children}
      </div>
    </div>
  )
}