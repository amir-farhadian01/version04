import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import api from '../lib/api'
import {
  ArrowLeft,
  User,
  Shield,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Save,
  Key,
  Send,
  RefreshCw,
  Eye,
  EyeOff,
  Globe,
  Smartphone,
  Fingerprint,
  Hash,
  Building2,
  Activity,
  Edit3,
  ShoppingCart,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type AdminUserFull = {
  id: string
  email: string
  phone: string | null
  firstName: string | null
  lastName: string | null
  displayName: string | null
  avatarUrl: string | null
  role: string
  staffRole: string | null
  status: string
  isVerified: boolean
  mfaEnabled: boolean
  gender: string | null
  address: string | null
  location: string | null
  bio: string | null
  birthDate: string | null
  createdAt: string
  updatedAt: string
  lastLoginAt: string | null
  lastSeenAt: string | null
  lastDevice: string | null
  lastIp: string | null
  registrationIp: string | null
  creditLimit: number | null
  currentDebt: number | null
  kyc: { personalStatus: string | null; businessStatus: string | null }
  ownedCompany: { id: string; name: string; kycStatus?: string } | null
  memberships: Array<{ companyId: string; companyName: string; role: string }>
  counts: {
    requestsAsCustomer: number
    requestsAsProvider: number
    contracts: number
    contractsAsCustomer: number
    contractsAsProvider: number
    services: number
  }
}

type UserDetailResponse = {
  user: AdminUserFull
  kycRecord: any
  auditLogs: any[]
  transactions: any[]
  contracts: any[]
  requests: any[]
  ordersSummary: any
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusBadge(status: string) {
  const map: Record<string, { color: string; icon: React.ReactNode }> = {
    active: { color: 'text-nh-admin-success bg-nh-admin-success-bg', icon: <CheckCircle2 className="h-3 w-3" /> },
    suspended: { color: 'text-nh-admin-danger bg-nh-admin-danger-bg', icon: <XCircle className="h-3 w-3" /> },
    pending: { color: 'text-nh-admin-warning bg-nh-admin-warning-bg', icon: <AlertCircle className="h-3 w-3" /> },
  }
  const s = map[status] ?? { color: 'text-nh-admin-text-secondary bg-nh-admin-border', icon: <AlertCircle className="h-3 w-3" /> }
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${s.color}`}>
      {s.icon}
      {status}
    </span>
  )
}

function kycBadge(status: string | null) {
  if (!status) return <span className="text-[11px] text-nh-admin-text-muted">—</span>
  const map: Record<string, string> = {
    verified: 'text-nh-admin-success bg-nh-admin-success-bg',
    pending: 'text-nh-admin-warning bg-nh-admin-warning-bg',
    rejected: 'text-nh-admin-danger bg-nh-admin-danger-bg',
  }
  const c = map[status] ?? 'text-nh-admin-text-secondary bg-nh-admin-border'
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${c}`}>{status}</span>
}

function formatDate(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleString()
}

// ─── Detail Row Component ─────────────────────────────────────────────────────

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-nh-admin-border bg-nh-admin-surface-elevated p-4">
      <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-nh-admin-primary-bg text-nh-admin-primary">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-nh-admin-text-muted">{label}</p>
        <div className="mt-1 text-sm text-nh-admin-text">{value}</div>
      </div>
    </div>
  )
}

// ─── Editable Field ───────────────────────────────────────────────────────────

