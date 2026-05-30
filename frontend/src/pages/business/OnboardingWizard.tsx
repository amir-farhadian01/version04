import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../../lib/api'
import { StatusBar } from '../../components/ui/phone/StatusBar'
import { BottomNav, NavIcons } from '../../components/ui/phone/BottomNav'

// ── Types ───────────────────────────────────────────────────

interface BusinessHours {
  monday:    { open: string; close: string; isOpen: boolean }
  tuesday:   { open: string; close: string; isOpen: boolean }
  wednesday: { open: string; close: string; isOpen: boolean }
  thursday:  { open: string; close: string; isOpen: boolean }
  friday:    { open: string; close: string; isOpen: boolean }
  saturday:  { open: string; close: string; isOpen: boolean }
  sunday:    { open: string; close: string; isOpen: boolean }
}

interface ServiceForm {
  title: string
  category: string
  price: string
  description: string
}

interface PackageForm {
  name: string
  price: string
  duration: string
  description: string
  serviceCatalogId: string
}

interface StaffInviteForm {
  email: string
  role: string
}

const DAYS: (keyof BusinessHours)[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

const DAY_LABELS: Record<keyof BusinessHours, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
}

const STAFF_ROLES = ['employee', 'manager', 'viewer']

function defaultHours(): BusinessHours {
  return {
    monday:    { open: '09:00', close: '17:00', isOpen: true },
    tuesday:   { open: '09:00', close: '17:00', isOpen: true },
    wednesday: { open: '09:00', close: '17:00', isOpen: true },
    thursday:  { open: '09:00', close: '17:00', isOpen: true },
    friday:    { open: '09:00', close: '17:00', isOpen: true },
    saturday:  { open: '10:00', close: '15:00', isOpen: false },
    sunday:    { open: '10:00', close: '15:00', isOpen: false },
  }
}

function emptyServiceForm(): ServiceForm {
  return { title: '', category: '', price: '', description: '' }
}

function emptyPackageForm(): PackageForm {
  return { name: '', price: '', duration: '60', description: '', serviceCatalogId: '' }
}

// ── Step Indicator ──────────────────────────────────────────

const STEP_LABELS = ['Hours', 'Service', 'Package', 'Staff', 'Payment']

