import { useState, useEffect } from 'react'
import { StatusBar } from '../../components/ui/phone/StatusBar'
import { BottomNav, NavIcons } from '../../components/ui/phone/BottomNav'
import { useAuthStore } from '../../store/authStore'
import api from '../../lib/api'

/* ─── Types ─────────────────────────────────────────────────────────────── */
interface Address {
  id: string
  label: string
  street: string
  city: string
  province: string
  postalCode: string
  isDefault: boolean
}

interface Car {
  id: string
  label: string
  make: string
  model: string
  year?: number
  color?: string
  plate?: string
  isDefault: boolean
}

/* ─── Inline SVG Icons ──────────────────────────────────────────────────── */
const IconBadge = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-nh-text-secondary" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="4" width="16" height="16" rx="3" /><path d="M9 12l2 2 4-4" />
  </svg>
)
const IconEmail = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-nh-text-secondary" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2" /><path d="M22 4l-10 8L2 4" />
  </svg>
)
const IconPhone = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-nh-text-secondary" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.362 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0122 16.92z" />
  </svg>
)
const IconLock = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-nh-text-secondary" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
  </svg>
)
const IconVerified = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-nh-text-secondary" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" />
  </svg>
)
const IconDarkMode = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-nh-text-secondary" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
  </svg>
)
const IconLightMode = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-nh-text-secondary" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
  </svg>
)
const IconRocket = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 00-2.91-.09z" /><path d="M12 15l-3-3a22 22 0 012-3.95A12.88 12.88 0 0122 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 01-4 2z" /><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" /><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
  </svg>
)
const IconLogout = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-nh-danger" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
  </svg>
)
const IconChevronRight = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-nh-text-muted" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6" />
  </svg>
)
const IconCamera = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
    <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" /><circle cx="12" cy="13" r="4" />
  </svg>
)

