import { useState } from 'react'
import { StatusBar } from '../../components/ui/phone/StatusBar'
import { NavIcons } from '../../components/ui/phone/BottomNav'
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
  country?: string
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
const icons = {
  calendar: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-nh-text-secondary" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  heart: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-nh-text-secondary" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
    </svg>
  ),
  wallet: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-nh-text-secondary" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12V7H5a2 2 0 010-4h14v4" /><path d="M3 5v14a2 2 0 002 2h16v-5" /><path d="M18 12a2 2 0 000 4h4v-4z" />
    </svg>
  ),
  location: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-nh-text-secondary" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" />
    </svg>
  ),
  car: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-nh-text-secondary" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 17h14M5 17a2 2 0 01-2-2V9l3-5h12l3 5v6a2 2 0 01-2 2M5 17a2 2 0 002 2h10a2 2 0 002-2" /><circle cx="7" cy="15" r="1" /><circle cx="17" cy="15" r="1" />
    </svg>
  ),
  bell: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-nh-text-secondary" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 01-3.46 0" />
    </svg>
  ),
  help: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-nh-text-secondary" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  trash: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-nh-text-secondary" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
    </svg>
  ),
  settings: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-nh-text-secondary" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  ),
  edit: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-nh-primary" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  ),
  camera: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" /><circle cx="12" cy="13" r="4" />
    </svg>
  ),
  chevron: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-nh-text-muted" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  ),
  logout: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  ),
}

/* ─── Snackbar helper ──────────────────────────────────────────────────── */
function showSnack(msg: string) {
  const el = document.createElement('div')
  el.className = 'fixed bottom-[120px] left-1/2 -translate-x-1/2 bg-nh-surface text-nh-text px-5 py-3 rounded-[10px] text-[13px] z-[9999] border border-nh-border shadow-lg'
  el.textContent = msg
  document.body.appendChild(el)
  setTimeout(() => el.remove(), 2500)
}