function StepIndicator({ current }: { current: number }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: 24, padding: '20px 0 8px' }}>
      {STEP_LABELS.map((label, i) => {
        const active = i === current
        const done = i < current
        return (
          <div key={i} style={{ textAlign: 'center' }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 13,
                fontWeight: 700,
                background: done ? 'var(--secondary)' : active ? 'var(--primary)' : 'var(--bg3)',
                color: done || active ? '#fff' : 'var(--text3)',
                transition: 'background 0.3s',
              }}
            >
              {done ? '✓' : i + 1}
            </div>
            <div
              style={{
                fontSize: 10,
                marginTop: 4,
                color: active ? 'var(--primary)' : 'var(--text3)',
                fontWeight: active ? 600 : 400,
              }}
            >
              {label}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Helper Layout ───────────────────────────────────────────

function StepCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: '0 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{title}</div>
        {subtitle && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{subtitle}</div>}
      </div>
      {children}
    </div>
  )
}

// ── Step 1: Business Hours ──────────────────────────────────

function BusinessHoursStep({
  hours,
  setHours,
  error,
}: {
  hours: BusinessHours
  setHours: (h: BusinessHours) => void
  error: string | null
}) {
  function toggleDay(day: keyof BusinessHours) {
    setHours({ ...hours, [day]: { ...hours[day], isOpen: !hours[day].isOpen } })
  }

  function updateTime(day: keyof BusinessHours, field: 'open' | 'close', value: string) {
    setHours({ ...hours, [day]: { ...hours[day], [field]: value } })
  }

  return (
    <div>
      {error && (
        <div style={{ margin: '0 14px 10px', padding: 10, borderRadius: 8, background: 'rgba(255,59,48,0.15)', color: 'var(--red)', fontSize: 12 }}>{error}</div>
      )}
      {DAYS.map((day) => (
        <div
          key={day}
          style={{
            background: 'var(--card)',
            borderRadius: 12,
            padding: '12px 14px',
            margin: '0 14px 8px',
            border: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <div
            onClick={() => toggleDay(day)}
            style={{
              width: 40,
              height: 22,
              borderRadius: 11,
              cursor: 'pointer',
              background: hours[day].isOpen ? 'var(--secondary)' : 'var(--bg3)',
              position: 'relative',
              transition: 'background 0.2s',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: 18,
                height: 18,
                borderRadius: '50%',
                background: '#fff',
                position: 'absolute',
                top: 2,
                left: hours[day].isOpen ? 20 : 2,
                transition: 'left 0.2s',
              }}
            />
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: hours[day].isOpen ? 'var(--text)' : 'var(--text3)', width: 80 }}>
            {DAY_LABELS[day]}
          </span>
          {hours[day].isOpen && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="time"
                value={hours[day].open}
                onChange={(e) => updateTime(day, 'open', e.target.value)}
                style={{
                  background: 'var(--bg3)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: '4px 8px',
                  fontSize: 12,
                  color: 'var(--text)',
                  width: 90,
                }}
              />
              <span style={{ fontSize: 12, color: 'var(--text3)' }}>to</span>
              <input
                type="time"
                value={hours[day].close}
                onChange={(e) => updateTime(day, 'close', e.target.value)}
                style={{
                  background: 'var(--bg3)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: '4px 8px',
                  fontSize: 12,
                  color: 'var(--text)',
                  width: 90,
                }}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Step 2: First Service ───────────────────────────────────

function ServiceStep({
  form,
  setForm,
  error,
}: {
  form: ServiceForm
  setForm: (f: ServiceForm) => void
  error: string | null
}) {
  return (
    <StepCard title="Create Your First Service" subtitle="Define a service customers can book">
      {error && (
        <div style={{ padding: 10, borderRadius: 8, background: 'rgba(255,59,48,0.15)', color: 'var(--red)', fontSize: 12 }}>{error}</div>
      )}
      <input
        placeholder="Service title *"
        value={form.title}
        onChange={(e) => setForm({ ...form, title: e.target.value })}
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          padding: '12px 14px',
          fontSize: 13,
          color: 'var(--text)',
          width: '100%',
          boxSizing: 'border-box',
        }}
      />
      <input
        placeholder="Category (e.g., Plumbing, Haircut)"
        value={form.category}
        onChange={(e) => setForm({ ...form, category: e.target.value })}
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          padding: '12px 14px',
          fontSize: 13,
          color: 'var(--text)',
          width: '100%',
          boxSizing: 'border-box',
        }}
      />
      <input
        placeholder="Price (CAD in cents, e.g. 5000 for $50)"
        value={form.price}
        onChange={(e) => setForm({ ...form, price: e.target.value })}
        type="number"
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          padding: '12px 14px',
          fontSize: 13,
          color: 'var(--text)',
          width: '100%',
          boxSizing: 'border-box',
        }}
      />
      <textarea
        placeholder="Description (optional)"
        value={form.description}
        onChange={(e) => setForm({ ...form, description: e.target.value })}
        rows={3}
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          padding: '12px 14px',
          fontSize: 13,
          color: 'var(--text)',
          width: '100%',
          boxSizing: 'border-box',
          resize: 'vertical',
          fontFamily: 'inherit',
        }}
      />
    </StepCard>
  )
}

// ── Step 3: First Package ───────────────────────────────────

function PackageStep({
  form,
  setForm,
  services,
  error,
}: {
  form: PackageForm
  setForm: (f: PackageForm) => void
  services: { id: string; title: string }[]
  error: string | null
}) {
  return (
    <StepCard title="Create Your First Package" subtitle="Packages combine services with pricing and duration">
      {error && (
        <div style={{ padding: 10, borderRadius: 8, background: 'rgba(255,59,48,0.15)', color: 'var(--red)', fontSize: 12 }}>{error}</div>
      )}
      <input
        placeholder="Package name *"
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          padding: '12px 14px',
          fontSize: 13,
          color: 'var(--text)',
          width: '100%',
          boxSizing: 'border-box',
        }}
      />
      <select
        value={form.serviceCatalogId}
        onChange={(e) => setForm({ ...form, serviceCatalogId: e.target.value })}
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          padding: '12px 14px',
          fontSize: 13,
          color: 'var(--text)',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        <option value="">Select a service...</option>
        {services.map((s) => (
          <option key={s.id} value={s.id}>{s.title}</option>
        ))}
      </select>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          placeholder="Price (cents) *"
          value={form.price}
          onChange={(e) => setForm({ ...form, price: e.target.value })}
          type="number"
          style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            padding: '12px 14px',
            fontSize: 13,
            color: 'var(--text)',
            width: '50%',
            boxSizing: 'border-box',
          }}
        />
        <input
          placeholder="Duration (min) *"
          value={form.duration}
          onChange={(e) => setForm({ ...form, duration: e.target.value })}
          type="number"
          style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            padding: '12px 14px',
            fontSize: 13,
            color: 'var(--text)',
            width: '50%',
            boxSizing: 'border-box',
          }}
        />
      </div>
      <textarea
        placeholder="Description (optional)"
        value={form.description}
        onChange={(e) => setForm({ ...form, description: e.target.value })}
        rows={2}
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          padding: '12px 14px',
          fontSize: 13,
          color: 'var(--text)',
          width: '100%',
          boxSizing: 'border-box',
          resize: 'vertical',
          fontFamily: 'inherit',
        }}
      />
    </StepCard>
  )
}

