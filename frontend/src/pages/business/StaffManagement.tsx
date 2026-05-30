import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import api from '../../lib/api'

interface StaffMember {
  id: string
  displayName: string | null
  firstName: string | null
  lastName: string | null
  avatarUrl: string | null
  email: string
  phone: string | null
  bio: string | null
  role: string
  staffRole: string | null
  isActive: boolean
  assignedServices: string[]
  upcomingAppointments: number
  joinedAt: string
}

export default function StaffManagement() {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showInvite, setShowInvite] = useState(false)
  const [inviteUserId, setInviteUserId] = useState('')
  const [inviteRole, setInviteRole] = useState('staff')
  const [inviteStaffRole, setInviteStaffRole] = useState('')

  const fetchStaff = () => {
    if (!workspaceId) return
    setLoading(true)
    api.get(`/staff/${workspaceId}`)
      .then((res) => setStaff(res.data.staff ?? []))
      .catch((err) => setError(err?.response?.data?.error ?? 'Failed to load staff'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchStaff() }, [workspaceId])

  const handleInvite = async () => {
    if (!workspaceId || !inviteUserId) return
    try {
      await api.post(`/staff/${workspaceId}/invite`, {
        userId: inviteUserId,
        role: inviteRole,
        staffRole: inviteStaffRole || undefined,
      })
      setShowInvite(false)
      setInviteUserId('')
      setInviteRole('staff')
      setInviteStaffRole('')
      fetchStaff()
    } catch (err: unknown) {
      alert((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to invite staff')
    }
  }

  const handleRoleChange = async (userId: string, role: string) => {
    if (!workspaceId) return
    try {
      await api.put(`/staff/${workspaceId}/${userId}`, { role })
      fetchStaff()
    } catch (err: unknown) {
      alert((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to update role')
    }
  }

  const handleStaffRoleChange = async (userId: string, staffRole: string) => {
    if (!workspaceId) return
    try {
      await api.put(`/staff/${workspaceId}/${userId}`, { staffRole })
      fetchStaff()
    } catch (err: unknown) {
      alert((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to update staff role')
    }
  }

  const handleRemove = async (userId: string) => {
    if (!workspaceId || !confirm('Remove this staff member?')) return
    try {
      await api.delete(`/staff/${workspaceId}/${userId}`)
      fetchStaff()
    } catch (err: unknown) {
      alert((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to remove staff')
    }
  }

  const handleToggleActive = async (userId: string, currentActive: boolean) => {
    if (!workspaceId) return
    try {
      await api.put(`/staff/${workspaceId}/${userId}/activate`, { isActive: !currentActive })
      fetchStaff()
    } catch (err: unknown) {
      alert((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to toggle status')
    }
  }

  if (loading) {
    return <div className="p-6 text-nh-text-secondary text-center">Loading staff...</div>
  }

  if (error) {
    return <div className="p-6 text-nh-danger text-center">{error}</div>
  }

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <div>
          <div className="text-lg font-bold text-nh-text font-heading">Staff Directory</div>
          <div className="text-xs text-nh-text-muted mt-0.5">{staff.length} members</div>
        </div>
        <button onClick={() => setShowInvite(!showInvite)} className="bg-nh-primary text-white border-0 rounded-lg px-4 py-2 text-xs font-semibold cursor-pointer">
          + Invite Staff
        </button>
      </div>

      {/* Invite Form */}
      {showInvite && (
        <div className="bg-nh-surface rounded-xl p-4 mb-4 border border-nh-border">
          <div className="text-sm font-semibold text-nh-text mb-3">Invite Staff Member</div>
          <div className="flex flex-col gap-2.5">
            <input
              placeholder="User ID"
              value={inviteUserId}
              onChange={(e) => setInviteUserId(e.target.value)}
              className="px-3 py-2 rounded-lg border border-nh-border bg-nh-bg text-nh-text text-xs"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              className="px-3 py-2 rounded-lg border border-nh-border bg-nh-bg text-nh-text text-xs"
            >
              <option value="staff">Staff</option>
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
            <input
              placeholder="Staff Role (e.g., technician, consultant)"
              value={inviteStaffRole}
              onChange={(e) => setInviteStaffRole(e.target.value)}
              className="px-3 py-2 rounded-lg border border-nh-border bg-nh-bg text-nh-text text-xs"
            />
            <div className="flex gap-2">
              <button onClick={handleInvite} className="flex-1 bg-nh-primary text-white border-0 rounded-lg py-2 text-xs font-semibold cursor-pointer">
                Send Invite
              </button>
              <button onClick={() => setShowInvite(false)} className="bg-transparent text-nh-text-muted border border-nh-border rounded-lg px-4 py-2 text-xs cursor-pointer">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Staff List */}
      {staff.length === 0 ? (
        <div className="text-center text-[13px] text-nh-text-muted p-6">No staff members yet. Invite your first team member!</div>
      ) : (
        staff.map((member) => (
          <div key={member.id} className="bg-nh-surface rounded-xl p-[14px] mb-2.5 border border-nh-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-nh-surface-elevated flex items-center justify-center text-sm font-semibold text-nh-text-secondary overflow-hidden shrink-0">
                {member.avatarUrl ? (
                  <img src={member.avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  (member.firstName?.[0] ?? member.displayName?.[0] ?? '?').toUpperCase()
                )}
              </div>
              <div className="flex-1">
                <div className="text-[13px] font-semibold text-nh-text">
                  {member.displayName ?? `${member.firstName ?? ''} ${member.lastName ?? ''}`}
                </div>
                <div className="text-[11px] text-nh-text-muted mt-0.5">
                  {member.staffRole ?? member.role} · {member.upcomingAppointments} upcoming
                </div>
              </div>
              <div className="flex gap-1.5 items-center">
                <select
                  value={member.role}
                  onChange={(e) => handleRoleChange(member.id, e.target.value)}
                  className="px-2 py-1 rounded-md border border-nh-border bg-nh-bg text-nh-text text-[10px]"
                >
                  <option value="staff">Staff</option>
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-2.5">
              <input
                placeholder="Staff role"
                value={member.staffRole ?? ''}
                onChange={(e) => handleStaffRoleChange(member.id, e.target.value)}
                className="flex-1 px-2 py-1 rounded-md border border-nh-border bg-nh-bg text-nh-text text-[10px]"
              />
              <button
                onClick={() => handleToggleActive(member.id, member.isActive)}
                className={`px-2.5 py-1 rounded-md border border-nh-border text-[10px] cursor-pointer ${member.isActive ? 'bg-nh-success/10 text-nh-success' : 'bg-nh-surface-elevated text-nh-text-muted'}`}
              >
                {member.isActive ? 'Active' : 'Inactive'}
              </button>
              <button
                onClick={() => handleRemove(member.id)}
                className="px-2.5 py-1 rounded-md border border-nh-danger/30 bg-nh-danger/10 text-nh-danger text-[10px] cursor-pointer"
              >
                Remove
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  )
}