/* ─── Component ──────────────────────────────────────────────────────────── */
export default function Profile() {
  const { user, refreshUser, logout } = useAuthStore()
  const [tabIndex, setTabIndex] = useState(0)

  // Profile data
  const [upgrading, setUpgrading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Address & Cars
  const [addresses, setAddresses] = useState<Address[]>([])
  const [cars, setCars] = useState<Car[]>([])
  const [addrLoading, setAddrLoading] = useState(false)
  const [carsLoading, setCarsLoading] = useState(false)

  // Modals
  const [editModal, setEditModal] = useState<{ field: string; value: string } | null>(null)
  const [pwModal, setPwModal] = useState(false)
  const [addrModal, setAddrModal] = useState<{ existing?: Address } | null>(null)
  const [carModal, setCarModal] = useState<{ existing?: Car } | null>(null)
  const [openMenu, setOpenMenu] = useState<string | null>(null)

  // Password fields
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')

  // Address form
  const [addrLabel, setAddrLabel] = useState('')
  const [addrStreet, setAddrStreet] = useState('')
  const [addrCity, setAddrCity] = useState('')
  const [addrProvince, setAddrProvince] = useState('')
  const [addrPostal, setAddrPostal] = useState('')

  // Car form
  const [carLabel, setCarLabel] = useState('')
  const [carMake, setCarMake] = useState('')
  const [carModel, setCarModel] = useState('')
  const [carYear, setCarYear] = useState('')
  const [carColor, setCarColor] = useState('')
  const [carPlate, setCarPlate] = useState('')

  // 2FA
  const [mfaEnabled, setMfaEnabled] = useState(false)

  // Dark mode state (stored in localStorage)
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('neighborly-dark-mode')
    return saved !== null ? saved === 'true' : true
  })

  const hasBizRole = user?.roles.some((role) =>
    ['provider', 'owner', 'platform_admin', 'developer', 'support', 'finance'].includes(role.toLowerCase())
  )
  const displayName = user?.displayName || `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'User'
  const initial = displayName.charAt(0).toUpperCase()
  const email = user?.email || ''
  const phone = user?.phone || ''
  const username = email ? `@${email.split('@')[0]}` : '@user'
  const role = user?.roles[0] || 'customer'

  // Apply dark mode
  useEffect(() => {
    localStorage.setItem('neighborly-dark-mode', String(isDark))
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light')
  }, [isDark])

  // ── API helpers ──────────────────────────────────────────────────────────

  const showSnack = (msg: string) => {
    const el = document.createElement('div')
    el.className = 'fixed bottom-[120px] left-1/2 -translate-x-1/2 bg-nh-surface text-nh-text px-5 py-3 rounded-[10px] text-[13px] z-[9999] border border-nh-border shadow-lg'
    el.textContent = msg
    document.body.appendChild(el)
    setTimeout(() => el.remove(), 2500)
  }

  const loadAddresses = async () => {
    setAddrLoading(true)
    try {
      const res = await api.get('/user-addresses')
      setAddresses(res.data.items || [])
    } catch { /* ignore */ }
    setAddrLoading(false)
  }

  const loadCars = async () => {
    setCarsLoading(true)
    try {
      const res = await api.get('/user-cars')
      setCars(res.data.items || [])
    } catch { /* ignore */ }
    setCarsLoading(false)
  }

  const handleTabChange = (index: number) => {
    setTabIndex(index)
    if (index === 1) {
      loadAddresses()
      loadCars()
    }
  }

  // ── Upgrade ──────────────────────────────────────────────────────────────

  const handleUpgrade = async () => {
    setUpgrading(true)
    setError(null)
    setSuccess(null)
    try {
      await api.post('/users/me/become-provider')
      await refreshUser()
      setSuccess('Congratulations! Your account has been upgraded to a Business Provider.')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Upgrade failed. Please ensure your KYC is verified.'
      setError(msg)
    }
    setUpgrading(false)
  }

  // ── Edit Dialogs ─────────────────────────────────────────────────────────

  const openEditModal = (field: string, currentValue: string) => {
    setEditModal({ field, value: currentValue })
  }

  const saveEditModal = async () => {
    if (!editModal) return
    const val = editModal.value.trim()
    if (val.length < 2) { showSnack('Value must be at least 2 characters'); return }

    try {
      if (editModal.field === 'displayName') {
        await api.put('/auth/me', { displayName: val })
        await refreshUser()
        showSnack('Display name updated')
      } else if (editModal.field === 'email') {
        if (!val.includes('@')) { showSnack('Invalid email'); return }
        await api.put('/auth/me/email', { email: val })
        await refreshUser()
        showSnack('Email updated')
      } else if (editModal.field === 'phone') {
        if (val.length < 5) { showSnack('Invalid phone number'); return }
        await api.put('/auth/me/phone', { phone: val })
        await refreshUser()
        showSnack('Phone number updated')
      }
    } catch (e: unknown) {
      showSnack((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to update')
    }
    setEditModal(null)
  }

  // ── Change Password ──────────────────────────────────────────────────────

  const handleChangePassword = async () => {
    if (!currentPw || !newPw || !confirmPw) { showSnack('All fields are required'); return }
    if (newPw.length < 8) { showSnack('New password must be at least 8 characters'); return }
    if (newPw !== confirmPw) { showSnack('New passwords do not match'); return }
    try {
      await api.put('/auth/me/password', { currentPassword: currentPw, newPassword: newPw })
      showSnack('Password changed. Please log in again.')
      logout()
      window.location.href = '/auth/login'
    } catch (e: unknown) {
      showSnack((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to change password')
    }
    setPwModal(false)
    setCurrentPw('')
    setNewPw('')
    setConfirmPw('')
  }

  // ── 2FA Toggle ───────────────────────────────────────────────────────────

  const toggleMfa = async (enabled: boolean) => {
    try {
      await api.put('/auth/me/mfa', { enabled })
      setMfaEnabled(enabled)
      showSnack(enabled ? '2FA enabled' : '2FA disabled')
    } catch { showSnack('Failed to update 2FA setting') }
  }

  // ── Address CRUD ─────────────────────────────────────────────────────────

  const openAddrModal = (existing?: Address) => {
    setAddrLabel(existing?.label || '')
    setAddrStreet(existing?.street || '')
    setAddrCity(existing?.city || '')
    setAddrProvince(existing?.province || '')
    setAddrPostal(existing?.postalCode || '')
    setAddrModal({ existing })
  }

  const saveAddress = async () => {
    if (!addrLabel || !addrStreet || !addrCity || !addrProvince || !addrPostal) {
      showSnack('All fields are required'); return
    }
    const body = { label: addrLabel, street: addrStreet, city: addrCity, province: addrProvince, postalCode: addrPostal }
    try {
      if (addrModal?.existing) {
        await api.put(`/user-addresses/${addrModal.existing.id}`, body)
        showSnack('Address updated')
      } else {
        await api.post('/user-addresses', body)
        showSnack('Address added')
      }
      loadAddresses()
    } catch { showSnack('Failed to save address') }
    setAddrModal(null)
  }

  const deleteAddress = async (id: string) => {
    try {
      await api.delete(`/user-addresses/${id}`)
      showSnack('Address deleted')
      loadAddresses()
    } catch { showSnack('Failed to delete address') }
  }

  const setDefaultAddress = async (id: string) => {
    try {
      await api.put(`/user-addresses/${id}/default`)
      showSnack('Default address updated')
      loadAddresses()
    } catch { showSnack('Failed to set default') }
  }

  // ── Car CRUD ─────────────────────────────────────────────────────────────

  const openCarModal = (existing?: Car) => {
    setCarLabel(existing?.label || '')
    setCarMake(existing?.make || '')
    setCarModel(existing?.model || '')
    setCarYear(existing?.year?.toString() || '')
    setCarColor(existing?.color || '')
    setCarPlate(existing?.plate || '')
    setCarModal({ existing })
  }

  const saveCar = async () => {
    if (!carLabel || !carMake || !carModel) { showSnack('Label, Make, and Model are required'); return }
    const body: Record<string, unknown> = { label: carLabel, make: carMake, model: carModel }
    if (carYear) body.year = parseInt(carYear)
    if (carColor) body.color = carColor
    if (carPlate) body.plate = carPlate
    try {
      if (carModal?.existing) {
        await api.put(`/user-cars/${carModal.existing.id}`, body)
        showSnack('Car updated')
      } else {
        await api.post('/user-cars', body)
        showSnack('Car added')
      }
      loadCars()
    } catch { showSnack('Failed to save car') }
    setCarModal(null)
  }

  const deleteCar = async (id: string) => {
    try {
      await api.delete(`/user-cars/${id}`)
      showSnack('Car deleted')
      loadCars()
    } catch { showSnack('Failed to delete car') }
  }

  const setDefaultCar = async (id: string) => {
    try {
      await api.put(`/user-cars/${id}/default`)
      showSnack('Default car updated')
      loadCars()
    } catch { showSnack('Failed to set default') }
  }

  // ── Render Helpers ───────────────────────────────────────────────────────

  function renderSettingTile(icon: React.ReactNode, title: string, subtitle: string, onTap: () => void, subtitleColor?: string) {
    return (
      <div key={title} className="mx-[18px] my-1 bg-nh-surface rounded-[14px] border border-nh-border overflow-hidden">
        <div onClick={onTap} className="flex items-center gap-[14px] p-[14px] cursor-pointer">
          {icon}
          <div className="flex-1">
            <div className="font-medium text-sm text-nh-text">{title}</div>
            <div className={`text-xs mt-0.5 ${subtitleColor || 'text-nh-text-muted'}`}>{subtitle}</div>
          </div>
          <IconChevronRight />
        </div>
      </div>
    )
  }

  function renderSwitchTile(icon: React.ReactNode, title: string, subtitle: string, value: boolean, onChange: (v: boolean) => void) {
    return (
      <div key={title} className="mx-[18px] my-1 bg-nh-surface rounded-[14px] border border-nh-border overflow-hidden">
        <div className="flex items-center gap-[14px] px-[14px] py-2">
          {icon}
          <div className="flex-1">
            <div className="font-medium text-sm text-nh-text">{title}</div>
            <div className="text-xs text-nh-text-muted mt-0.5">{subtitle}</div>
          </div>
          <button
            onClick={() => onChange(!value)}
            className="relative w-11 h-6 rounded-full border-0 p-0 cursor-pointer transition-colors duration-200"
            style={{ background: value ? 'var(--nh-primary)' : 'rgba(255,255,255,0.08)' }}
          >
            <div
              className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all duration-200"
              style={{ left: value ? '22px' : '2px' }}
            />
          </button>
        </div>
      </div>
    )
  }

  function renderSectionHeader(title: string) {
    return (
      <div key={`hdr-${title}`} className="px-[18px] py-1.5 font-heading text-[13px] font-semibold text-nh-text-muted mt-4">
        {title}
      </div>
    )
  }

  // ── General Tab ──────────────────────────────────────────────────────────

  function renderGeneralTab() {
    return (
      <div className="pb-[100px]">
        <div className="flex flex-col items-center pt-6 pb-2">
          {/* Avatar (tappable) */}
          <div className="w-20 h-20 rounded-full bg-nh-primary-hover border-[3px] border-nh-primary flex items-center justify-center relative cursor-pointer">
            <span className="font-bold text-nh-primary text-[32px] font-heading">
              {initial}
            </span>
            {/* Camera icon overlay */}
            <div className="absolute -bottom-0.5 -right-0.5 w-7 h-7 bg-nh-primary rounded-full border-2 border-nh-bg flex items-center justify-center">
              <IconCamera />
            </div>
          </div>
          <div className="font-heading text-xl font-bold text-nh-text mt-3">
            {displayName}
          </div>
          <div className="text-xs text-nh-text-muted mt-0.5">{username}</div>
          <div className="text-[11px] text-nh-text-muted mt-1.5">Role: {role}</div>
        </div>

        {/* Account Settings */}
        {renderSectionHeader('Account Settings')}
        {renderSettingTile(<IconBadge />, 'Display Name', displayName, () => openEditModal('displayName', displayName))}
        {renderSettingTile(<IconEmail />, 'Email Address', email || 'Not set — Tap to add', () => openEditModal('email', email), email ? undefined : 'text-nh-warning')}
        {renderSettingTile(<IconPhone />, 'Phone Number', phone || 'Not set — Tap to add', () => openEditModal('phone', phone), phone ? undefined : 'text-nh-warning')}

        {/* Security */}
        {renderSectionHeader('Security')}
        {renderSettingTile(<IconLock />, 'Change Password', 'Update your login password', () => setPwModal(true))}
        {renderSwitchTile(<IconVerified />, 'Authenticator (2FA)', mfaEnabled ? 'Enabled' : 'Disabled', mfaEnabled, toggleMfa)}

        {/* Appearance */}
        {renderSectionHeader('Appearance')}
        {renderSwitchTile(<IconDarkMode />, 'Dark Mode', isDark ? 'Active' : 'Off', isDark, (v) => { if (v) setIsDark(true) })}
        {renderSwitchTile(<IconLightMode />, 'Light Mode', !isDark ? 'Active' : 'Off', !isDark, (v) => { if (v) setIsDark(false) })}

        {/* Account Type / Upgrade */}
        {!hasBizRole && (
          <>
            {renderSectionHeader('Account Type')}
            {error && (
              <div className="mx-[18px] mb-3 p-3 bg-nh-danger/10 rounded-lg border-[1.5px] border-nh-danger flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-nh-danger" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <span className="text-xs text-nh-danger">{error}</span>
              </div>
            )}
            {success && (
              <div className="mx-[18px] mb-3 p-3 bg-nh-success/10 rounded-lg border-[1.5px] border-nh-success flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-nh-success" strokeWidth="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                <span className="text-xs text-nh-success">{success}</span>
              </div>
            )}
            <div className="mx-[18px] p-4 rounded-[14px] border border-nh-primary/30 bg-gradient-to-br from-nh-primary/10 to-nh-success/5">
              <div className="font-heading text-[15px] font-semibold text-nh-text">
                Switch to Business Account
              </div>
              <p className="text-xs text-nh-text-muted leading-relaxed my-1 mb-[14px]">
                Get access to provider tools, manage services, and receive orders.
              </p>
              <button
                onClick={handleUpgrade}
                disabled={upgrading}
                className="w-full py-[14px] bg-nh-primary text-white border-0 rounded-[10px] font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {upgrading ? (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="animate-spin">
                      <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="3" strokeDasharray="31.4 31.4" strokeLinecap="round" />
                    </svg>
                    Upgrading...
                  </>
                ) : (
                  <><IconRocket /> Upgrade Now</>
                )}
              </button>
            </div>
          </>
        )}

        {/* Logout */}
        <div className="mt-6 px-[18px]">
          <button
            onClick={() => { logout(); window.location.href = '/auth/login' }}
            className="w-full py-[14px] bg-transparent text-nh-danger border border-nh-danger rounded-[10px] font-semibold text-sm flex items-center justify-center gap-2"
          >
            <IconLogout /> Log Out
          </button>
        </div>
        <div className="h-10" />
      </div>
    )
  }

  // ── Address & Cars Tab ───────────────────────────────────────────────────

  function renderAddressCarsTab() {
    return (
      <div className="pb-[100px]">
        {/* Addresses Section */}
        <div className="flex justify-between items-center px-[18px] pt-5 pb-2.5">
          <span className="font-heading text-base font-semibold text-nh-text">Addresses</span>
          <button onClick={() => openAddrModal()} className="flex items-center gap-1 px-3 py-1.5 bg-nh-primary border-0 rounded-lg text-white text-xs font-semibold cursor-pointer">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add
          </button>
        </div>

        {addrLoading ? (
          <div className="text-center py-5">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="animate-spin mx-auto">
              <circle cx="12" cy="12" r="10" stroke="currentColor" className="text-nh-primary" strokeWidth="3" strokeDasharray="31.4 31.4" strokeLinecap="round" />
            </svg>
          </div>
        ) : addresses.length === 0 ? (
          <div className="mx-[18px] p-5 bg-nh-surface rounded-[14px] border border-nh-border text-center text-[13px] text-nh-text-muted">
            No addresses yet. Tap "Add" to add one.
          </div>
        ) : (
          addresses.map((addr) => {
            const isDef = addr.isDefault
            const isWork = addr.label?.toLowerCase().includes('work')
            return (
              <div key={addr.id} className={`mx-[18px] my-1 p-[14px] bg-nh-surface rounded-[14px] flex items-center gap-3 relative border ${isDef ? 'border-[1.5px] border-nh-primary' : 'border border-nh-border'}`}>
                <div className={`w-10 h-10 rounded-[10px] flex items-center justify-center ${isDef ? 'bg-nh-primary/15' : 'bg-nh-surface-elevated/30'}`}>
                  {isWork ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" className={isDef ? 'text-nh-primary' : 'text-nh-text-muted'} strokeWidth="1.5"><rect x="2" y="7" width="20" height="14" rx="2" ry="2" /><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" /></svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" className={isDef ? 'text-nh-primary' : 'text-nh-text-muted'} strokeWidth="1.5"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center">
                    <span className="font-semibold text-sm text-nh-text">{addr.label || 'Address'}</span>
                    {isDef && <span className="px-1.5 py-0.5 bg-nh-primary rounded text-[9px] font-semibold text-white ml-1.5">Default</span>}
                  </div>
                  <div className="text-xs text-nh-text-muted mt-0.5 truncate">
                    {addr.street}, {addr.city}
                  </div>
                </div>
                {/* Three-dot menu */}
                <div className="relative">
                  <button onClick={() => setOpenMenu(openMenu === addr.id ? null : addr.id)} className="bg-transparent border-0 cursor-pointer p-1">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-nh-text-muted">
                      <circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" />
                    </svg>
                  </button>
                  {openMenu === addr.id && (
                    <div className="absolute right-0 top-[30px] bg-nh-surface rounded-[10px] border border-nh-border shadow-lg z-[100] min-w-[160px] overflow-hidden">
                      <button onClick={() => { openAddrModal(addr); setOpenMenu(null) }} className="flex items-center gap-2 px-[14px] py-2.5 cursor-pointer text-[13px] text-nh-text border-0 bg-transparent w-full text-left">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-nh-text-secondary" strokeWidth="1.5"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        Edit
                      </button>
                      {!isDef && (
                        <button onClick={() => { setDefaultAddress(addr.id); setOpenMenu(null) }} className="flex items-center gap-2 px-[14px] py-2.5 cursor-pointer text-[13px] text-nh-text border-0 bg-transparent w-full text-left">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-nh-text-secondary" strokeWidth="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                          Set as Default
                        </button>
                      )}
                      <button onClick={() => { deleteAddress(addr.id); setOpenMenu(null) }} className="flex items-center gap-2 px-[14px] py-2.5 cursor-pointer text-[13px] text-nh-danger border-0 bg-transparent w-full text-left">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-nh-danger" strokeWidth="1.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}

        {/* Cars Section */}
        <div className="flex justify-between items-center px-[18px] pt-6 pb-2.5">
          <span className="font-heading text-base font-semibold text-nh-text">Cars</span>
          <button onClick={() => openCarModal()} className="flex items-center gap-1 px-3 py-1.5 bg-nh-primary border-0 rounded-lg text-white text-xs font-semibold cursor-pointer">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add
          </button>
        </div>

        {carsLoading ? (
          <div className="text-center py-5">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="animate-spin mx-auto">
              <circle cx="12" cy="12" r="10" stroke="currentColor" className="text-nh-primary" strokeWidth="3" strokeDasharray="31.4 31.4" strokeLinecap="round" />
            </svg>
          </div>
        ) : cars.length === 0 ? (
          <div className="mx-[18px] p-5 bg-nh-surface rounded-[14px] border border-nh-border text-center text-[13px] text-nh-text-muted">
            No cars yet. Tap "Add" to add one.
          </div>
        ) : (
          cars.map((car) => {
            const isDef = car.isDefault
            return (
              <div key={car.id} className={`mx-[18px] my-1 p-[14px] bg-nh-surface rounded-[14px] flex items-center gap-3 relative border ${isDef ? 'border-[1.5px] border-nh-primary' : 'border border-nh-border'}`}>
                <div className={`w-10 h-10 rounded-[10px] flex items-center justify-center ${isDef ? 'bg-nh-primary/15' : 'bg-nh-surface-elevated/30'}`}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-nh-primary" strokeWidth="1.5">
                    <path d="M5 17h14M5 17a2 2 0 01-2-2V9l3-5h12l3 5v6a2 2 0 01-2 2M5 17a2 2 0 002 2h10a2 2 0 002-2" /><circle cx="7" cy="15" r="1" /><circle cx="17" cy="15" r="1" />
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="flex items-center">
                    <span className="font-semibold text-sm text-nh-text">{car.label || 'Car'}</span>
                    {isDef && <span className="px-1.5 py-0.5 bg-nh-primary rounded text-[9px] font-semibold text-white ml-1.5">Default</span>}
                  </div>
                  <div className="text-xs text-nh-text-muted mt-0.5 truncate">
                    {car.make} {car.model}{car.year ? ` · ${car.year}` : ''}
                  </div>
                </div>
                {/* Three-dot menu */}
                <div className="relative">
                  <button onClick={() => setOpenMenu(openMenu === `car-${car.id}` ? null : `car-${car.id}`)} className="bg-transparent border-0 cursor-pointer p-1">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-nh-text-muted">
                      <circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" />
                    </svg>
                  </button>
                  {openMenu === `car-${car.id}` && (
                    <div className="absolute right-0 top-[30px] bg-nh-surface rounded-[10px] border border-nh-border shadow-lg z-[100] min-w-[160px] overflow-hidden">
                      <button onClick={() => { openCarModal(car); setOpenMenu(null) }} className="flex items-center gap-2 px-[14px] py-2.5 cursor-pointer text-[13px] text-nh-text border-0 bg-transparent w-full text-left">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-nh-text-secondary" strokeWidth="1.5"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        Edit
                      </button>
                      {!isDef && (
                        <button onClick={() => { setDefaultCar(car.id); setOpenMenu(null) }} className="flex items-center gap-2 px-[14px] py-2.5 cursor-pointer text-[13px] text-nh-text border-0 bg-transparent w-full text-left">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-nh-text-secondary" strokeWidth="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                          Set as Default
                        </button>
                      )}
                      <button onClick={() => { deleteCar(car.id); setOpenMenu(null) }} className="flex items-center gap-2 px-[14px] py-2.5 cursor-pointer text-[13px] text-nh-danger border-0 bg-transparent w-full text-left">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-nh-danger" strokeWidth="1.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}
        <div className="h-10" />
      </div>
    )
  }

  // ── Modals ────────────────────────────────────────────────────────────────

  function renderEditModal() {
    if (!editModal) return null
    const labels: Record<string, string> = { displayName: 'Display Name', email: 'Email Address', phone: 'Phone Number' }
    const hints: Record<string, string> = { displayName: 'Enter your display name', email: 'your@email.com', phone: '+1 (647) 000-0000' }
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1000] p-5">
        <div className="bg-nh-surface rounded-2xl border border-nh-border w-full max-w-[340px] p-6">
          <div className="font-heading text-base font-semibold text-nh-text mb-4">
            {labels[editModal.field] || editModal.field}
          </div>
          <input
            autoFocus
            value={editModal.value}
            onChange={(e) => setEditModal({ ...editModal, value: e.target.value })}
            onKeyDown={(e) => { if (e.key === 'Enter') saveEditModal() }}
            placeholder={hints[editModal.field] || ''}
            className="w-full px-[14px] py-2.5 bg-nh-bg border border-nh-border rounded-[10px] text-nh-text text-sm outline-none box-border"
          />
          <div className="flex justify-end gap-2 mt-3">
            <button onClick={() => setEditModal(null)} className="px-4 py-2 bg-transparent border-0 text-nh-text-muted text-[13px] cursor-pointer rounded-lg">Cancel</button>
            <button onClick={saveEditModal} className="px-4 py-2 bg-nh-primary border-0 text-white text-[13px] font-semibold cursor-pointer rounded-lg">Save</button>
          </div>
        </div>
      </div>
    )
  }

  function renderPwModal() {
    if (!pwModal) return null
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1000] p-5">
        <div className="bg-nh-surface rounded-2xl border border-nh-border w-full max-w-[340px] p-6">
          <div className="font-heading text-base font-semibold text-nh-text mb-4">Change Password</div>
          <input value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} type="password" placeholder="Current password" className="w-full px-[14px] py-2.5 bg-nh-bg border border-nh-border rounded-[10px] text-nh-text text-sm outline-none box-border mb-2" />
          <input value={newPw} onChange={(e) => setNewPw(e.target.value)} type="password" placeholder="New password (min 8 chars)" className="w-full px-[14px] py-2.5 bg-nh-bg border border-nh-border rounded-[10px] text-nh-text text-sm outline-none box-border mb-2" />
          <input value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} type="password" placeholder="Confirm new password" className="w-full px-[14px] py-2.5 bg-nh-bg border border-nh-border rounded-[10px] text-nh-text text-sm outline-none box-border" />
          <div className="flex justify-end gap-2 mt-3">
            <button onClick={() => { setPwModal(false); setCurrentPw(''); setNewPw(''); setConfirmPw('') }} className="px-4 py-2 bg-transparent border-0 text-nh-text-muted text-[13px] cursor-pointer rounded-lg">Cancel</button>
            <button onClick={handleChangePassword} className="px-4 py-2 bg-nh-primary border-0 text-white text-[13px] font-semibold cursor-pointer rounded-lg">Change</button>
          </div>
        </div>
      </div>
    )
  }

  function renderAddrModal() {
    if (!addrModal) return null
    const isEdit = !!addrModal.existing
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1000] p-5">
        <div className="bg-nh-surface rounded-2xl border border-nh-border w-full max-w-[340px] p-6">
          <div className="font-heading text-base font-semibold text-nh-text mb-4">{isEdit ? 'Edit Address' : 'Add Address'}</div>
          <input value={addrLabel} onChange={(e) => setAddrLabel(e.target.value)} placeholder="Label (e.g. Home, Work)" className="w-full px-[14px] py-2.5 bg-nh-bg border border-nh-border rounded-[10px] text-nh-text text-sm outline-none box-border mb-2" />
          <input value={addrStreet} onChange={(e) => setAddrStreet(e.target.value)} placeholder="Street" className="w-full px-[14px] py-2.5 bg-nh-bg border border-nh-border rounded-[10px] text-nh-text text-sm outline-none box-border mb-2" />
          <input value={addrCity} onChange={(e) => setAddrCity(e.target.value)} placeholder="City" className="w-full px-[14px] py-2.5 bg-nh-bg border border-nh-border rounded-[10px] text-nh-text text-sm outline-none box-border mb-2" />
          <input value={addrProvince} onChange={(e) => setAddrProvince(e.target.value)} placeholder="Province" className="w-full px-[14px] py-2.5 bg-nh-bg border border-nh-border rounded-[10px] text-nh-text text-sm outline-none box-border mb-2" />
          <input value={addrPostal} onChange={(e) => setAddrPostal(e.target.value)} placeholder="Postal Code" className="w-full px-[14px] py-2.5 bg-nh-bg border border-nh-border rounded-[10px] text-nh-text text-sm outline-none box-border" />
          <div className="flex justify-end gap-2 mt-3">
            <button onClick={() => setAddrModal(null)} className="px-4 py-2 bg-transparent border-0 text-nh-text-muted text-[13px] cursor-pointer rounded-lg">Cancel</button>
            <button onClick={saveAddress} className="px-4 py-2 bg-nh-primary border-0 text-white text-[13px] font-semibold cursor-pointer rounded-lg">Save</button>
          </div>
        </div>
      </div>
    )
  }

  function renderCarModal() {
    if (!carModal) return null
    const isEdit = !!carModal.existing
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1000] p-5">
        <div className="bg-nh-surface rounded-2xl border border-nh-border w-full max-w-[340px] p-6">
          <div className="font-heading text-base font-semibold text-nh-text mb-4">{isEdit ? 'Edit Car' : 'Add Car'}</div>
          <input value={carLabel} onChange={(e) => setCarLabel(e.target.value)} placeholder="Label (e.g. My Civic, Family Car)" className="w-full px-[14px] py-2.5 bg-nh-bg border border-nh-border rounded-[10px] text-nh-text text-sm outline-none box-border mb-2" />
          <input value={carMake} onChange={(e) => setCarMake(e.target.value)} placeholder="Make (e.g. Honda)" className="w-full px-[14px] py-2.5 bg-nh-bg border border-nh-border rounded-[10px] text-nh-text text-sm outline-none box-border mb-2" />
          <input value={carModel} onChange={(e) => setCarModel(e.target.value)} placeholder="Model (e.g. Civic)" className="w-full px-[14px] py-2.5 bg-nh-bg border border-nh-border rounded-[10px] text-nh-text text-sm outline-none box-border mb-2" />
          <input value={carYear} onChange={(e) => setCarYear(e.target.value)} placeholder="Year (e.g. 2020)" className="w-full px-[14px] py-2.5 bg-nh-bg border border-nh-border rounded-[10px] text-nh-text text-sm outline-none box-border mb-2" />
          <input value={carColor} onChange={(e) => setCarColor(e.target.value)} placeholder="Color (optional)" className="w-full px-[14px] py-2.5 bg-nh-bg border border-nh-border rounded-[10px] text-nh-text text-sm outline-none box-border mb-2" />
          <input value={carPlate} onChange={(e) => setCarPlate(e.target.value)} placeholder="Plate (optional)" className="w-full px-[14px] py-2.5 bg-nh-bg border border-nh-border rounded-[10px] text-nh-text text-sm outline-none box-border" />
          <div className="flex justify-end gap-2 mt-3">
            <button onClick={() => setCarModal(null)} className="px-4 py-2 bg-transparent border-0 text-nh-text-muted text-[13px] cursor-pointer rounded-lg">Cancel</button>
            <button onClick={saveCar} className="px-4 py-2 bg-nh-primary border-0 text-white text-[13px] font-semibold cursor-pointer rounded-lg">Save</button>
          </div>
        </div>
      </div>
    )
  }

  // ── Main Render ──────────────────────────────────────────────────────────

  return (
    <div className="relative h-full flex flex-col bg-nh-bg">
      <StatusBar title="9:41" />

      {/* Header with back arrow + tabs */}
      <div className="px-4 py-2.5 bg-nh-bg border-b border-nh-border">
        <div className="flex items-center gap-3">
          <button onClick={() => window.history.back()} className="text-base cursor-pointer text-nh-text-secondary bg-transparent border-0 p-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-nh-text-secondary" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
            </svg>
          </button>
          <h1 className="font-heading text-base font-semibold text-nh-text m-0">Profile</h1>
        </div>
        {/* Tab Bar */}
        <div className="flex mt-2.5 bg-nh-surface rounded-lg p-[3px] relative">
          {['General', 'Address & Cars'].map((tab, i) => (
            <button
              key={tab}
              onClick={() => handleTabChange(i)}
              className={`flex-1 py-1.5 border-0 rounded-md cursor-pointer font-heading text-xs transition-all duration-200 ${
                tabIndex === i
                  ? 'font-semibold text-white bg-nh-primary'
                  : 'font-medium text-nh-text-muted bg-transparent'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {tabIndex === 0 ? renderGeneralTab() : renderAddressCarsTab()}
      </div>

      {/* Modals */}
      {renderEditModal()}
      {renderPwModal()}
      {renderAddrModal()}
      {renderCarModal()}

      {/* Floating Bottom Nav */}
      <div className="absolute left-0 right-0 bottom-6 z-50">
        <BottomNav
          items={[
            { id: 'home', label: 'Home', icon: NavIcons.home },
            { id: 'social', label: 'Social', icon: NavIcons.social },
            { id: 'activity', label: 'Activity', icon: NavIcons.activity },
            ...(hasBizRole ? [{ id: 'biz', label: 'Business', isBiz: true as const, icon: NavIcons.business }] : []),
          ]}
        />
      </div>
    </div>
  )
}