// ── Step 4: Staff Invitation ────────────────────────────────

function StaffStep({
  invites,
  addInvite,
  removeInvite,
  updateInvite,
  error,
}: {
  invites: StaffInviteForm[]
  addInvite: () => void
  removeInvite: (i: number) => void
  updateInvite: (i: number, f: StaffInviteForm) => void
  error: string | null
}) {
  return (
    <StepCard title="Invite Staff Members" subtitle="Optional — you can skip and invite later">
      {error && (
        <div style={{ padding: 10, borderRadius: 8, background: 'rgba(255,59,48,0.15)', color: 'var(--red)', fontSize: 12 }}>{error}</div>
      )}
      {invites.length === 0 && (
        <div style={{ textAlign: 'center', padding: 30, color: 'var(--text3)', fontSize: 12 }}>
          No staff invitations yet.
        </div>
      )}
      {invites.map((inv, i) => (
        <div
          key={i}
          style={{
            background: 'var(--card)',
            borderRadius: 12,
            padding: 12,
            border: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <input
            placeholder="Email"
            value={inv.email}
            onChange={(e) => updateInvite(i, { ...inv, email: e.target.value })}
            style={{
              background: 'var(--bg3)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '8px 10px',
              fontSize: 12,
              color: 'var(--text)',
              flex: 1,
            }}
          />
          <select
            value={inv.role}
            onChange={(e) => updateInvite(i, { ...inv, role: e.target.value })}
            style={{
              background: 'var(--bg3)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '8px 10px',
              fontSize: 12,
              color: 'var(--text)',
            }}
          >
            {STAFF_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <div
            onClick={() => removeInvite(i)}
            style={{ cursor: 'pointer', color: 'var(--red)', fontSize: 18, flexShrink: 0 }}
            title="Remove"
          >
            ✕
          </div>
        </div>
      ))}
      <div
        onClick={addInvite}
        style={{
          cursor: 'pointer',
          padding: '10px 14px',
          background: 'var(--card)',
          border: '1px dashed var(--border)',
          borderRadius: 10,
          textAlign: 'center',
          fontSize: 12,
          color: 'var(--primary)',
          fontWeight: 600,
        }}
      >
        + Add Staff Invitation
      </div>
    </StepCard>
  )
}

// ── Step 5: Payment Setup ───────────────────────────────────

function PaymentStep({ stripeLinked, connectError }: { stripeLinked: boolean; connectError: string | null }) {
  return (
    <StepCard title="Payment Setup" subtitle="Connect Stripe to receive payments from customers">
      {connectError && (
        <div style={{ padding: 10, borderRadius: 8, background: 'rgba(255,59,48,0.15)', color: 'var(--red)', fontSize: 12 }}>{connectError}</div>
      )}
      {stripeLinked ? (
        <div
          style={{
            background: 'rgba(15,201,138,0.12)',
            borderRadius: 12,
            padding: 20,
            border: '1px solid rgba(15,201,138,0.3)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <div style={{ fontSize: 36 }}>✅</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--secondary)' }}>Stripe Connected</div>
          <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center' }}>
            Your business is ready to receive payments.
          </div>
        </div>
      ) : (
        <div
          style={{
            background: 'var(--card)',
            borderRadius: 12,
            padding: 20,
            border: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div style={{ fontSize: 36 }}>💳</div>
          <div style={{ fontSize: 13, color: 'var(--text2)', textAlign: 'center', lineHeight: 1.5 }}>
            Connect your Stripe account to start receiving payments from customers.
            <br />
            <span style={{ fontSize: 11, color: 'var(--text3)' }}>You can skip this step and set it up later.</span>
          </div>
        </div>
      )}
    </StepCard>
  )
}

// ── Main Onboarding Wizard ──────────────────────────────────

export default function OnboardingWizard() {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const navigate = useNavigate()

  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [completed, setCompleted] = useState(false)

  // Step 1 state
  const [hours, setHours] = useState<BusinessHours>(defaultHours())
  const [hoursError, setHoursError] = useState<string | null>(null)

  // Step 2 state
  const [service, setService] = useState<ServiceForm>(emptyServiceForm())
  const [serviceError, setServiceError] = useState<string | null>(null)

  // Step 3 state
  const [pkg, setPkg] = useState<PackageForm>(emptyPackageForm())
  const [servicesList, setServicesList] = useState<{ id: string; title: string }[]>([])
  const [packageError, setPackageError] = useState<string | null>(null)

  // Step 4 state
  const [invites, setInvites] = useState<StaffInviteForm[]>([])
  const [staffError, setStaffError] = useState<string | null>(null)

  // Step 5 state
  const [stripeLinked, setStripeLinked] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [connectError, setConnectError] = useState<string | null>(null)

  // Check stripe status on mount
  useEffect(() => {
    if (!workspaceId) return
    api.get(`/workspace/${workspaceId}/finance/stripe-status`)
      .then((res) => {
        if (res.data?.connected) setStripeLinked(true)
      })
      .catch(() => { /* not yet connected */ })
  }, [workspaceId])

  // Fetch services for package creation on step 3
  useEffect(() => {
    if (step !== 2) return
    api.get('/services')
      .then((res) => {
        const all: { id: string; title: string }[] = Array.isArray(res.data) ? res.data : []
        setServicesList(all)
      })
      .catch(() => setServicesList([]))
  }, [step])

  // ── Step actions ──────────────────────────────────────────

  async function saveHours() {
    setSaving(true)
    setHoursError(null)
    try {
      await api.put(`/companies/${workspaceId}`, { business_hours: hours })
      setStep(1)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to save business hours'
      setHoursError(msg)
    } finally {
      setSaving(false)
    }
  }

  async function saveService() {
    if (!service.title.trim()) {
      setServiceError('Title is required')
      return
    }
    if (!service.price || isNaN(Number(service.price)) || Number(service.price) <= 0) {
      setServiceError('A valid price is required')
      return
    }
    setSaving(true)
    setServiceError(null)
    try {
      const created = await api.post('/services', {
        title: service.title.trim(),
        category: service.category.trim() || null,
        price: Number(service.price),
        description: service.description.trim() || null,
      })
      // Set the created service as selected for package
      if (created.data?.id) {
        setPkg((prev) => ({ ...prev, serviceCatalogId: created.data.id }))
      }
      setStep(2)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to create service'
      setServiceError(msg)
    } finally {
      setSaving(false)
    }
  }

  async function savePackage() {
    if (!pkg.name.trim()) {
      setPackageError('Package name is required')
      return
    }
    if (!pkg.serviceCatalogId) {
      setPackageError('Please select a service')
      return
    }
    if (!pkg.price || isNaN(Number(pkg.price)) || Number(pkg.price) <= 0) {
      setPackageError('A valid price is required')
      return
    }
    if (!pkg.duration || isNaN(Number(pkg.duration)) || Number(pkg.duration) <= 0) {
      setPackageError('A valid duration is required')
      return
    }
    setSaving(true)
    setPackageError(null)
    try {
      await api.post(`/workspaces/${workspaceId}/service-packages`, {
        name: pkg.name.trim(),
        serviceCatalogId: pkg.serviceCatalogId,
        finalPrice: Number(pkg.price),
        durationMinutes: Number(pkg.duration),
        description: pkg.description.trim() || null,
      })
      setStep(3)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to create package'
      setPackageError(msg)
    } finally {
      setSaving(false)
    }
  }

  async function saveStaff() {
    if (invites.length === 0) {
      // Allow skip
      setStep(4)
      return
    }

    setSaving(true)
    setStaffError(null)
    try {
      for (const inv of invites) {
        if (inv.email.trim()) {
          await api.post(`/staff/${workspaceId}/invite`, {
            email: inv.email.trim(),
            role: inv.role,
          })
        }
      }
      setStep(4)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to invite staff'
      setStaffError(msg)
    } finally {
      setSaving(false)
    }
  }

  function skipStaff() {
    setStep(4)
  }

  async function connectStripe() {
    setConnecting(true)
    setConnectError(null)
    try {
      const res = await api.post(`/workspace/${workspaceId}/finance/stripe-connect`)
      if (res.data?.url) {
        window.open(res.data.url, '_blank')
      }
      setStripeLinked(true)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to connect Stripe'
      setConnectError(msg)
    } finally {
      setConnecting(false)
    }
  }

  function skipPayment() {
    finishOnboarding()
  }

  function finishOnboarding() {
    setCompleted(true)
    setTimeout(() => {
      if (workspaceId) navigate(`/business/${workspaceId}`)
    }, 1500)
  }

  // ── Render ────────────────────────────────────────────────

  return (
    <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <StatusBar title="9:41" showNotifDot />

      {/* Header */}
      <div style={{ background: 'var(--bg)', padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          onClick={() => workspaceId && navigate(`/business/${workspaceId}`)}
          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="var(--text)">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
          </svg>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>Setup Wizard</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
            {completed ? 'All done!' : `Step ${step + 1} of ${STEP_LABELS.length}`}
          </div>
        </div>
      </div>

      {/* Step Indicator */}
      {!completed && <StepIndicator current={step} />}

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'none' }}>
        {completed ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>🎉</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Setup Complete!</div>
            <div style={{ fontSize: 13, color: 'var(--text3)' }}>Redirecting to your workspace...</div>
          </div>
        ) : (
          <>
            {step === 0 && (
              <>
                <BusinessHoursStep hours={hours} setHours={setHours} error={hoursError} />
                <div style={{ padding: '14px 14px 40px', display: 'flex', gap: 10 }}>
                  <div
                    onClick={saveHours}
                    style={{
                      flex: 1,
                      background: saving ? 'var(--bg3)' : 'var(--primary)',
                      borderRadius: 12,
                      padding: '14px 0',
                      textAlign: 'center',
                      fontSize: 14,
                      fontWeight: 700,
                      color: '#fff',
                      cursor: saving ? 'not-allowed' : 'pointer',
                      opacity: saving ? 0.6 : 1,
                    }}
                  >
                    {saving ? 'Saving...' : 'Next: Create Service →'}
                  </div>
                </div>
              </>
            )}

            {step === 1 && (
              <>
                <ServiceStep form={service} setForm={setService} error={serviceError} />
                <div style={{ padding: '14px 14px 40px', display: 'flex', gap: 10 }}>
                  <div
                    onClick={() => setStep(0)}
                    style={{
                      flex: 1,
                      background: 'var(--card)',
                      borderRadius: 12,
                      padding: '14px 0',
                      textAlign: 'center',
                      fontSize: 14,
                      fontWeight: 600,
                      color: 'var(--text2)',
                      cursor: 'pointer',
                      border: '1px solid var(--border)',
                    }}
                  >
                    ← Back
                  </div>
                  <div
                    onClick={saveService}
                    style={{
                      flex: 2,
                      background: saving ? 'var(--bg3)' : 'var(--primary)',
                      borderRadius: 12,
                      padding: '14px 0',
                      textAlign: 'center',
                      fontSize: 14,
                      fontWeight: 700,
                      color: '#fff',
                      cursor: saving ? 'not-allowed' : 'pointer',
                      opacity: saving ? 0.6 : 1,
                    }}
                  >
                    {saving ? 'Saving...' : 'Next: Create Package →'}
                  </div>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <PackageStep
                  form={pkg}
                  setForm={setPkg}
                  services={servicesList}
                  error={packageError}
                />
                <div style={{ padding: '14px 14px 40px', display: 'flex', gap: 10 }}>
                  <div
                    onClick={() => setStep(1)}
                    style={{
                      flex: 1,
                      background: 'var(--card)',
                      borderRadius: 12,
                      padding: '14px 0',
                      textAlign: 'center',
                      fontSize: 14,
                      fontWeight: 600,
                      color: 'var(--text2)',
                      cursor: 'pointer',
                      border: '1px solid var(--border)',
                    }}
                  >
                    ← Back
                  </div>
                  <div
                    onClick={savePackage}
                    style={{
                      flex: 2,
                      background: saving ? 'var(--bg3)' : 'var(--primary)',
                      borderRadius: 12,
                      padding: '14px 0',
                      textAlign: 'center',
                      fontSize: 14,
                      fontWeight: 700,
                      color: '#fff',
                      cursor: saving ? 'not-allowed' : 'pointer',
                      opacity: saving ? 0.6 : 1,
                    }}
                  >
                    {saving ? 'Saving...' : 'Next: Invite Staff →'}
                  </div>
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <StaffStep
                  invites={invites}
                  addInvite={() => setInvites([...invites, { email: '', role: 'employee' }])}
                  removeInvite={(i) => setInvites(invites.filter((_, idx) => idx !== i))}
                  updateInvite={(i, f) => setInvites(invites.map((inv, idx) => idx === i ? f : inv))}
                  error={staffError}
                />
                <div style={{ padding: '14px 14px 40px', display: 'flex', gap: 10 }}>
                  <div
                    onClick={() => setStep(2)}
                    style={{
                      flex: 1,
                      background: 'var(--card)',
                      borderRadius: 12,
                      padding: '14px 0',
                      textAlign: 'center',
                      fontSize: 14,
                      fontWeight: 600,
                      color: 'var(--text2)',
                      cursor: 'pointer',
                      border: '1px solid var(--border)',
                    }}
                  >
                    ← Back
                  </div>
                  <div
                    onClick={skipStaff}
                    style={{
                      width: 100,
                      background: 'var(--card)',
                      borderRadius: 12,
                      padding: '14px 0',
                      textAlign: 'center',
                      fontSize: 13,
                      fontWeight: 600,
                      color: 'var(--text3)',
                      cursor: 'pointer',
                      border: '1px solid var(--border)',
                    }}
                  >
                    Skip
                  </div>
                  <div
                    onClick={saveStaff}
                    style={{
                      flex: 1,
                      background: saving ? 'var(--bg3)' : 'var(--primary)',
                      borderRadius: 12,
                      padding: '14px 0',
                      textAlign: 'center',
                      fontSize: 14,
                      fontWeight: 700,
                      color: '#fff',
                      cursor: saving ? 'not-allowed' : 'pointer',
                      opacity: saving ? 0.6 : 1,
                    }}
                  >
                    {saving ? 'Saving...' : 'Next: Payment →'}
                  </div>
                </div>
              </>
            )}

            {step === 4 && (
              <>
                <PaymentStep stripeLinked={stripeLinked} connectError={connectError} />
                <div style={{ padding: '14px 14px 40px', display: 'flex', gap: 10 }}>
                  <div
                    onClick={() => setStep(3)}
                    style={{
                      flex: 1,
                      background: 'var(--card)',
                      borderRadius: 12,
                      padding: '14px 0',
                      textAlign: 'center',
                      fontSize: 14,
                      fontWeight: 600,
                      color: 'var(--text2)',
                      cursor: 'pointer',
                      border: '1px solid var(--border)',
                    }}
                  >
                    ← Back
                  </div>
                  {!stripeLinked && (
                    <div
                      onClick={connectStripe}
                      style={{
                        flex: 1,
                        background: connecting ? 'var(--bg3)' : 'var(--primary)',
                        borderRadius: 12,
                        padding: '14px 0',
                        textAlign: 'center',
                        fontSize: 14,
                        fontWeight: 700,
                        color: '#fff',
                        cursor: connecting ? 'not-allowed' : 'pointer',
                        opacity: connecting ? 0.6 : 1,
                      }}
                    >
                      {connecting ? 'Connecting...' : 'Connect Stripe'}
                    </div>
                  )}
                  <div
                    onClick={skipPayment}
                    style={{
                      width: 100,
                      background: 'var(--card)',
                      borderRadius: 12,
                      padding: '14px 0',
                      textAlign: 'center',
                      fontSize: 13,
                      fontWeight: 600,
                      color: 'var(--secondary)',
                      cursor: 'pointer',
                      border: '1px solid var(--secondary)',
                    }}
                  >
                    Finish
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* Bottom Nav */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 24, zIndex: 50 }}>
        <BottomNav
          items={[
            { id: 'home', label: 'Home', icon: NavIcons.home },
            { id: 'social', label: 'Social', icon: NavIcons.social },
            { id: 'activity', label: 'Activity', icon: NavIcons.activity },
            { id: 'biz', label: 'Business', isBiz: true, active: true, icon: NavIcons.business },
          ]}
        />
      </div>
    </div>
  )
}