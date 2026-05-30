interface StatusBarProps {
  title?: string
  onNotifClick?: () => void
  showNotifDot?: boolean
}

export function StatusBar({ title, onNotifClick, showNotifDot }: StatusBarProps) {
  return (
    <div className="flex h-12 items-center justify-between border-b border-nh-border bg-nh-bg px-[22px] pb-2 pt-[14px]">
      <span className="font-heading text-[13px] font-semibold text-nh-text">
        {title || '9:41'}
      </span>
      <div className="flex items-center gap-1.5">
        <svg width="14" height="14" viewBox="0 0 24 24" className="fill-nh-text">
          <path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z" />
        </svg>
        <svg width="14" height="14" viewBox="0 0 24 24" className="fill-nh-text">
          <path d="M15.67 4H14V2h-4v2H8.33C7.6 4 7 4.6 7 5.33v15.33C7 21.4 7.6 22 8.33 22h7.33c.74 0 1.34-.6 1.34-1.33V5.33C17 4.6 16.4 4 15.67 4z" />
        </svg>
        {onNotifClick && (
          <div className="relative cursor-pointer" onClick={onNotifClick}>
            <svg width="18" height="18" viewBox="0 0 24 24" className="fill-nh-text-secondary">
              <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" />
            </svg>
            {showNotifDot && (
              <div className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-nh-danger ring-[1.5px] ring-nh-bg" />
            )}
          </div>
        )}
      </div>
    </div>
  )
}