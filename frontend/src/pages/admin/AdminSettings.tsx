import { useState, useEffect } from 'react'
import api from '../../lib/api'
import { RefreshCw, Save } from 'lucide-react'

type SystemConfig = {
  id: string
  key: string
  taxRate: number
  commissionRate: number
  paymentMethods: string[]
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

  const fetchConfig = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.get<SystemConfig>('/admin/config')
      setConfig(res.data)
      setTaxRate(res.data.taxRate ?? 0)
      setCommissionRate(res.data.commissionRate ?? 0)
      setPaymentMethods((res.data.paymentMethods ?? []).join(', '))
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
        <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-2 border-[#2a2f4a] border-t-[#2b6eff]" /></div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black text-[#f0f2ff]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Settings</h1>
          <p className="mt-1 text-sm text-[#6a6e88]">Configure global system settings</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchConfig} className="flex items-center gap-2 rounded-xl border border-[#2a2f4a] bg-[#1e2235] px-4 py-2 text-sm text-[#f0f2ff] transition-all hover:border-[#2b6eff]">
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-[#2b6eff] px-4 py-2 text-sm text-white transition-all hover:bg-[#1a5ae0] disabled:opacity-50">
            <Save className="h-4 w-4" /> {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {error && <div className="rounded-2xl border border-[#ff4d4d]/30 bg-[#ff4d4d]/10 p-4 text-sm text-[#ff4d4d]">{error}</div>}
      {success && <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-400">{success}</div>}

      <div className="space-y-6 rounded-2xl border border-[#2a2f4a] bg-[#1e2235] p-6">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-[#f0f2ff]">Tax Rate (%)</label>
          <input type="number" step="0.01" min="0" max="100" value={taxRate} onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
            className="w-full rounded-xl border border-[#2a2f4a] bg-[#0d0f1a] px-4 py-2.5 text-sm text-[#f0f2ff] outline-none transition-all focus:border-[#2b6eff]" />
          <p className="text-xs text-[#6a6e88]">Default tax rate applied to all orders</p>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-[#f0f2ff]">Commission Rate (%)</label>
          <input type="number" step="0.01" min="0" max="100" value={commissionRate} onChange={(e) => setCommissionRate(parseFloat(e.target.value) || 0)}
            className="w-full rounded-xl border border-[#2a2f4a] bg-[#0d0f1a] px-4 py-2.5 text-sm text-[#f0f2ff] outline-none transition-all focus:border-[#2b6eff]" />
          <p className="text-xs text-[#6a6e88]">Platform commission deducted from provider payouts</p>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-[#f0f2ff]">Payment Methods</label>
          <input type="text" value={paymentMethods} onChange={(e) => setPaymentMethods(e.target.value)}
            className="w-full rounded-xl border border-[#2a2f4a] bg-[#0d0f1a] px-4 py-2.5 text-sm text-[#f0f2ff] outline-none transition-all focus:border-[#2b6eff]" />
          <p className="text-xs text-[#6a6e88]">Comma-separated list (e.g. platform, cash, stripe)</p>
        </div>

        {config && (
          <div className="border-t border-[#2a2f4a] pt-4 text-xs text-[#4a4f70]">
            Last updated: {new Date(config.updatedAt).toLocaleString()}
          </div>
        )}
      </div>
    </div>
  )
}