/* ═══════════════════════════════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════════════════════════════ */
export default function Profile() {
  const { user, refreshUser, logout } = useAuthStore()

  // Edit profile modal
  const [editOpen, setEditOpen] = useState(false)
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')

  // Address management
  const [showAddresses, setShowAddresses] = useState(false)
  const [addresses, setAddresses] = useState<Address[]>([])
  const [addrLoading, setAddrLoading] = useState(false)
  const [addrModal, setAddrModal] = useState<{ existing?: Address } | null>(null)
  const [addrLabel, setAddrLabel] = useState('')
  const [addrStreet, setAddrStreet] = useState('')
  const [addrCity, setAddrCity] = useState('')
  const [addrProvince, setAddrProvince] = useState('')
  const [addrPostal, setAddrPostal] = useState('')
  const [addrCountry, setAddrCountry] = useState('CA')

  // Car management
  const [showCars, setShowCars] = useState(false)
  const [cars, setCars] = useState<Car[]>([])
  const [carsLoading, setCarsLoading] = useState(false)
  const [carModal, setCarModal] = useState<{ existing?: Car } | null>(null)
  const [carLabel, setCarLabel] = useState('')
  const [carMake, setCarMake] = useState('')
  const [carModel, setCarModel] = useState('')
  const [carYear, setCarYear] = useState('')
  const [carColor, setCarColor] = useState('')
  const [carPlate, setCarPlate] = useState('')

  // Delete confirmation
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'address' | 'car'; id: string; label: string } | null>(null)

  // Clear cache
  const [showClearCache, setShowClearCache] = useState(false)

  const userData = (user as any) ?? {}
  const displayName = userData?.displayName || `${userData?.firstName ?? ''} ${userData?.lastName ?? ''}`.trim() || 'User'
  const email = userData?.email ?? ''
  const avatarUrl = userData?.avatarUrl ?? ''
  const initial = displayName.charAt(0).toUpperCase()
  const hasBizRole = user?.roles?.some((role: string) =>
    ['provider', 'owner', 'platform_admin', 'developer', 'support', 'finance'].includes(role.toLowerCase())
  ) ?? false

  /* ─── Data Loading ───────────────────────────────────────────────────── */
  const loadAddresses = async () => {
    setAddrLoading(true)
    try { const res = await api.get('/user-addresses'); setAddresses(res.data?.items ?? []) } catch { /* ignore */ }
    setAddrLoading(false)
  }
  const loadCars = async () => {
    setCarsLoading(true)
    try { const res = await api.get('/user-cars'); setCars(res.data?.items ?? []) } catch { /* ignore */ }
    setCarsLoading(false)
  }

  /* ─── Avatar Upload ──────────────────────────────────────────────────── */
  const handleUploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const form = new FormData()
    form.append('file', file)
    try {
      const upload = await api.post('/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } })
      const url = upload.data?.url ?? ''
      if (url) {
        await api.put('/auth/me', { avatarUrl: url })
        await refreshUser()
        showSnack('Avatar updated')
      }
    } catch { showSnack('Failed to upload avatar') }
  }

  /* ─── Edit Profile ───────────────────────────────────────────────────── */
  const openEditProfile = () => {
    setEditName(displayName)
    setEditEmail(email)
    setEditOpen(true)
  }
  const saveEditProfile = async () => {
    const name = editName.trim()
    const mail = editEmail.trim()
    if (name.length >= 2) {
      try {
        await api.put('/auth/me', { displayName: name })
        await refreshUser()
        showSnack('Display name updated')
      } catch { showSnack('Failed to update display name') }
    }
    if (mail.includes('@')) {
      try {
        await api.put('/auth/me/email', { email: mail })
        await refreshUser()
        showSnack('Email updated')
      } catch { showSnack('Failed to update email') }
    }
    setEditOpen(false)
  }

  /* ─── Clear Cache ────────────────────────────────────────────────────── */
  const handleClearCache = () => {
    // Clear specific caches, keep auth token and dark mode
    const keysToKeep = ['neighborly-auth', 'neighborly-dark-mode']
    const allKeys = Object.keys(localStorage)
    for (const key of allKeys) {
      if (!keysToKeep.includes(key) && !key.startsWith('neighborly-admin')) {
        localStorage.removeItem(key)
      }
    }
    // Clear session storage
    sessionStorage.clear()
    setShowClearCache(false)
    showSnack('Cache cleared successfully')
  }

  /* ─── Address CRUD ───────────────────────────────────────────────────── */
  const openAddrModal = (existing?: Address) => {
    setAddrLabel(existing?.label || '')
    setAddrStreet(existing?.street || '')
    setAddrCity(existing?.city || '')
    setAddrProvince(existing?.province || '')
    setAddrPostal(existing?.postalCode || '')
    setAddrCountry(existing?.country || 'CA')
    setAddrModal({ existing })
  }
  const saveAddress = async () => {
    if (!addrLabel || !addrStreet || !addrCity || !addrProvince || !addrPostal) {
      showSnack('All fields are required'); return
    }
    const body = { label: addrLabel, street: addrStreet, city: addrCity, province: addrProvince, postalCode: addrPostal, country: addrCountry }
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
    try { await api.delete(`/user-addresses/${id}`); showSnack('Address deleted'); loadAddresses() } catch { showSnack('Failed to delete address') }
    setConfirmDelete(null)
  }
  const setDefaultAddress = async (id: string) => {
    try { await api.put(`/user-addresses/${id}/default`); showSnack('Default address updated'); loadAddresses() } catch { showSnack('Failed to set default') }
  }

  /* ─── Car CRUD ───────────────────────────────────────────────────────── */
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
    try { await api.delete(`/user-cars/${id}`); showSnack('Car deleted'); loadCars() } catch { showSnack('Failed to delete car') }
    setConfirmDelete(null)
  }
  const setDefaultCar = async (id: string) => {
    try { await api.put(`/user-cars/${id}/default`); showSnack('Default car updated'); loadCars() } catch { showSnack('Failed to set default') }
  }

  /* ─── Navigate to sub-screen ─────────────────────────────────────────── */
  const openAddresses = () => { setShowAddresses(true); loadAddresses() }
  const openCars = () => { setShowCars(true); loadCars() }

  /* ─── Menu Item Component ────────────────────────────────────────────── */
  const MenuItem = ({ icon, title, badge, onClick }: { icon: React.ReactNode; title: string; badge?: string; onClick: () => void }) => (
    <div onClick={onClick} className="flex items-center gap-[14px] px-4 py-[14px] cursor-pointer hover:bg-white/[0.02] transition-colors">
      {icon}
      <span className="flex-1 font-medium text-sm text-nh-text">{title}</span>
      {badge && (
        <span className="px-[7px] py-[2px] bg-nh-danger text-white text-[10px] font-bold rounded-[10px]">{badge}</span>
      )}
      {icons.chevron}
    </div>
  )

  const Divider = () => <div className="h-px bg-nh-border/50 ml-[50px] mr-4" />

  /* ─── Render: Sub-screens ────────────────────────────────────────────── */
  if (showAddresses) {
    return (
      <div className="flex flex-col h-full bg-nh-bg text-nh-text font-sans">
        <StatusBar title="9:41" />
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-nh-border bg-nh-bg">
          <button onClick={() => setShowAddresses(false)} className="text-nh-text-secondary bg-transparent border-0 p-0 cursor-pointer">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
          <h2 className="font-display font-semibold text-base">My Addresses</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {addrLoading ? (
            <div className="flex justify-center p-10"><div className="w-6 h-6 border-2 border-nh-primary/30 border-t-nh-primary rounded-full animate-spin" /></div>
          ) : addresses.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-nh-text-muted mb-4"><svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="mx-auto text-nh-text-muted" strokeWidth="1"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg></div>
              <p className="text-nh-text-secondary text-[15px] mb-4">No addresses yet</p>
              <button onClick={() => openAddrModal()} className="px-6 py-3 bg-nh-primary text-white border-0 rounded-[10px] font-semibold text-sm cursor-pointer">Add Address</button>
            </div>
          ) : (
            addresses.map(addr => (
              <AddressCard key={addr.id} addr={addr} onEdit={openAddrModal} onDelete={(id) => setConfirmDelete({ type: 'address', id, label: addr.label || 'this address' })} onSetDefault={setDefaultAddress} />
            ))
          )}
        </div>
        {addresses.length > 0 && (
          <div className="fixed bottom-6 right-6">
            <button onClick={() => openAddrModal()} className="w-14 h-14 bg-nh-primary text-white border-0 rounded-full flex items-center justify-center shadow-lg cursor-pointer">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
          </div>
        )}
        {/* Address Modal */}
        {addrModal && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50" onClick={() => setAddrModal(null)}>
            <div className="bg-nh-surface rounded-2xl w-full max-w-sm mx-4 p-6" onClick={e => e.stopPropagation()}>
              <h3 className="text-nh-text font-display font-semibold text-lg mb-4">{addrModal.existing ? 'Edit Address' : 'Add Address'}</h3>
              <input value={addrLabel} onChange={e => setAddrLabel(e.target.value)} placeholder="Label (e.g. Home, Work)" className="w-full bg-nh-bg border border-nh-border rounded-[10px] px-4 py-2.5 text-nh-text text-sm outline-none mb-2" />
              <input value={addrStreet} onChange={e => setAddrStreet(e.target.value)} placeholder="Street Address" className="w-full bg-nh-bg border border-nh-border rounded-[10px] px-4 py-2.5 text-nh-text text-sm outline-none mb-2" />
              <input value={addrCity} onChange={e => setAddrCity(e.target.value)} placeholder="City" className="w-full bg-nh-bg border border-nh-border rounded-[10px] px-4 py-2.5 text-nh-text text-sm outline-none mb-2" />
              <input value={addrProvince} onChange={e => setAddrProvince(e.target.value)} placeholder="Province / State" className="w-full bg-nh-bg border border-nh-border rounded-[10px] px-4 py-2.5 text-nh-text text-sm outline-none mb-2" />
              <input value={addrPostal} onChange={e => setAddrPostal(e.target.value)} placeholder="Postal Code" className="w-full bg-nh-bg border border-nh-border rounded-[10px] px-4 py-2.5 text-nh-text text-sm outline-none mb-2" />
              <input value={addrCountry} onChange={e => setAddrCountry(e.target.value)} placeholder="Country (default: CA)" className="w-full bg-nh-bg border border-nh-border rounded-[10px] px-4 py-2.5 text-nh-text text-sm outline-none" />
              <div className="flex justify-end gap-3 mt-5">
                <button onClick={() => setAddrModal(null)} className="px-4 py-2 rounded-lg text-nh-text-muted text-sm">Cancel</button>
                <button onClick={saveAddress} className="px-5 py-2 rounded-lg bg-nh-primary text-white text-sm font-semibold">{addrModal.existing ? 'Update' : 'Add'}</button>
              </div>
            </div>
          </div>
        )}
        {/* Delete Confirm */}
        {confirmDelete && <ConfirmDeleteModal onConfirm={() => confirmDelete.type === 'address' ? deleteAddress(confirmDelete.id) : deleteCar(confirmDelete.id)} onCancel={() => setConfirmDelete(null)} label={confirmDelete.label} />}
      </div>
    )
  }

  if (showCars) {
    return (
      <div className="flex flex-col h-full bg-nh-bg text-nh-text font-sans">
        <StatusBar title="9:41" />
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-nh-border bg-nh-bg">
          <button onClick={() => setShowCars(false)} className="text-nh-text-secondary bg-transparent border-0 p-0 cursor-pointer">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
          <h2 className="font-display font-semibold text-base">My Cars</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {carsLoading ? (
            <div className="flex justify-center p-10"><div className="w-6 h-6 border-2 border-nh-primary/30 border-t-nh-primary rounded-full animate-spin" /></div>
          ) : cars.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-nh-text-muted mb-4"><svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="mx-auto text-nh-text-muted" strokeWidth="1"><path d="M5 17h14M5 17a2 2 0 01-2-2V9l3-5h12l3 5v6a2 2 0 01-2 2M5 17a2 2 0 002 2h10a2 2 0 002-2"/><circle cx="7" cy="15" r="1"/><circle cx="17" cy="15" r="1"/></svg></div>
              <p className="text-nh-text-secondary text-[15px] mb-4">No cars yet</p>
              <button onClick={() => openCarModal()} className="px-6 py-3 bg-nh-primary text-white border-0 rounded-[10px] font-semibold text-sm cursor-pointer">Add Car</button>
            </div>
          ) : (
            cars.map(car => (
              <CarCard key={car.id} car={car} onEdit={openCarModal} onDelete={(id) => setConfirmDelete({ type: 'car', id, label: `${car.make} ${car.model}` || 'this car' })} onSetDefault={setDefaultCar} />
            ))
          )}
        </div>
        {cars.length > 0 && (
          <div className="fixed bottom-6 right-6">
            <button onClick={() => openCarModal()} className="w-14 h-14 bg-nh-primary text-white border-0 rounded-full flex items-center justify-center shadow-lg cursor-pointer">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
          </div>
        )}
        {carModal && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50" onClick={() => setCarModal(null)}>
            <div className="bg-nh-surface rounded-2xl w-full max-w-sm mx-4 p-6" onClick={e => e.stopPropagation()}>
              <h3 className="text-nh-text font-display font-semibold text-lg mb-4">{carModal.existing ? 'Edit Car' : 'Add Car'}</h3>
              <input value={carLabel} onChange={e => setCarLabel(e.target.value)} placeholder="Label (e.g. My Civic)" className="w-full bg-nh-bg border border-nh-border rounded-[10px] px-4 py-2.5 text-nh-text text-sm outline-none mb-2" />
              <input value={carMake} onChange={e => setCarMake(e.target.value)} placeholder="Make (e.g. Honda)" className="w-full bg-nh-bg border border-nh-border rounded-[10px] px-4 py-2.5 text-nh-text text-sm outline-none mb-2" />
              <input value={carModel} onChange={e => setCarModel(e.target.value)} placeholder="Model (e.g. Civic)" className="w-full bg-nh-bg border border-nh-border rounded-[10px] px-4 py-2.5 text-nh-text text-sm outline-none mb-2" />
              <input value={carYear} onChange={e => setCarYear(e.target.value)} placeholder="Year (e.g. 2020)" className="w-full bg-nh-bg border border-nh-border rounded-[10px] px-4 py-2.5 text-nh-text text-sm outline-none mb-2" />
              <input value={carColor} onChange={e => setCarColor(e.target.value)} placeholder="Color (optional)" className="w-full bg-nh-bg border border-nh-border rounded-[10px] px-4 py-2.5 text-nh-text text-sm outline-none mb-2" />
              <input value={carPlate} onChange={e => setCarPlate(e.target.value)} placeholder="License Plate (optional)" className="w-full bg-nh-bg border border-nh-border rounded-[10px] px-4 py-2.5 text-nh-text text-sm outline-none" />
              <div className="flex justify-end gap-3 mt-5">
                <button onClick={() => setCarModal(null)} className="px-4 py-2 rounded-lg text-nh-text-muted text-sm">Cancel</button>
                <button onClick={saveCar} className="px-5 py-2 rounded-lg bg-nh-primary text-white text-sm font-semibold">{carModal.existing ? 'Update' : 'Add'}</button>
              </div>
            </div>
          </div>
        )}
        {confirmDelete && <ConfirmDeleteModal onConfirm={() => confirmDelete.type === 'address' ? deleteAddress(confirmDelete.id) : deleteCar(confirmDelete.id)} onCancel={() => setConfirmDelete(null)} label={confirmDelete.label} />}
      </div>
    )
  }

  /* ─── Main Profile Screen ────────────────────────────────────────────── */
  return (
    <div className="relative h-full flex flex-col bg-nh-bg text-nh-text font-sans">
      <StatusBar title="9:41" />

      {/* Header */}
      <div className="px-4 py-2.5 border-b border-nh-border bg-nh-bg">
        <div className="flex items-center gap-3">
          <button onClick={() => window.history.back()} className="text-nh-text-secondary bg-transparent border-0 p-0 cursor-pointer">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
          <h2 className="font-display font-semibold text-base">Profile</h2>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto pb-28">
        {/* Profile Header */}
        <div className="flex items-center gap-4 px-5 pt-6 pb-6">
          <label className="relative cursor-pointer group shrink-0">
            <div className="w-[72px] h-[72px] rounded-full bg-nh-primary-dim border-2 border-nh-primary overflow-hidden">
              {avatarUrl ? <img src={avatarUrl} className="w-full h-full object-cover" alt="" /> :
                <span className="flex items-center justify-center w-full h-full text-[28px] font-bold font-display text-nh-primary">{initial}</span>}
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-6 h-6 bg-nh-primary rounded-full flex items-center justify-center border-2 border-nh-bg">
              {icons.camera}
            </div>
            <input type="file" accept="image/*" className="hidden" onChange={handleUploadAvatar} />
          </label>
          <div className="flex-1">
            <h3 className="font-display font-bold text-xl text-nh-text">{displayName}</h3>
            <p className="text-[13px] text-nh-text-muted mt-1">{email}</p>
          </div>
          <button onClick={openEditProfile} className="w-10 h-10 rounded-[10px] bg-nh-primary-dim flex items-center justify-center border-0 cursor-pointer">
            {icons.edit}
          </button>
        </div>

        {/* Menu Section */}
        <div className="mx-[18px] bg-nh-surface rounded-[14px] border border-nh-border overflow-hidden">
          <MenuItem icon={icons.calendar} title="My Appointments" onClick={() => {/* navigate */}} />
          <Divider />
          <MenuItem icon={icons.heart} title="Saved Businesses" onClick={() => {/* navigate */}} />
          <Divider />
          <MenuItem icon={icons.wallet} title="Payments & Wallet" onClick={() => {/* navigate */}} />
          <Divider />
          <MenuItem icon={icons.location} title="My Addresses" onClick={openAddresses} />
          <Divider />
          <MenuItem icon={icons.car} title="My Cars" onClick={openCars} />
          <Divider />
          <MenuItem icon={icons.bell} title="Notifications" badge="3" onClick={() => {/* navigate */}} />
          <Divider />
          <MenuItem icon={icons.help} title="Help & Support" onClick={() => {/* navigate */}} />
          <Divider />
          <MenuItem icon={icons.trash} title="Clear Cache" onClick={() => setShowClearCache(true)} />
        </div>

        {/* Bottom Section */}
        <div className="mt-4 mx-[18px]">
          <div className="bg-nh-surface rounded-[14px] border border-nh-border overflow-hidden">
            <MenuItem icon={icons.settings} title="Settings" onClick={() => {/* navigate */}} />
          </div>
          <button
            onClick={() => { logout(); window.location.href = '/auth/login' }}
            className="w-full mt-3 py-[14px] bg-nh-danger/5 border border-nh-danger rounded-[12px] text-nh-danger font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer"
          >
            {icons.logout} Logout
          </button>
        </div>
        <div className="h-12" />
      </div>

      {/* Bottom Nav */}
      <div className="fixed bottom-6 left-0 right-0 flex justify-center pointer-events-none z-50">
        <div className="bg-nh-surface/95 backdrop-blur-xl border border-nh-border rounded-2xl px-2 py-2 flex items-center gap-1 shadow-lg shadow-black/20 pointer-events-auto">
          {[
            { id: 'home', label: 'Home', icon: NavIcons.home },
            { id: 'social', label: 'Social', icon: NavIcons.social },
            { id: 'activity', label: 'Activity', icon: NavIcons.activity },
            ...(hasBizRole ? [{ id: 'biz', label: 'Business', isBiz: true, icon: NavIcons.business }] : []),
          ].map(item => (
            <button key={item.id}
              onClick={() => {
                const routes: Record<string, string> = { home: '/app/home', social: '/app/social', activity: '/app/activity', biz: '/app/dashboard' }
                window.location.href = routes[item.id]
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-nh-text-muted hover:text-nh-text transition-colors"
            >
              <span className="w-[22px] h-[22px] flex items-center justify-center">{item.icon}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Edit Profile Modal ── */}
      {editOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50" onClick={() => setEditOpen(false)}>
          <div className="bg-nh-surface rounded-2xl w-full max-w-sm mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-nh-text font-display font-semibold text-lg mb-4">Edit Profile</h3>
            <div className="flex flex-col gap-3">
              <input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Display Name"
                className="w-full bg-nh-bg border border-nh-border rounded-[10px] px-4 py-2.5 text-nh-text text-sm outline-none" />
              <input value={editEmail} onChange={e => setEditEmail(e.target.value)} placeholder="Email" type="email"
                className="w-full bg-nh-bg border border-nh-border rounded-[10px] px-4 py-2.5 text-nh-text text-sm outline-none" />
            </div>
            <div className="flex justify-end gap-3 mt-5">
              <button onClick={() => setEditOpen(false)} className="px-4 py-2 rounded-lg text-nh-text-muted text-sm">Cancel</button>
              <button onClick={saveEditProfile} className="px-5 py-2 rounded-lg bg-nh-primary text-white text-sm font-semibold">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Address Form Modal ── */}
      {addrModal && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50" onClick={() => setAddrModal(null)}>
          <div className="bg-nh-surface rounded-2xl w-full max-w-sm mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-nh-text font-display font-semibold text-lg mb-4">{addrModal.existing ? 'Edit Address' : 'Add Address'}</h3>
            <input value={addrLabel} onChange={e => setAddrLabel(e.target.value)} placeholder="Label (e.g. Home, Work)" className="w-full bg-nh-bg border border-nh-border rounded-[10px] px-4 py-2.5 text-nh-text text-sm outline-none mb-2" />
            <input value={addrStreet} onChange={e => setAddrStreet(e.target.value)} placeholder="Street Address" className="w-full bg-nh-bg border border-nh-border rounded-[10px] px-4 py-2.5 text-nh-text text-sm outline-none mb-2" />
            <input value={addrCity} onChange={e => setAddrCity(e.target.value)} placeholder="City" className="w-full bg-nh-bg border border-nh-border rounded-[10px] px-4 py-2.5 text-nh-text text-sm outline-none mb-2" />
            <input value={addrProvince} onChange={e => setAddrProvince(e.target.value)} placeholder="Province / State" className="w-full bg-nh-bg border border-nh-border rounded-[10px] px-4 py-2.5 text-nh-text text-sm outline-none mb-2" />
            <input value={addrPostal} onChange={e => setAddrPostal(e.target.value)} placeholder="Postal Code" className="w-full bg-nh-bg border border-nh-border rounded-[10px] px-4 py-2.5 text-nh-text text-sm outline-none mb-2" />
            <input value={addrCountry} onChange={e => setAddrCountry(e.target.value)} placeholder="Country (default: CA)" className="w-full bg-nh-bg border border-nh-border rounded-[10px] px-4 py-2.5 text-nh-text text-sm outline-none" />
            <div className="flex justify-end gap-3 mt-5">
              <button onClick={() => setAddrModal(null)} className="px-4 py-2 rounded-lg text-nh-text-muted text-sm">Cancel</button>
              <button onClick={saveAddress} className="px-5 py-2 rounded-lg bg-nh-primary text-white text-sm font-semibold">{addrModal.existing ? 'Update' : 'Add'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Car Form Modal ── */}
      {carModal && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50" onClick={() => setCarModal(null)}>
          <div className="bg-nh-surface rounded-2xl w-full max-w-sm mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-nh-text font-display font-semibold text-lg mb-4">{carModal.existing ? 'Edit Car' : 'Add Car'}</h3>
            <input value={carLabel} onChange={e => setCarLabel(e.target.value)} placeholder="Label (e.g. My Civic)" className="w-full bg-nh-bg border border-nh-border rounded-[10px] px-4 py-2.5 text-nh-text text-sm outline-none mb-2" />
            <input value={carMake} onChange={e => setCarMake(e.target.value)} placeholder="Make (e.g. Honda)" className="w-full bg-nh-bg border border-nh-border rounded-[10px] px-4 py-2.5 text-nh-text text-sm outline-none mb-2" />
            <input value={carModel} onChange={e => setCarModel(e.target.value)} placeholder="Model (e.g. Civic)" className="w-full bg-nh-bg border border-nh-border rounded-[10px] px-4 py-2.5 text-nh-text text-sm outline-none mb-2" />
            <input value={carYear} onChange={e => setCarYear(e.target.value)} placeholder="Year (e.g. 2020)" className="w-full bg-nh-bg border border-nh-border rounded-[10px] px-4 py-2.5 text-nh-text text-sm outline-none mb-2" />
            <input value={carColor} onChange={e => setCarColor(e.target.value)} placeholder="Color (optional)" className="w-full bg-nh-bg border border-nh-border rounded-[10px] px-4 py-2.5 text-nh-text text-sm outline-none mb-2" />
            <input value={carPlate} onChange={e => setCarPlate(e.target.value)} placeholder="License Plate (optional)" className="w-full bg-nh-bg border border-nh-border rounded-[10px] px-4 py-2.5 text-nh-text text-sm outline-none" />
            <div className="flex justify-end gap-3 mt-5">
              <button onClick={() => setCarModal(null)} className="px-4 py-2 rounded-lg text-nh-text-muted text-sm">Cancel</button>
              <button onClick={saveCar} className="px-5 py-2 rounded-lg bg-nh-primary text-white text-sm font-semibold">{carModal.existing ? 'Update' : 'Add'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Clear Cache Dialog ── */}
      {showClearCache && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50" onClick={() => setShowClearCache(false)}>
          <div className="bg-nh-surface rounded-2xl w-full max-w-sm mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-nh-text font-display font-semibold text-lg mb-4">Clear Cache</h3>
            <p className="text-nh-text-secondary text-sm mb-4">Are you sure you want to clear the app cache?</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowClearCache(false)} className="px-4 py-2 rounded-lg text-nh-text-muted text-sm">Cancel</button>
              <button onClick={handleClearCache} className="px-5 py-2 rounded-lg bg-nh-danger text-white text-sm font-semibold">Clear</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm Delete Dialog ── */}
      {confirmDelete && <ConfirmDeleteModal onConfirm={() => confirmDelete.type === 'address' ? deleteAddress(confirmDelete.id) : deleteCar(confirmDelete.id)} onCancel={() => setConfirmDelete(null)} label={confirmDelete.label} />}

    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   Sub-components
   ═══════════════════════════════════════════════════════════════════════════ */

function AddressCard({ addr, onEdit, onDelete, onSetDefault }: { addr: Address; onEdit: (a: Address) => void; onDelete: (id: string) => void; onSetDefault: (id: string) => void }) {
  const isDefault = addr.isDefault
  return (
    <div className="mb-[10px] p-4 bg-nh-surface rounded-[14px] border" style={{ borderColor: isDefault ? 'var(--nh-primary)' : 'var(--nh-border)', borderWidth: isDefault ? '1.5px' : '1px' }}>
      <div className="flex items-start gap-2 mb-1.5">
        <div className="text-nh-text-secondary mt-0.5">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
          </svg>
        </div>
        <span className="font-display font-semibold text-[15px] text-nh-text flex-1">{addr.label || 'Address'}</span>
        {isDefault && <span className="px-2 py-[3px] bg-nh-primary/15 text-nh-primary text-[10px] font-semibold rounded-md">Default</span>}
      </div>
      <p className="text-[13px] text-nh-text-muted mb-2.5">{addr.street}, {addr.city}, {addr.province} {addr.postalCode}</p>
      <div className="flex justify-end gap-1">
        {!isDefault && <button onClick={() => onSetDefault(addr.id)} className="text-xs text-nh-primary px-2 py-1 border-0 bg-transparent cursor-pointer">Set as Default</button>}
        <button onClick={() => onEdit(addr)} className="text-xs text-nh-text-secondary px-2 py-1 border-0 bg-transparent cursor-pointer">Edit</button>
        <button onClick={() => onDelete(addr.id)} className="text-xs text-nh-danger px-2 py-1 border-0 bg-transparent cursor-pointer">Delete</button>
      </div>
    </div>
  )
}

function CarCard({ car, onEdit, onDelete, onSetDefault }: { car: Car; onEdit: (c: Car) => void; onDelete: (id: string) => void; onSetDefault: (id: string) => void }) {
  const isDefault = car.isDefault
  return (
    <div className="mb-[10px] p-4 bg-nh-surface rounded-[14px] border" style={{ borderColor: isDefault ? 'var(--nh-primary)' : 'var(--nh-border)', borderWidth: isDefault ? '1.5px' : '1px' }}>
      <div className="flex items-start gap-2 mb-1">
        <div className="text-nh-text-secondary mt-0.5">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M5 17h14M5 17a2 2 0 01-2-2V9l3-5h12l3 5v6a2 2 0 01-2 2M5 17a2 2 0 002 2h10a2 2 0 002-2"/><circle cx="7" cy="15" r="1"/><circle cx="17" cy="15" r="1"/>
          </svg>
        </div>
        <span className="font-display font-semibold text-[15px] text-nh-text flex-1">{car.make} {car.model}</span>
        {isDefault && <span className="px-2 py-[3px] bg-nh-primary/15 text-nh-primary text-[10px] font-semibold rounded-md">Default</span>}
      </div>
      {car.label && <p className="text-xs text-nh-text-secondary mb-1">{car.label}</p>}
      <p className="text-xs text-nh-text-muted mb-2.5">
        {[car.year, car.color, car.plate].filter(Boolean).join(' · ')}
      </p>
      <div className="flex justify-end gap-1">
        {!isDefault && <button onClick={() => onSetDefault(car.id)} className="text-xs text-nh-primary px-2 py-1 border-0 bg-transparent cursor-pointer">Set as Default</button>}
        <button onClick={() => onEdit(car)} className="text-xs text-nh-text-secondary px-2 py-1 border-0 bg-transparent cursor-pointer">Edit</button>
        <button onClick={() => onDelete(car.id)} className="text-xs text-nh-danger px-2 py-1 border-0 bg-transparent cursor-pointer">Delete</button>
      </div>
    </div>
  )
}

function ConfirmDeleteModal({ onConfirm, onCancel, label }: { onConfirm: () => void; onCancel: () => void; label: string }) {
  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50" onClick={onCancel}>
      <div className="bg-nh-surface rounded-2xl w-full max-w-sm mx-4 p-6" onClick={e => e.stopPropagation()}>
        <h3 className="text-nh-text font-display font-semibold text-lg mb-4">Confirm Delete</h3>
        <p className="text-nh-text-secondary text-sm mb-4">Are you sure you want to delete <strong className="text-nh-text">{label}</strong>?</p>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg text-nh-text-muted text-sm">Cancel</button>
          <button onClick={onConfirm} className="px-5 py-2 rounded-lg bg-nh-danger text-white text-sm font-semibold">Delete</button>
        </div>
      </div>
    </div>
  )
}