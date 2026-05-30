interface StaffMember {
  id: string
  displayName: string | null
  firstName: string | null
  lastName: string | null
  avatarUrl: string | null
  bio: string | null
  role: string
  staffRole: string | null
  assignedServiceCount: number
}

interface Props {
  staff: StaffMember
  _workspaceId?: string
  onAssignPhoto?: (staffId: string) => void
  onRemovePhoto?: (staffId: string) => void
}

/**
 * StaffIdentityCard — Displays per-service staff photo + name.
 * Required before in-person service commences.
 * Shows a warning if staff has no profile photo.
 */
export default function StaffIdentityCard({ staff, onAssignPhoto, onRemovePhoto }: Props) {
  const fullName = staff.displayName ?? [staff.firstName, staff.lastName].filter(Boolean).join(' ') ?? 'Unnamed Staff'
  const initials = (staff.firstName?.[0] ?? '') + (staff.lastName?.[0] ?? '') || fullName[0]

  return (
    <div className="bg-white rounded-xl shadow-sm border p-4 flex items-center gap-4">
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        {staff.avatarUrl ? (
          <img
            src={staff.avatarUrl}
            alt={fullName}
            className="w-14 h-14 rounded-full object-cover border-2 border-blue-100"
          />
        ) : (
          <div className="w-14 h-14 rounded-full bg-gray-200 flex items-center justify-center text-lg font-semibold text-gray-500 border-2 border-red-200">
            {initials[0]?.toUpperCase() ?? '?'}
          </div>
        )}

        {/* Photo warning badge */}
        {!staff.avatarUrl && (
          <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center" title="No profile photo — required before service">
            !
          </span>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-gray-900">{fullName}</h4>
        <p className="text-xs text-gray-500 mt-0.5">
          {staff.staffRole ? staff.staffRole.charAt(0).toUpperCase() + staff.staffRole.slice(1) : staff.role}
          {staff.assignedServiceCount > 0 && (
            <> · {staff.assignedServiceCount} service{staff.assignedServiceCount > 1 ? 's' : ''} assigned</>
          )}
        </p>
        {staff.bio && (
          <p className="text-xs text-gray-400 mt-1 line-clamp-2">{staff.bio}</p>
        )}

        {/* Photo requirement warning */}
        {!staff.avatarUrl && (
          <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
            <span>⚠️</span>
            Profile photo required before in-person service
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-1 flex-shrink-0">
        {onAssignPhoto && (
          <button
            onClick={() => onAssignPhoto(staff.id)}
            className="px-3 py-1 text-xs bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100"
          >
            {staff.avatarUrl ? 'Change Photo' : 'Add Photo'}
          </button>
        )}
        {staff.avatarUrl && onRemovePhoto && (
          <button
            onClick={() => onRemovePhoto(staff.id)}
            className="px-3 py-1 text-xs text-red-500 hover:bg-red-50 rounded-full"
          >
            Remove
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * StaffIdentityGrid — Renders a grid of staff identity cards.
 * Used on the business page or service detail page.
 */
export function StaffIdentityGrid({
  staffList,
  emptyMessage = 'No staff members assigned',
}: {
  staffList: StaffMember[]
  workspaceId?: string
  onAssignPhoto?: (staffId: string) => void
  onRemovePhoto?: (staffId: string) => void
  emptyMessage?: string
}) {
  if (staffList.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400 text-sm">
        {emptyMessage}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {staffList.map((staff) => (
        <StaffIdentityCard
          key={staff.id}
          staff={staff}
        />
      ))}
    </div>
  )
}