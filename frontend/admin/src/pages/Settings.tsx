import { useState, useEffect } from 'react'
import api from '../lib/api'
import { RefreshCw, Save, CreditCard } from 'lucide-react'

type SystemConfig = {
  id: string
  key: string
  taxRate: number
  commissionRate: number
  paymentMethods: string[]
  stripePublishableKey: string | null
  stripeSecretKey: string | null
  stripeWebhookSecret: string | null
  stripeEnabled: boolean
  updatedAt: string
}

export default function AdminSettings() {
  const [config, setConfig] = useState<SystemConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [taxRate, setTaxRate] = useState(0)
  const [commissionRate, setCommissionRate] = useState(0)
  const [paymentMethods, setPaymentMethods] = useState('')
  const [stripePublishableKey, setStripePublishableKey] = useState('')
  const [stripeSecretKey, setStripeSecretKey] = useState('')
  const [stripeWebhookSecret, setStripeWebhookSecret] = useState('')
  const [stripeEnabled, setStripeEnabled] = useState(false)

  const fetchConfig = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.get<SystemConfig>('/admin/config')
      setConfig(res.data)
      setTaxRate(res.data.taxRate ?? 0)
      setCommissionRate(res.data.commissionRate ?? 0)
      setPaymentMethods((res.data.paymentMethods ?? []).join(', '))
      setStripePublishableKey(res.data.stripePublishableKey ?? '')
      setStripeSecretKey(res.data.stripeSecretKey ?? '')
      setStripeWebhookSecret(res.data.stripeWebhookSecret ?? '')
      setStripeEnabled(res.data.stripeEnabled ?? false)
    } catch (err: any) {
      setError(err?.response?.data?.error ?? err.message ?? 'Failed to load config')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchConfig() }, [])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const methods = paymentMethods.split(',').map((s) => s.trim()).filter(Boolean)
      const res = await api.put<SystemConfig>('/admin/config', {
        taxRate: Number(taxRate),
        commissionRate: Number(commissionRate),
        paymentMethods: methods,
        stripePublishableKey: stripePublishableKey.trim() || null,
        stripeSecretKey: stripeSecretKey.trim() || null,
        stripeWebhookSecret: stripeWebhookSecret.trim() || null,
        stripeEnabled,
      })
      setConfig(res.data)
      setSuccess('Settings saved successfully')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err: any) {
      setError(err?.response?.data?.error ?? err.message ?? 'Failed to save config')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
        <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-2 border-nh-admin-border border-t-nh-admin-primary" /></div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black text-nh-admin-text">Settings</h1>
          <p className="mt-1 text-sm text-nh-admin-text-secondary">Configure global system settings</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchConfig} className="flex items-center gap-2 rounded-xl border border-nh-admin-border bg-nh-admin-surface px-4 py-2 text-sm text-nh-admin-text transition-all hover:border-nh-admin-primary">
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-nh-admin-primary px-4 py-2 text-sm text-white transition-all hover:bg-nh-admin-primary-hover disabled:opacity-50">
            <Save className="h-4 w-4" /> {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {error && <div className="rounded-2xl border border-nh-admin-danger/30 bg-nh-admin-danger-bg p-4 text-sm text-nh-admin-danger">{error}</div>}
      {success && <div className="rounded-2xl border border-emerald-500/30 bg-nh-admin-success-bg p-4 text-sm text-nh-admin-success">{success}</div>}

      {/* General Settings */}
      <div className="space-y-6 rounded-2xl border border-nh-admin-border bg-nh-admin-surface p-6">
        <h2 className="text-lg font-bold text-nh-admin-text">General</h2>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-nh-admin-text">Tax Rate (%)</label>
          <input type="number" step="0.01" min="0" max="100" value={taxRate} onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
            className="w-full rounded-xl border border-nh-admin-border bg-nh-admin-bg px-4 py-2.5 text-sm text-nh-admin-text outline-none transition-all focus:border-nh-admin-primary-border" />
          <p className="text-xs text-nh-admin-text-secondary">Default tax rate applied to all orders</p>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-nh-admin-text">Commission Rate (%)</label>
          <input type="number" step="0.01" min="0" max="100" value={commissionRate} onChange={(e) => setCommissionRate(parseFloat(e.target.value) || 0)}
            className="w-full rounded-xl border border-nh-admin-border bg-nh-admin-bg px-4 py-2.5 text-sm text-nh-admin-text outline-none transition-all focus:border-nh-admin-primary-border" />
          <p className="text-xs text-nh-admin-text-secondary">Platform commission deducted from provider payouts</p>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-nh-admin-text">Payment Methods</label>
          <input type="text" value={paymentMethods} onChange={(e) => setPaymentMethods(e.target.value)}
            className="w-full rounded-xl border border-nh-admin-border bg-nh-admin-bg px-4 py-2.5 text-sm text-nh-admin-text outline-none transition-all focus:border-nh-admin-primary-border" />
          <p className="text-xs text-nh-admin-text-secondary">Comma-separated list (e.g. platform, cash, stripe)</p>
        </div>
      </div>

      {/* Stripe Payment Gateway */}
      <div className="space-y-6 rounded-2xl border border-nh-admin-border bg-nh-admin-surface p-6">
        <div className="flex items-center gap-3">
          <CreditCard className="h-6 w-6 text-nh-admin-primary" />
          <h2 className="text-lg font-bold text-nh-admin-text">Stripe Payment Gateway</h2>
        </div>
        <p className="text-sm text-nh-admin-text-secondary">
          Configure Stripe Connect for processing payments. Keys are stored encrypted in the database.
          Get your keys from the <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noopener noreferrer" className="text-nh-admin-primary underline">Stripe Dashboard</a>.
        </p>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-nh-admin-text">Publishable Key</label>
          <input type="text" value={stripePublishableKey} onChange={(e) => setStripePublishableKey(e.target.value)}
            placeholder="pk_live_..." 
            className="w-full rounded-xl border border-nh-admin-border bg-nh-admin-bg px-4 py-2.5 text-sm text-nh-admin-text outline-none transition-all focus:border-nh-admin-primary-border" />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-nh-admin-text">Secret Key</label>
          <input type="password" value={stripeSecretKey} onChange={(e) => setStripeSecretKey(e.target.value)}
            placeholder="sk_live_..." 
            className="w-full rounded-xl border border-nh-admin-border bg-nh-admin-bg px-4 py-2.5 text-sm text-nh-admin-text outline-none transition-all focus:border-nh-admin-primary-border" />
          <p className="text-xs text-nh-admin-text-secondary">Stored encrypted — never exposed to the frontend</p>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-nh-admin-text">Webhook Secret</label>
          <input type="password" value={stripeWebhookSecret} onChange={(e) => setStripeWebhookSecret(e.target.value)}
            placeholder="whsec_..." 
            className="w-full rounded-xl border border-nh-admin-border bg-nh-admin-bg px-4 py-2.5 text-sm text-nh-admin-text outline-none transition-all focus:border-nh-admin-primary-border" />
          <p className="text-xs text-nh-admin-text-secondary">Used to verify incoming Stripe webhook events</p>
        </div>

        <div className="flex items-center gap-3">
          <label className="relative inline-flex cursor-pointer items-center">
            <input type="checkbox" checked={stripeEnabled} onChange={(e) => setStripeEnabled(e.target.checked)} className="peer sr-only" />
            <div className="h-6 w-11 rounded-full bg-nh-admin-border after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-app-text-2 after:transition-all peer-checked:bg-nh-admin-primary peer-checked:after:translate-x-full peer-checked:after:bg-white" />
          </label>
          <span className="text-sm text-nh-admin-text">Enable Stripe payments</span>
        </div>
      </div>

      {config && (
        <div className="border-t border-nh-admin-border pt-4 text-xs text-nh-admin-text-muted">
          Last updated: {new Date(config.updatedAt).toLocaleString()}
        </div>
      )}
    </div>
  )
}