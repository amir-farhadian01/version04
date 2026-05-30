import { useState, useEffect, useCallback } from 'react'
import { AlertTriangle, X } from 'lucide-react'

export type ModerationWarningProps = {
  /** Detected PII types */
  reasons: string[]
  /** User-friendly explanation */
  warningText: string
  /** Called when the user dismisses the warning */
  onDismiss: () => void
  /** Optional alternative phrasing suggestion */
  suggestion?: string
  /** Auto-dismiss timeout in ms (default: 10000) */
  autoDismissMs?: number
}

/**
 * Inline warning banner that appears in the chat UI when a message is blocked
 * or masked due to PII detection.
 *
 * - Auto-dismisses after `autoDismissMs` (default 10s)
 * - Dismisses on click of the X button
 * - Animated entry/exit
 * - Red/orange color scheme for urgency
 */
export function ModerationWarning({
  reasons,
  warningText,
  onDismiss,
  suggestion,
  autoDismissMs = 10000,
}: ModerationWarningProps) {
  const [visible, setVisible] = useState(true)
  const [exiting, setExiting] = useState(false)

  const dismiss = useCallback(() => {
    setExiting(true)
    setTimeout(() => {
      setVisible(false)
      onDismiss()
    }, 200)
  }, [onDismiss])

  useEffect(() => {
    if (autoDismissMs <= 0) return
    const timer = setTimeout(dismiss, autoDismissMs)
    return () => clearTimeout(timer)
  }, [autoDismissMs, dismiss])

  if (!visible) return null

  return (
    <div
      className={`
        mx-2 mb-2 overflow-hidden rounded-xl border border-nh-danger/30
        bg-gradient-to-r from-nh-danger/10 to-nh-accent/10
        backdrop-blur-sm transition-all duration-200
        ${exiting ? 'translate-y-2 opacity-0' : 'translate-y-0 opacity-100'}
      `}
      role="alert"
    >
      <div className="flex items-start gap-3 p-3">
        {/* Icon */}
        <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-nh-danger/20">
          <AlertTriangle className="h-4 w-4 text-nh-danger" />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-nh-danger">
            Message Blocked
          </p>
          <p className="mt-0.5 text-xs text-nh-text-secondary">
            {warningText}
          </p>

          {/* PII type badges */}
          {reasons.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {reasons.map((reason) => (
                <span
                  key={reason}
                  className="inline-flex items-center rounded-full border border-nh-danger/20 bg-nh-danger/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-nh-danger"
                >
                  {reason.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          )}

          {/* Suggestion */}
          {suggestion && (
            <p className="mt-1.5 text-xs italic text-nh-text-muted">
              💡 {suggestion}
            </p>
          )}
        </div>

        {/* Dismiss button */}
        <button
          onClick={dismiss}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-nh-danger/60 transition-colors hover:bg-nh-danger/20 hover:text-nh-danger"
          aria-label="Dismiss warning"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
