import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

/**
 * PageHeader — Consistent sticky header for pages that use SimpleLayout.
 *
 * Provides:
 * - Optional back button (← arrow)
 * - Centered title
 * - Optional right action slot
 *
 * Used by: SimpleLayout (auth, order wizard, order detail)
 * Visual style matches AppShell header.
 */
export interface PageHeaderProps {
  title?: string
  showBack?: boolean
  onBack?: () => void
  rightAction?: React.ReactNode
}

export function PageHeader({ title, showBack, onBack, rightAction }: PageHeaderProps) {
  const navigate = useNavigate()

  const handleBack = onBack ?? (() => navigate(-1))

  return (
    <div className="sticky top-0 z-50 bg-nh-bg/90 backdrop-blur-lg border-b border-nh-border shrink-0">
      <div className="flex items-center justify-between px-4 py-2 min-h-[44px]">
        {/* Left: Back button or spacer */}
        <div className="w-10">
          {showBack && (
            <button
              onClick={handleBack}
              className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-white/10 transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft className="w-5 h-5 text-nh-text" />
            </button>
          )}
        </div>

        {/* Center: Title */}
        <div className="flex-1 text-center">
          {title && (
            <h1 className="text-base font-semibold text-nh-text truncate">
              {title}
            </h1>
          )}
        </div>

        {/* Right: Action or spacer */}
        <div className="w-10 flex items-center justify-end">
          {rightAction}
        </div>
      </div>
    </div>
  )
}