interface StaffMember {
  id: string
  displayName: string | null
  firstName: string | null
  lastName: string | null
  avatarUrl: string | null
}

interface ActivityItem {
  title: string
  subtitle: string
  icon: string
  colorClass: string
  time: string
  staff?: StaffMember
}

const ACTIVITIES: ActivityItem[] = [
  {
    title: 'Your order was confirmed',
    subtitle: "Mike's Plumbing",
    icon: 'check_circle',
    colorClass: 'text-nh-success bg-nh-success/15',
    time: '2 min ago',
    staff: { id: '1', displayName: 'Mike R.', firstName: 'Mike', lastName: 'R.', avatarUrl: null },
  },
  {
    title: 'New provider in your area',
    subtitle: 'CleanPro Services joined NeighborHub',
    icon: 'person_add',
    colorClass: 'text-nh-primary bg-nh-primary/15',
    time: '15 min ago',
  },
  {
    title: 'Service request accepted',
    subtitle: 'Sarah M. accepted your Electrical Repair request',
    icon: 'handshake',
    colorClass: 'text-nh-accent bg-nh-accent/15',
    time: '1 hour ago',
  },
  {
    title: 'Payment received',
    subtitle: '$149.00 for Deep Cleaning service',
    icon: 'payment',
    colorClass: 'text-nh-success bg-nh-success/15',
    time: '3 hours ago',
  },
  {
    title: 'Review reminder',
    subtitle: 'Rate your experience with FixIt Co.',
    icon: 'rate_review',
    colorClass: 'text-nh-warning bg-nh-warning/15',
    time: '5 hours ago',
  },
  {
    title: 'Appointment rescheduled',
    subtitle: 'AC Service moved to Jun 15 at 2:00 PM',
    icon: 'schedule',
    colorClass: 'text-nh-primary bg-nh-primary/15',
    time: '1 day ago',
  },
] as const

/** Map icon name to SVG path */
const ICON_PATHS: Record<string, string> = {
  check_circle: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z',
  person_add: 'M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z',
  handshake: 'M16.48 2.52c-1.95-.97-4.27-.97-6.22 0L2.52 10.26c-.97 1.95-.97 4.27 0 6.22l7.74 7.74c1.95.97 4.27.97 6.22 0l7.74-7.74c.97-1.95.97-4.27 0-6.22l-7.74-7.74zM12 20l-4-4h8l-4 4zm0-16l4 4H8l4-4z',
  payment: 'M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z',
  rate_review: 'M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z',
  schedule: 'M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z',
}

/**
 * ActivityScreen — Matches Flutter's activity_screen.dart exactly.
 * Header with auto_awesome_motion icon, activity list with colored icons, floating bottom nav.
 */
export default function Activity() {
  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="px-[18px] py-[14px] bg-nh-bg border-b border-nh-border flex items-center gap-[10px]">
        <svg width="20" height="20" viewBox="0 0 24 24" className="fill-nh-primary">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
        </svg>
        <h1 className="font-heading text-lg font-bold text-nh-text m-0">
          Activity
        </h1>
      </div>

      {/* Activity List */}
      <div className="flex-1 overflow-auto px-[14px] pt-[14px]">
        {ACTIVITIES.map((act, i) => (
          <div
            key={i}
            className="bg-nh-surface rounded-xl p-3 mb-[10px] border border-nh-border flex items-start gap-3"
          >
            <div
              className={`w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 ${act.colorClass}`}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d={ICON_PATHS[act.icon] || ICON_PATHS.check_circle} />
              </svg>
            </div>
            <div className="flex-1">
              <div className="text-[13px] font-semibold text-nh-text leading-snug">
                {act.title}
              </div>
              <div className="text-[11px] text-nh-text-secondary mt-0.5">
                {act.subtitle}
              </div>
              <div className="text-[10px] text-nh-text-muted mt-1">
                {act.time}
              </div>
              {/* Staff Avatar */}
              {act.staff && (
                <div className="flex items-center gap-1.5 mt-1.5">
                  <div
                    className="w-5 h-5 rounded-full bg-nh-surface-elevated flex items-center justify-center text-[8px] font-semibold text-nh-text-secondary overflow-hidden shrink-0"
                    title={act.staff.displayName ?? `${act.staff.firstName ?? ''} ${act.staff.lastName ?? ''}`}
                  >
                    {act.staff.avatarUrl ? (
                      <img src={act.staff.avatarUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      (act.staff.firstName?.[0] ?? act.staff.displayName?.[0] ?? '?').toUpperCase()
                    )}
                  </div>
                  <span className="text-[10px] text-nh-text-secondary font-medium">
                    {act.staff.displayName ?? `${act.staff.firstName ?? ''} ${act.staff.lastName ?? ''}`}
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}
        {/* Bottom spacing for floating nav */}
        <div className="h-20" />
      </div>

    </div>
  )
}