function EditableField({
  label,
  value,
  name,
  onChange,
  type = 'text',
  placeholder = '—',
}: {
  label: string
  value: string
  name: string
  onChange: (name: string, value: string) => void
  type?: string
  placeholder?: string
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-semibold uppercase tracking-wider text-nh-admin-text-muted">{label}</label>
      {type === 'select' ? (
        <select
          value={value}
          onChange={(e) => onChange(name, e.target.value)}
          className="w-full rounded-xl border border-nh-admin-border bg-nh-admin-surface px-3 py-2.5 text-sm text-nh-admin-text outline-none transition-all focus:border-nh-admin-primary-border"
        >
          {placeholder && <option value="">{placeholder}</option>}
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="pending_verification">Pending Verification</option>
        </select>
      ) : type === 'textarea' ? (
        <textarea
          value={value}
          onChange={(e) => onChange(name, e.target.value)}
          placeholder={placeholder}
          rows={3}
          className="w-full rounded-xl border border-nh-admin-border bg-nh-admin-surface px-3 py-2.5 text-sm text-nh-admin-text placeholder-nh-admin-text-muted outline-none transition-all focus:border-nh-admin-primary-border resize-none"
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(name, e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-xl border border-nh-admin-border bg-nh-admin-surface px-3 py-2.5 text-sm text-nh-admin-text placeholder-nh-admin-text-muted outline-none transition-all focus:border-nh-admin-primary-border"
        />
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdminUserDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [data, setData] = useState<UserDetailResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'general' | 'security' | 'activity' | 'orders'>('general')

  // Edit mode state
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Password change state
  const [newPassword, setNewPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Reset password email state
  const [sendingResetEmail, setSendingResetEmail] = useState(false)
  const [resetEmailMessage, setResetEmailMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const fetchUser = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const res = await api.get<UserDetailResponse>(`/admin/users/${id}/full`)
      setData(res.data)
      // Initialize edit form with current values
      const u = res.data.user
      setEditForm({
        firstName: u.firstName ?? '',
        lastName: u.lastName ?? '',
        displayName: u.displayName ?? '',
        email: u.email,
        phone: u.phone ?? '',
        status: u.status,
        role: u.role,
        gender: u.gender ?? '',
        address: u.address ?? '',
        bio: u.bio ?? '',
        isVerified: String(u.isVerified),
      })
    } catch (err: any) {
      setError(err?.response?.data?.error ?? err.message ?? 'Failed to load user')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { fetchUser() }, [fetchUser])

  const handleEditChange = (name: string, value: string) => {
    setEditForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSave = async () => {
    if (!id) return
    setSaving(true)
    setSaveMessage(null)
    try {
      await api.put(`/admin/users/${id}`, {
        firstName: editForm.firstName || null,
        lastName: editForm.lastName || null,
        displayName: editForm.displayName || null,
        email: editForm.email,
        phone: editForm.phone || null,
        status: editForm.status,
        role: editForm.role,
        gender: editForm.gender || null,
        address: editForm.address || null,
        bio: editForm.bio || null,
        isVerified: editForm.isVerified === 'true',
      })
      setSaveMessage({ type: 'success', text: 'User updated successfully' })
      setEditing(false)
      fetchUser()
    } catch (err: any) {
      setSaveMessage({ type: 'error', text: err?.response?.data?.error ?? err.message ?? 'Failed to save' })
    } finally {
      setSaving(false)
    }
  }

  const handleChangePassword = async () => {
    if (!id || !newPassword.trim()) {
      setPasswordMessage({ type: 'error', text: 'Please enter a new password' })
      return
    }
    if (newPassword.length < 6) {
      setPasswordMessage({ type: 'error', text: 'Password must be at least 6 characters' })
      return
    }
    setChangingPassword(true)
    setPasswordMessage(null)
    try {
      await api.post('/admin/change-password', { userId: id, newPassword })
      setPasswordMessage({ type: 'success', text: 'Password changed successfully' })
      setNewPassword('')
      setShowPassword(false)
    } catch (err: any) {
      setPasswordMessage({ type: 'error', text: err?.response?.data?.error ?? err.message ?? 'Failed to change password' })
    } finally {
      setChangingPassword(false)
    }
  }

  const handleSendResetEmail = async () => {
    if (!id) return
    setSendingResetEmail(true)
    setResetEmailMessage(null)
    try {
      const res = await api.post(`/admin/users/${id}/reset-password-email`)
      setResetEmailMessage({ type: 'success', text: res.data.message ?? 'Reset email sent' })
    } catch (err: any) {
      setResetEmailMessage({ type: 'error', text: err?.response?.data?.error ?? err.message ?? 'Failed to send email' })
    } finally {
      setSendingResetEmail(false)
    }
  }

  // ─── Loading / Error ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-nh-admin-border border-t-nh-admin-primary" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <button onClick={() => navigate('/admin/users')} className="flex items-center gap-2 text-sm text-nh-admin-primary hover:underline">
          <ArrowLeft className="h-4 w-4" /> Back to Users
        </button>
        <div className="rounded-2xl border border-nh-admin-danger/30 bg-nh-admin-danger-bg p-6 text-center">
          <p className="text-nh-admin-danger">{error ?? 'User not found'}</p>
        </div>
      </div>
    )
  }

  const user = data.user

  // ─── Tabs ──────────────────────────────────────────────────────────────────

  const tabs = [
    { key: 'general' as const, label: 'General', icon: User },
    { key: 'security' as const, label: 'Security', icon: Shield },
    { key: 'activity' as const, label: 'Activity', icon: Activity },
    { key: 'orders' as const, label: 'Orders', icon: ShoppingCart },
  ]

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/admin/users"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-nh-admin-border bg-nh-admin-surface text-nh-admin-text-secondary transition-all hover:border-nh-admin-primary hover:text-nh-admin-text"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-black text-nh-admin-text">
                {(user.displayName ?? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim()) || user.email}
              </h1>
              {statusBadge(user.status)}
            </div>
            <p className="mt-0.5 text-sm text-nh-admin-text-secondary">
              {user.role}{user.staffRole ? ` · ${user.staffRole}` : ''} · ID: {user.id.slice(0, 12)}...
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (editing) {
                handleSave()
              } else {
                setEditing(true)
              }
            }}
            disabled={saving}
            className="flex items-center gap-2 rounded-xl border border-nh-admin-primary bg-nh-admin-primary px-4 py-2 text-sm font-bold text-white transition-all hover:bg-nh-admin-primary-hover disabled:opacity-50"
          >
            {saving ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : editing ? (
              <Save className="h-4 w-4" />
            ) : (
              <Edit3 className="h-4 w-4" />
            )}
            {saving ? 'Saving...' : editing ? 'Save Changes' : 'Edit User'}
          </button>
          {editing && (
            <button
              onClick={() => {
                setEditing(false)
                // Reset form
                const u = data.user
                setEditForm({
                  firstName: u.firstName ?? '',
                  lastName: u.lastName ?? '',
                  displayName: u.displayName ?? '',
                  email: u.email,
                  phone: u.phone ?? '',
                  status: u.status,
                  role: u.role,
                  gender: u.gender ?? '',
                  address: u.address ?? '',
                  bio: u.bio ?? '',
                  isVerified: String(u.isVerified),
                })
                setSaveMessage(null)
              }}
              className="flex items-center gap-2 rounded-xl border border-nh-admin-border bg-nh-admin-surface px-4 py-2 text-sm text-nh-admin-text-secondary transition-all hover:border-app-red hover:text-nh-admin-danger"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Save Message */}
      {saveMessage && (
        <div
          className={`rounded-2xl border p-4 text-sm ${
            saveMessage.type === 'success'
              ? 'border-nh-admin-success/30 bg-nh-admin-success-bg text-nh-admin-success'
              : 'border-nh-admin-danger/30 bg-nh-admin-danger-bg text-nh-admin-danger'
          }`}
        >
          {saveMessage.text}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 rounded-2xl border border-nh-admin-border bg-nh-admin-surface-elevated p-1.5">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${
              activeTab === tab.key
                ? 'bg-nh-admin-primary text-white shadow-nh-admin-glow'
                : 'text-nh-admin-text-secondary hover:bg-nh-admin-surface-hover hover:text-nh-admin-text'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ─── TAB: General ──────────────────────────────────────────────────── */}
      {activeTab === 'general' && (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left Column — Avatar + Quick Info */}
          <div className="space-y-4 lg:col-span-1">
            {/* Avatar Card */}
            <div className="rounded-2xl border border-nh-admin-border bg-nh-admin-surface p-6 text-center">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-nh-admin-primary-bg text-nh-admin-primary text-3xl font-black">
                {(user.displayName ?? user.firstName ?? user.email)[0]?.toUpperCase() ?? '?'}
              </div>
              <h2 className="mt-4 text-lg font-bold text-nh-admin-text">
                {(user.displayName ?? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim()) || '—'}
              </h2>
              <p className="text-sm text-nh-admin-text-secondary">{user.email}</p>
              <div className="mt-3 flex justify-center gap-2">
                {statusBadge(user.status)}
                {user.isVerified ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-nh-admin-success-bg px-2 py-0.5 text-[11px] font-medium text-nh-admin-success">
                    <CheckCircle2 className="h-3 w-3" /> Verified
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-app-text-3/10 px-2 py-0.5 text-[11px] font-medium text-nh-admin-text-muted">
                    <XCircle className="h-3 w-3" /> Unverified
                  </span>
                )}
              </div>
            </div>

            {/* Stats Card */}
            <div className="rounded-2xl border border-nh-admin-border bg-nh-admin-surface p-5">
              <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-nh-admin-text-muted">Activity Stats</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-nh-admin-text-secondary">Requests (Customer)</span>
                  <span className="text-sm font-bold text-nh-admin-text">{user.counts.requestsAsCustomer}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-nh-admin-text-secondary">Requests (Provider)</span>
                  <span className="text-sm font-bold text-nh-admin-text">{user.counts.requestsAsProvider}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-nh-admin-text-secondary">Contracts</span>
                  <span className="text-sm font-bold text-nh-admin-text">{user.counts.contracts}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-nh-admin-text-secondary">Services</span>
                  <span className="text-sm font-bold text-nh-admin-text">{user.counts.services}</span>
                </div>
              </div>
            </div>

            {/* Company Card */}
            {user.ownedCompany && (
              <div className="rounded-2xl border border-nh-admin-border bg-nh-admin-surface p-5">
                <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-nh-admin-text-muted">
                  <Building2 className="mr-1 inline h-3 w-3" />
                  Company
                </h3>
                <p className="text-sm font-medium text-nh-admin-text">{user.ownedCompany.name}</p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-[11px] text-nh-admin-text-secondary">KYC:</span>
                  {kycBadge(user.ownedCompany.kycStatus ?? null)}
                </div>
              </div>
            )}
          </div>

          {/* Right Column — Editable Fields */}
          <div className="space-y-4 lg:col-span-2">
            <div className="rounded-2xl border border-nh-admin-border bg-nh-admin-surface p-6">
              <h3 className="mb-4 text-sm font-bold text-nh-admin-text">Profile Information</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <EditableField
                  label="First Name"
                  value={editForm.firstName}
                  name="firstName"
                  onChange={handleEditChange}
                />
                <EditableField
                  label="Last Name"
                  value={editForm.lastName}
                  name="lastName"
                  onChange={handleEditChange}
                />
                <EditableField
                  label="Username"
                  value={editForm.displayName}
                  name="displayName"
                  onChange={handleEditChange}
                />
                <EditableField
                  label="Email"
                  value={editForm.email}
                  name="email"
                  onChange={handleEditChange}
                  type="email"
                />
                <EditableField
                  label="Phone"
                  value={editForm.phone}
                  name="phone"
                  onChange={handleEditChange}
                />
                <EditableField
                  label="Gender"
                  value={editForm.gender}
                  name="gender"
                  onChange={handleEditChange}
                />
                <div className="sm:col-span-2">
                  <EditableField
                    label="Status"
                    value={editForm.status}
                    name="status"
                    onChange={handleEditChange}
                    type="select"
                  />
                </div>
                <div className="sm:col-span-2">
                  <EditableField
                    label="Address"
                    value={editForm.address}
                    name="address"
                    onChange={handleEditChange}
                  />
                </div>
                <div className="sm:col-span-2">
                  <EditableField
                    label="Bio"
                    value={editForm.bio}
                    name="bio"
                    onChange={handleEditChange}
                    type="textarea"
                  />
                </div>
              </div>
            </div>

            {/* Read-only Details */}
            <div className="rounded-2xl border border-nh-admin-border bg-nh-admin-surface p-6">
              <h3 className="mb-4 text-sm font-bold text-nh-admin-text">System Details</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <DetailRow
                  icon={<Calendar className="h-4 w-4" />}
                  label="Created"
                  value={formatDate(user.createdAt)}
                />
                <DetailRow
                  icon={<Clock className="h-4 w-4" />}
                  label="Updated"
                  value={formatDate(user.updatedAt)}
                />
                <DetailRow
                  icon={<Calendar className="h-4 w-4" />}
                  label="Last Login"
                  value={formatDate(user.lastLoginAt)}
                />
                <DetailRow
                  icon={<Calendar className="h-4 w-4" />}
                  label="Last Seen"
                  value={formatDate(user.lastSeenAt)}
                />
                <DetailRow
                  icon={<Smartphone className="h-4 w-4" />}
                  label="Last Device"
                  value={user.lastDevice ?? '—'}
                />
                <DetailRow
                  icon={<Globe className="h-4 w-4" />}
                  label="Last IP"
                  value={user.lastIp ?? '—'}
                />
                <DetailRow
                  icon={<Globe className="h-4 w-4" />}
                  label="Registration IP"
                  value={user.registrationIp ?? '—'}
                />
                <DetailRow
                  icon={<Fingerprint className="h-4 w-4" />}
                  label="MFA Enabled"
                  value={user.mfaEnabled ? 'Yes' : 'No'}
                />
                <DetailRow
                  icon={<Hash className="h-4 w-4" />}
                  label="Credit Limit"
                  value={user.creditLimit != null ? `$${user.creditLimit.toFixed(2)}` : '—'}
                />
                <DetailRow
                  icon={<Hash className="h-4 w-4" />}
                  label="Current Debt"
                  value={user.currentDebt != null ? `$${user.currentDebt.toFixed(2)}` : '—'}
                />
              </div>
            </div>

            {/* KYC Info */}
            <div className="rounded-2xl border border-nh-admin-border bg-nh-admin-surface p-6">
              <h3 className="mb-4 text-sm font-bold text-nh-admin-text">KYC Status</h3>
              <div className="flex gap-6">
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-nh-admin-text-muted">Personal</span>
                  <div className="mt-1">{kycBadge(user.kyc.personalStatus)}</div>
                </div>
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-nh-admin-text-muted">Business</span>
                  <div className="mt-1">{kycBadge(user.kyc.businessStatus)}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB: Security ──────────────────────────────────────────────────── */}
      {activeTab === 'security' && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Change Password */}
          <div className="rounded-2xl border border-nh-admin-border bg-nh-admin-surface p-6">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-nh-admin-primary-bg text-nh-admin-primary">
                <Key className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-nh-admin-text">Change Password</h3>
                <p className="text-[11px] text-nh-admin-text-secondary">Set a new password for this user</p>
              </div>
            </div>

            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password..."
                className="w-full rounded-xl border border-nh-admin-border bg-nh-admin-surface-elevated py-2.5 pl-4 pr-12 text-sm text-nh-admin-text placeholder-nh-admin-text-muted outline-none transition-all focus:border-nh-admin-primary-border"
              />
              <button
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-nh-admin-text-muted hover:text-nh-admin-text"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            {passwordMessage && (
              <div
                className={`mt-3 rounded-xl border p-3 text-sm ${
                  passwordMessage.type === 'success'
                    ? 'border-nh-admin-success/30 bg-nh-admin-success-bg text-nh-admin-success'
                    : 'border-nh-admin-danger/30 bg-nh-admin-danger-bg text-nh-admin-danger'
                }`}
              >
                {passwordMessage.text}
              </div>
            )}

            <button
              onClick={handleChangePassword}
              disabled={changingPassword || !newPassword.trim()}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-nh-admin-primary px-4 py-2.5 text-sm font-bold text-white transition-all hover:bg-nh-admin-primary-hover disabled:opacity-50"
            >
              {changingPassword ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Key className="h-4 w-4" />
              )}
              {changingPassword ? 'Changing...' : 'Change Password'}
            </button>
          </div>

          {/* Send Reset Password Email */}
          <div className="rounded-2xl border border-nh-admin-border bg-nh-admin-surface p-6">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-nh-admin-warning-bg text-nh-admin-warning">
                <Send className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-nh-admin-text">Send Reset Password Email</h3>
                <p className="text-[11px] text-nh-admin-text-secondary">Send a password reset link to {user.email}</p>
              </div>
            </div>

            {resetEmailMessage && (
              <div
                className={`mb-3 rounded-xl border p-3 text-sm ${
                  resetEmailMessage.type === 'success'
                    ? 'border-nh-admin-success/30 bg-nh-admin-success-bg text-nh-admin-success'
                    : 'border-nh-admin-danger/30 bg-nh-admin-danger-bg text-nh-admin-danger'
                }`}
              >
                {resetEmailMessage.text}
              </div>
            )}

            <button
              onClick={handleSendResetEmail}
              disabled={sendingResetEmail}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-app-warn bg-nh-admin-warning-bg px-4 py-2.5 text-sm font-bold text-nh-admin-warning transition-all hover:bg-nh-admin-warning-bg disabled:opacity-50"
            >
              {sendingResetEmail ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {sendingResetEmail ? 'Sending...' : `Send Reset Link to ${user.email}`}
            </button>
          </div>
        </div>
      )}

      {/* ─── TAB: Activity ──────────────────────────────────────────────────── */}
      {activeTab === 'activity' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-nh-admin-border bg-nh-admin-surface p-6">
            <h3 className="mb-4 text-sm font-bold text-nh-admin-text">Recent Audit Logs</h3>
            {data.auditLogs.length === 0 ? (
              <p className="text-sm text-nh-admin-text-secondary">No audit logs found</p>
            ) : (
              <div className="space-y-2">
                {data.auditLogs.slice(0, 10).map((log: any) => (
                  <div key={log.id} className="flex items-start gap-3 rounded-xl border border-nh-admin-border bg-nh-admin-surface-elevated p-3">
                    <Activity className="mt-0.5 h-4 w-4 text-nh-admin-text-muted" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-nh-admin-text">{log.action}</p>
                      <p className="text-[11px] text-nh-admin-text-muted">
                        {log.actor?.displayName ?? log.actor?.email ?? 'System'} · {formatDate(log.timestamp)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── TAB: Orders ───────────────────────────────────────────────────── */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-nh-admin-border bg-nh-admin-surface p-6">
            <h3 className="mb-4 text-sm font-bold text-nh-admin-text">Orders Summary</h3>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-nh-admin-border bg-nh-admin-surface-elevated p-4 text-center">
                <p className="text-2xl font-black text-nh-admin-text">{data.ordersSummary?.total ?? 0}</p>
                <p className="mt-1 text-[11px] text-nh-admin-text-secondary">Total Orders</p>
              </div>
              <div className="rounded-xl border border-nh-admin-border bg-nh-admin-surface-elevated p-4 text-center">
                <p className="text-2xl font-black text-nh-admin-text">{data.ordersSummary?.asCustomer ?? 0}</p>
                <p className="mt-1 text-[11px] text-nh-admin-text-secondary">As Customer</p>
              </div>
              <div className="rounded-xl border border-nh-admin-border bg-nh-admin-surface-elevated p-4 text-center">
                <p className="text-2xl font-black text-nh-admin-text">{data.ordersSummary?.asMatchedProvider ?? 0}</p>
                <p className="mt-1 text-[11px] text-nh-admin-text-secondary">As Provider</p>
              </div>
            </div>
            {data.ordersSummary?.byStatus && Object.keys(data.ordersSummary.byStatus).length > 0 && (
              <div className="mt-4">
                <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-nh-admin-text-muted">By Status</h4>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(data.ordersSummary.byStatus).map(([status, count]) => (
                    <span
                      key={status}
                      className="inline-flex items-center gap-1 rounded-full bg-nh-admin-border px-3 py-1 text-[11px] font-medium text-nh-admin-text-secondary"
                    >
                      {status}: <span className="text-nh-admin-text">{String(count)}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Recent Orders */}
          {data.ordersSummary?.recent && data.ordersSummary.recent.length > 0 && (
            <div className="rounded-2xl border border-nh-admin-border bg-nh-admin-surface p-6">
              <h3 className="mb-4 text-sm font-bold text-nh-admin-text">Recent Orders</h3>
              <div className="space-y-2">
                {data.ordersSummary.recent.slice(0, 10).map((order: any) => (
                  <div key={order.id} className="flex items-center justify-between rounded-xl border border-nh-admin-border bg-nh-admin-surface-elevated p-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-nh-admin-text">{order.serviceName ?? 'Order'}</p>
                      <p className="text-[11px] text-nh-admin-text-muted">
                        {order.relation} · {order.status} · {order.phase ?? '—'}
                      </p>
                    </div>
                    <span className="text-[11px] text-nh-admin-text-secondary">{formatDate(order.createdAt)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}