import { useState, useEffect } from 'react'
import api from '../lib/api'
import {
  Plus,
  Edit3,
  Archive,
  Eye,
  EyeOff,
  RefreshCw,
  Trash2,
  RotateCcw,
  Wrench,
  Image,
  Bell,
  Globe,
  Link,
  Car,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface HomeBanner {
  id: string
  title: string
  subtitle: string | null
  imageUrl: string | null
  linkUrl: string | null
  isActive: boolean
  sortOrder: number
  startDate: string | null
  endDate: string | null
  archivedAt: string | null
  createdAt: string
  updatedAt: string
}

interface NewsArticle {
  id: string
  title: string
  body: string
  summary: string | null
  imageUrl: string | null
  category: string
  isActive: boolean
  isFeatured: boolean
  publishedAt: string | null
  scheduledAt: string | null
  expiresAt: string | null
  archivedAt: string | null
  createdAt: string
  updatedAt: string
}

interface SafetyAlert {
  id: string
  title: string
  description: string | null
  severity: string
  location: string | null
  latitude: number | null
  longitude: number | null
  source: string | null
  isActive: boolean
  expiresAt: string | null
  createdAt: string
  updatedAt: string
}

interface UtilityLink {
  id: string
  title: string
  url: string
  category: string
  iconUrl: string | null
  description: string | null
  commissionRate: number | null
  isActive: boolean
  sortOrder: number
  archivedAt: string | null
  _count?: { clicks: number }
}

interface WeatherConfig {
  id: string
  apiKey: string | null
  apiEndpoint: string | null
  latitude: number | null
  longitude: number | null
  units: string
  isEnabled: boolean
  createdAt: string
  updatedAt: string
}

interface TrafficSource {
  id: string
  name: string
  apiEndpoint: string | null
  apiKey: string | null
  isEnabled: boolean
  region: string | null
  createdAt: string
  updatedAt: string
}

type ContentTab = 'banners' | 'news' | 'alerts' | 'utility' | 'weather' | 'traffic'

const TABS: { key: ContentTab; label: string; icon: React.ReactNode }[] = [
  { key: 'banners', label: 'Banners', icon: <Image className="h-3.5 w-3.5" /> },
  { key: 'news', label: 'News', icon: <Globe className="h-3.5 w-3.5" /> },
  { key: 'alerts', label: 'Alerts', icon: <Bell className="h-3.5 w-3.5" /> },
  { key: 'utility', label: 'Utility', icon: <Link className="h-3.5 w-3.5" /> },
  { key: 'weather', label: 'Weather', icon: <Wrench className="h-3.5 w-3.5" /> },
  { key: 'traffic', label: 'Traffic', icon: <Car className="h-3.5 w-3.5" /> },
]

const NEWS_CATEGORIES = [
  { value: 'sports', label: 'Sports' },
  { value: 'community', label: 'Community' },
  { value: 'events', label: 'Events' },
  { value: 'city', label: 'City' },
  { value: 'promotions', label: 'Promotions' },
]

const UTILITY_CATEGORIES = [
  { value: 'banks', label: 'Banks' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'fuel', label: 'Fuel' },
  { value: 'government', label: 'Government' },
  { value: 'health', label: 'Health' },
  { value: 'transit', label: 'Transit' },
  { value: 'custom', label: 'Custom' },
]

const SEVERITY_OPTIONS = [
  { value: 'info', label: 'Info', color: 'bg-nh-admin-info-bg text-nh-admin-info' },
  { value: 'warning', label: 'Warning', color: 'bg-nh-admin-warning-bg text-nh-admin-warning' },
  { value: 'critical', label: 'Critical', color: 'bg-nh-admin-danger-bg text-nh-admin-danger' },
]

// ─── Banner Form Data ────────────────────────────────────────────────────────

interface BannerFormData {
  title: string
  subtitle: string
  imageUrl: string
  linkUrl: string
  isActive: boolean
  sortOrder: number
  startDate: string
  endDate: string
}

const emptyBannerForm: BannerFormData = {
  title: '',
  subtitle: '',
  imageUrl: '',
  linkUrl: '',
  isActive: true,
  sortOrder: 0,
  startDate: '',
  endDate: '',
}

// ─── News Article Form Data ──────────────────────────────────────────────────

interface NewsFormData {
  title: string
  body: string
  summary: string
  imageUrl: string
  category: string
  isActive: boolean
  isFeatured: boolean
  publishedAt: string
  scheduledAt: string
  expiresAt: string
}

const emptyNewsForm: NewsFormData = {
  title: '',
  body: '',
  summary: '',
  imageUrl: '',
  category: 'community',
  isActive: true,
  isFeatured: false,
  publishedAt: '',
  scheduledAt: '',
  expiresAt: '',
}

// ─── Safety Alert Form Data ──────────────────────────────────────────────────

interface AlertFormData {
  title: string
  description: string
  severity: string
  location: string
  latitude: string
  longitude: string
  source: string
  isActive: boolean
  expiresAt: string
}

const emptyAlertForm: AlertFormData = {
  title: '',
  description: '',
  severity: 'info',
  location: '',
  latitude: '',
  longitude: '',
  source: '',
  isActive: true,
  expiresAt: '',
}

// ─── Utility Link Form Data ──────────────────────────────────────────────────

interface UtilityFormData {
  title: string
  url: string
  category: string
  iconUrl: string
  description: string
  commissionRate: string
  isActive: boolean
  sortOrder: number
}

const emptyUtilityForm: UtilityFormData = {
  title: '',
  url: '',
  category: 'banks',
  iconUrl: '',
  description: '',
  commissionRate: '',
  isActive: true,
  sortOrder: 0,
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function AdminHomeContent() {
  const [activeTab, setActiveTab] = useState<ContentTab>('banners')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Data states
  const [banners, setBanners] = useState<HomeBanner[]>([])
  const [articles, setArticles] = useState<NewsArticle[]>([])
  const [alerts, setAlerts] = useState<SafetyAlert[]>([])
  const [links, setLinks] = useState<UtilityLink[]>([])
  const [weatherConfig, setWeatherConfig] = useState<WeatherConfig | null>(null)
  const [trafficSources, setTrafficSources] = useState<TrafficSource[]>([])

  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [bannerForm, setBannerForm] = useState<BannerFormData>(emptyBannerForm)
  const [newsForm, setNewsForm] = useState<NewsFormData>(emptyNewsForm)
  const [alertForm, setAlertForm] = useState<AlertFormData>(emptyAlertForm)
  const [utilityForm, setUtilityForm] = useState<UtilityFormData>(emptyUtilityForm)

  // Weather form
  const [weatherForm, setWeatherForm] = useState({
    apiKey: '',
    apiEndpoint: '',
    latitude: '',
    longitude: '',
    units: 'metric',
    isEnabled: true,
  })

  // Traffic form
  const [trafficForm, setTrafficForm] = useState({
    name: '',
    apiEndpoint: '',
    apiKey: '',
    region: '',
    isEnabled: true,
  })

  // ─── Fetch Functions ─────────────────────────────────────────────────────

  const fetchBanners = async () => {
    try {
      const res = await api.get('/admin/home/banners', { params: { pageSize: 50 } })
      setBanners(res.data.data ?? [])
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ?? (err as { message?: string })?.message ?? 'Failed to fetch banners'
      setError(msg)
    }
  }

  const fetchNews = async () => {
    try {
      const res = await api.get('/admin/home/news', { params: { pageSize: 50 } })
      setArticles(res.data.data ?? [])
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ?? (err as { message?: string })?.message ?? 'Failed to fetch news'
      setError(msg)
    }
  }

  const fetchAlerts = async () => {
    try {
      const res = await api.get('/admin/home/safety-alerts', { params: { pageSize: 50 } })
      setAlerts(res.data.data ?? [])
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ?? (err as { message?: string })?.message ?? 'Failed to fetch alerts'
      setError(msg)
    }
  }

  const fetchLinks = async () => {
    try {
      const res = await api.get('/admin/home/utility-links', { params: { pageSize: 50 } })
      setLinks(res.data.data ?? [])
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ?? (err as { message?: string })?.message ?? 'Failed to fetch links'
      setError(msg)
    }
  }

  const fetchWeather = async () => {
    try {
      const res = await api.get('/admin/home/weather-config')
      setWeatherConfig(res.data.data)
      if (res.data.data) {
        setWeatherForm({
          apiKey: res.data.data.apiKey ?? '',
          apiEndpoint: res.data.data.apiEndpoint ?? '',
          latitude: res.data.data.latitude?.toString() ?? '',
          longitude: res.data.data.longitude?.toString() ?? '',
          units: res.data.data.units ?? 'metric',
          isEnabled: res.data.data.isEnabled ?? true,
        })
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ?? (err as { message?: string })?.message ?? 'Failed to fetch weather'
      setError(msg)
    }
  }

  const fetchTraffic = async () => {
    try {
      const res = await api.get('/admin/home/traffic-sources')
      setTrafficSources(res.data.data ?? [])
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ?? (err as { message?: string })?.message ?? 'Failed to fetch traffic sources'
      setError(msg)
    }
  }

  const fetchTabData = async (tab: ContentTab) => {
    setLoading(true)
    setError(null)
    try {
      switch (tab) {
        case 'banners': await fetchBanners(); break
        case 'news': await fetchNews(); break
        case 'alerts': await fetchAlerts(); break
        case 'utility': await fetchLinks(); break
        case 'weather': await fetchWeather(); break
        case 'traffic': await fetchTraffic(); break
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchTabData(activeTab) }, [activeTab])

  // ─── CRUD Operations ─────────────────────────────────────────────────────

  // Banners
  const handleSaveBanner = async () => {
    setError(null)
    try {
      const payload = {
        title: bannerForm.title,
        subtitle: bannerForm.subtitle || null,
        imageUrl: bannerForm.imageUrl || null,
        linkUrl: bannerForm.linkUrl || null,
        isActive: bannerForm.isActive,
        sortOrder: Number(bannerForm.sortOrder),
        startDate: bannerForm.startDate || null,
        endDate: bannerForm.endDate || null,
      }
      if (editingId) {
        await api.put(`/admin/home/banners/${editingId}`, payload)
        setSuccess('Banner updated')
      } else {
        await api.post('/admin/home/banners', payload)
        setSuccess('Banner created')
      }
      setModalOpen(false)
      fetchBanners()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ?? (err as { message?: string })?.message ?? 'Failed to save banner'
      setError(msg)
    }
  }

  const handleDeleteBanner = async (id: string) => {
    if (!confirm('Archive this banner?')) return
    try {
      await api.delete(`/admin/home/banners/${id}`)
      setSuccess('Banner archived')
      fetchBanners()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ?? (err as { message?: string })?.message ?? 'Failed to archive'
      setError(msg)
    }
  }

  // News
  const handleSaveNews = async () => {
    setError(null)
    try {
      const payload = {
        title: newsForm.title,
        body: newsForm.body,
        summary: newsForm.summary || null,
        imageUrl: newsForm.imageUrl || null,
        category: newsForm.category,
        isActive: newsForm.isActive,
        isFeatured: newsForm.isFeatured,
        publishedAt: newsForm.publishedAt || null,
        scheduledAt: newsForm.scheduledAt || null,
        expiresAt: newsForm.expiresAt || null,
      }
      if (editingId) {
        await api.put(`/admin/home/news/${editingId}`, payload)
        setSuccess('Article updated')
      } else {
        await api.post('/admin/home/news', payload)
        setSuccess('Article created')
      }
      setModalOpen(false)
      fetchNews()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ?? (err as { message?: string })?.message ?? 'Failed to save article'
      setError(msg)
    }
  }

  const handleDeleteNews = async (id: string) => {
    if (!confirm('Archive this article?')) return
    try {
      await api.delete(`/admin/home/news/${id}`)
      setSuccess('Article archived')
      fetchNews()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ?? (err as { message?: string })?.message ?? 'Failed to archive'
      setError(msg)
    }
  }

  // Alerts
  const handleSaveAlert = async () => {
    setError(null)
    try {
      const payload = {
        title: alertForm.title,
        description: alertForm.description || null,
        severity: alertForm.severity,
        location: alertForm.location || null,
        latitude: alertForm.latitude ? Number(alertForm.latitude) : null,
        longitude: alertForm.longitude ? Number(alertForm.longitude) : null,
        source: alertForm.source || null,
        isActive: alertForm.isActive,
        expiresAt: alertForm.expiresAt || null,
      }
      if (editingId) {
        await api.put(`/admin/home/safety-alerts/${editingId}`, payload)
        setSuccess('Alert updated')
      } else {
        await api.post('/admin/home/safety-alerts', payload)
        setSuccess('Alert created')
      }
      setModalOpen(false)
      fetchAlerts()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ?? (err as { message?: string })?.message ?? 'Failed to save alert'
      setError(msg)
    }
  }

  const handleDeleteAlert = async (id: string) => {
    if (!confirm('Deactivate this alert?')) return
    try {
      await api.delete(`/admin/home/safety-alerts/${id}`)
      setSuccess('Alert deactivated')
      fetchAlerts()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ?? (err as { message?: string })?.message ?? 'Failed to deactivate'
      setError(msg)
    }
  }

  // Utility Links
  const handleSaveUtility = async () => {
    setError(null)
    try {
      const payload = {
        title: utilityForm.title,
        url: utilityForm.url,
        category: utilityForm.category,
        iconUrl: utilityForm.iconUrl || null,
        description: utilityForm.description || null,
        commissionRate: utilityForm.commissionRate ? Number(utilityForm.commissionRate) : null,
        isActive: utilityForm.isActive,
        sortOrder: Number(utilityForm.sortOrder),
      }
      if (editingId) {
        await api.put(`/admin/home/utility-links/${editingId}`, payload)
        setSuccess('Link updated')
      } else {
        await api.post('/admin/home/utility-links', payload)
        setSuccess('Link created')
      }
      setModalOpen(false)
      fetchLinks()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ?? (err as { message?: string })?.message ?? 'Failed to save link'
      setError(msg)
    }
  }

  const handleDeleteUtility = async (id: string) => {
    if (!confirm('Archive this link?')) return
    try {
      await api.delete(`/admin/home/utility-links/${id}`)
      setSuccess('Link archived')
      fetchLinks()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ?? (err as { message?: string })?.message ?? 'Failed to archive'
      setError(msg)
    }
  }

  // Weather
  const handleSaveWeather = async () => {
    setError(null)
    try {
      await api.put('/admin/home/weather-config', {
        apiKey: weatherForm.apiKey || null,
        apiEndpoint: weatherForm.apiEndpoint || null,
        latitude: weatherForm.latitude ? Number(weatherForm.latitude) : null,
        longitude: weatherForm.longitude ? Number(weatherForm.longitude) : null,
        units: weatherForm.units,
        isEnabled: weatherForm.isEnabled,
      })
      setSuccess('Weather config saved')
      fetchWeather()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ?? (err as { message?: string })?.message ?? 'Failed to save weather config'
      setError(msg)
    }
  }

  // Traffic
  const handleSaveTraffic = async () => {
    setError(null)
    try {
      const payload = {
        name: trafficForm.name,
        apiEndpoint: trafficForm.apiEndpoint || null,
        apiKey: trafficForm.apiKey || null,
        isEnabled: trafficForm.isEnabled,
        region: trafficForm.region || null,
      }
      if (editingId) {
        await api.put(`/admin/home/traffic-sources/${editingId}`, payload)
        setSuccess('Traffic source updated')
      } else {
        await api.post('/admin/home/traffic-sources', payload)
        setSuccess('Traffic source created')
      }
      setModalOpen(false)
      setTrafficForm({ name: '', apiEndpoint: '', apiKey: '', region: '', isEnabled: true })
      fetchTraffic()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ?? (err as { message?: string })?.message ?? 'Failed to save traffic source'
      setError(msg)
    }
  }

  const handleDeleteTraffic = async (id: string) => {
    if (!confirm('Delete this traffic source?')) return
    try {
      await api.delete(`/admin/home/traffic-sources/${id}`)
      setSuccess('Traffic source deleted')
      fetchTraffic()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ?? (err as { message?: string })?.message ?? 'Failed to delete'
      setError(msg)
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-nh-admin-border border-t-nh-admin-primary" />
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black text-nh-admin-text">Home Content</h1>
          <p className="mt-1 text-sm text-nh-admin-text-secondary">Manage banners, news, alerts, utility links, weather, and traffic</p>
        </div>
        <button onClick={() => fetchTabData(activeTab)} className="flex items-center gap-2 rounded-xl border border-nh-admin-border bg-nh-admin-surface px-4 py-2 text-sm text-nh-admin-text transition-all hover:border-nh-admin-primary">
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      {error && <div className="rounded-2xl border border-nh-admin-danger/30 bg-nh-admin-danger-bg p-4 text-sm text-nh-admin-danger">{error}</div>}
      {success && <div className="rounded-2xl border border-nh-admin-emerald/30 bg-nh-admin-success-bg p-4 text-sm text-nh-admin-success">{success}</div>}

      {/* Tab Navigation */}
      <div className="flex gap-1 overflow-x-auto rounded-2xl border border-nh-admin-border bg-nh-admin-surface p-1 scrollbar-none">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 flex-shrink-0 rounded-xl px-3 py-2.5 text-xs font-bold transition-all ${
              activeTab === tab.key ? 'bg-nh-admin-primary text-white' : 'text-nh-admin-text-secondary hover:text-white'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ─── Banners Tab ──────────────────────────────────────────────────── */}
      {activeTab === 'banners' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button
              onClick={() => { setEditingId(null); setBannerForm(emptyBannerForm); setModalOpen(true) }}
              className="flex items-center gap-2 rounded-xl bg-nh-admin-primary px-4 py-2 text-sm text-white transition-all hover:bg-nh-admin-primary-hover"
            >
              <Plus className="h-4 w-4" /> New Banner
            </button>
          </div>
          {banners.length === 0 ? (
            <div className="rounded-2xl border border-nh-admin-border bg-nh-admin-surface p-8 text-center">
              <p className="text-sm text-nh-admin-text-secondary">No banners yet. Create one to appear on the home screen.</p>
            </div>
          ) : (
            banners.map((b) => (
              <div key={b.id} className="rounded-2xl border border-nh-admin-border bg-nh-admin-surface p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${b.isActive ? 'bg-nh-admin-emerald-bg text-nh-admin-success' : 'bg-nh-admin-border text-nh-admin-text-secondary'}`}>
                        {b.isActive ? 'Active' : 'Inactive'}
                      </span>
                      {b.archivedAt && (
                        <span className="rounded-full bg-nh-admin-danger-bg px-2 py-0.5 text-[10px] font-bold text-nh-admin-danger">Archived</span>
                      )}
                      <span className="text-[10px] text-nh-admin-text-muted">Order: {b.sortOrder}</span>
                    </div>
                    <h3 className="text-sm font-bold text-nh-admin-text truncate">{b.title}</h3>
                    {b.subtitle && <p className="text-xs text-nh-admin-text-secondary mt-1">{b.subtitle}</p>}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => { setEditingId(b.id); setBannerForm({ title: b.title, subtitle: b.subtitle ?? '', imageUrl: b.imageUrl ?? '', linkUrl: b.linkUrl ?? '', isActive: b.isActive, sortOrder: b.sortOrder, startDate: b.startDate?.slice(0, 16) ?? '', endDate: b.endDate?.slice(0, 16) ?? '' }); setModalOpen(true) }} className="rounded-lg p-2 text-nh-admin-text-secondary hover:bg-nh-admin-border hover:text-white" title="Edit">
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button onClick={() => handleDeleteBanner(b.id)} className="rounded-lg p-2 text-nh-admin-text-secondary hover:bg-nh-admin-danger-bg hover:text-red-400" title="Archive">
                      <Archive className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ─── News Tab ─────────────────────────────────────────────────────── */}
      {activeTab === 'news' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button
              onClick={() => { setEditingId(null); setNewsForm(emptyNewsForm); setModalOpen(true) }}
              className="flex items-center gap-2 rounded-xl bg-nh-admin-primary px-4 py-2 text-sm text-white transition-all hover:bg-nh-admin-primary-hover"
            >
              <Plus className="h-4 w-4" /> New Article
            </button>
          </div>
          {articles.length === 0 ? (
            <div className="rounded-2xl border border-nh-admin-border bg-nh-admin-surface p-8 text-center">
              <p className="text-sm text-nh-admin-text-secondary">No news articles yet. Create one to appear on the home screen.</p>
            </div>
          ) : (
            articles.map((a) => (
              <div key={a.id} className="rounded-2xl border border-nh-admin-border bg-nh-admin-surface p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${a.isActive ? 'bg-nh-admin-emerald-bg text-nh-admin-success' : 'bg-nh-admin-border text-nh-admin-text-secondary'}`}>
                        {a.isActive ? 'Active' : 'Inactive'}
                      </span>
                      {a.isFeatured && <span className="rounded-full bg-nh-admin-primary-bg text-nh-admin-primary px-2 py-0.5 text-[10px] font-bold">Featured</span>}
                      <span className="rounded-full bg-nh-admin-border px-2 py-0.5 text-[10px] text-nh-admin-text-secondary">{a.category}</span>
                    </div>
                    <h3 className="text-sm font-bold text-nh-admin-text truncate">{a.title}</h3>
                    {a.summary && <p className="text-xs text-nh-admin-text-secondary mt-1 line-clamp-2">{a.summary}</p>}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => { setEditingId(a.id); setNewsForm({ title: a.title, body: a.body, summary: a.summary ?? '', imageUrl: a.imageUrl ?? '', category: a.category, isActive: a.isActive, isFeatured: a.isFeatured, publishedAt: a.publishedAt?.slice(0, 16) ?? '', scheduledAt: a.scheduledAt?.slice(0, 16) ?? '', expiresAt: a.expiresAt?.slice(0, 16) ?? '' }); setModalOpen(true) }} className="rounded-lg p-2 text-nh-admin-text-secondary hover:bg-nh-admin-border hover:text-white" title="Edit">
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button onClick={() => handleDeleteNews(a.id)} className="rounded-lg p-2 text-nh-admin-text-secondary hover:bg-nh-admin-danger-bg hover:text-red-400" title="Archive">
                      <Archive className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ─── Alerts Tab ───────────────────────────────────────────────────── */}
      {activeTab === 'alerts' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button
              onClick={() => { setEditingId(null); setAlertForm(emptyAlertForm); setModalOpen(true) }}
              className="flex items-center gap-2 rounded-xl bg-nh-admin-primary px-4 py-2 text-sm text-white transition-all hover:bg-nh-admin-primary-hover"
            >
              <Plus className="h-4 w-4" /> New Alert
            </button>
          </div>
          {alerts.length === 0 ? (
            <div className="rounded-2xl border border-nh-admin-border bg-nh-admin-surface p-8 text-center">
              <p className="text-sm text-nh-admin-text-secondary">No safety alerts yet.</p>
            </div>
          ) : (
            alerts.map((a) => {
              const sev = SEVERITY_OPTIONS.find((s) => s.value === a.severity)
              return (
                <div key={a.id} className="rounded-2xl border border-nh-admin-border bg-nh-admin-surface p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${sev?.color ?? ''}`}>
                          {sev?.label ?? a.severity}
                        </span>
                        {a.isActive ? (
                          <span className="rounded-full bg-nh-admin-emerald-bg px-2 py-0.5 text-[10px] font-bold text-nh-admin-success">Active</span>
                        ) : (
                          <span className="rounded-full bg-nh-admin-border px-2 py-0.5 text-[10px] text-nh-admin-text-secondary">Inactive</span>
                        )}
                        {a.location && <span className="text-[10px] text-nh-admin-text-muted">· {a.location}</span>}
                      </div>
                      <h3 className="text-sm font-bold text-nh-admin-text">{a.title}</h3>
                      {a.description && <p className="text-xs text-nh-admin-text-secondary mt-1">{a.description}</p>}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => { setEditingId(a.id); setAlertForm({ title: a.title, description: a.description ?? '', severity: a.severity, location: a.location ?? '', latitude: a.latitude?.toString() ?? '', longitude: a.longitude?.toString() ?? '', source: a.source ?? '', isActive: a.isActive, expiresAt: a.expiresAt?.slice(0, 16) ?? '' }); setModalOpen(true) }} className="rounded-lg p-2 text-nh-admin-text-secondary hover:bg-nh-admin-border hover:text-white" title="Edit">
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button onClick={() => handleDeleteAlert(a.id)} className="rounded-lg p-2 text-nh-admin-text-secondary hover:bg-nh-admin-danger-bg hover:text-red-400" title="Deactivate">
                        <Archive className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* ─── Utility Links Tab ────────────────────────────────────────────── */}
      {activeTab === 'utility' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button
              onClick={() => { setEditingId(null); setUtilityForm(emptyUtilityForm); setModalOpen(true) }}
              className="flex items-center gap-2 rounded-xl bg-nh-admin-primary px-4 py-2 text-sm text-white transition-all hover:bg-nh-admin-primary-hover"
            >
              <Plus className="h-4 w-4" /> New Link
            </button>
          </div>
          {links.length === 0 ? (
            <div className="rounded-2xl border border-nh-admin-border bg-nh-admin-surface p-8 text-center">
              <p className="text-sm text-nh-admin-text-secondary">No utility links yet.</p>
            </div>
          ) : (
            links.map((l) => (
              <div key={l.id} className="rounded-2xl border border-nh-admin-border bg-nh-admin-surface p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${l.isActive ? 'bg-nh-admin-emerald-bg text-nh-admin-success' : 'bg-nh-admin-border text-nh-admin-text-secondary'}`}>
                        {l.isActive ? 'Active' : 'Inactive'}
                      </span>
                      <span className="rounded-full bg-nh-admin-border px-2 py-0.5 text-[10px] text-nh-admin-text-secondary">{l.category}</span>
                      {l.commissionRate != null && (
                        <span className="text-[10px] text-nh-admin-text-muted">Commission: {l.commissionRate}%</span>
                      )}
                      {l._count?.clicks != null && (
                        <span className="text-[10px] text-nh-admin-text-muted">Clicks: {l._count.clicks}</span>
                      )}
                    </div>
                    <h3 className="text-sm font-bold text-nh-admin-text truncate">{l.title}</h3>
                    <p className="text-xs text-nh-admin-text-secondary truncate mt-0.5">{l.url}</p>
                    {l.description && <p className="text-xs text-nh-admin-text-muted mt-0.5">{l.description}</p>}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => { setEditingId(l.id); setUtilityForm({ title: l.title, url: l.url, category: l.category, iconUrl: l.iconUrl ?? '', description: l.description ?? '', commissionRate: l.commissionRate?.toString() ?? '', isActive: l.isActive, sortOrder: l.sortOrder }); setModalOpen(true) }} className="rounded-lg p-2 text-nh-admin-text-secondary hover:bg-nh-admin-border hover:text-white" title="Edit">
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button onClick={() => handleDeleteUtility(l.id)} className="rounded-lg p-2 text-nh-admin-text-secondary hover:bg-nh-admin-danger-bg hover:text-red-400" title="Archive">
                      <Archive className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ─── Weather Config Tab ───────────────────────────────────────────── */}
      {activeTab === 'weather' && (
        <div className="rounded-2xl border border-nh-admin-border bg-nh-admin-surface p-6 space-y-4">
          <h3 className="text-sm font-bold text-nh-admin-text">Weather Configuration</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-nh-admin-text mb-1">API Endpoint</label>
              <input type="text" value={weatherForm.apiEndpoint} onChange={(e) => setWeatherForm({ ...weatherForm, apiEndpoint: e.target.value })}
                className="w-full rounded-xl border border-nh-admin-border bg-nh-admin-bg px-4 py-2.5 text-sm text-nh-admin-text outline-none focus:border-nh-admin-primary-border" />
            </div>
            <div>
              <label className="block text-xs font-medium text-nh-admin-text mb-1">API Key</label>
              <input type="password" value={weatherForm.apiKey} onChange={(e) => setWeatherForm({ ...weatherForm, apiKey: e.target.value })}
                className="w-full rounded-xl border border-nh-admin-border bg-nh-admin-bg px-4 py-2.5 text-sm text-nh-admin-text outline-none focus:border-nh-admin-primary-border" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-nh-admin-text mb-1">Latitude</label>
                <input type="text" value={weatherForm.latitude} onChange={(e) => setWeatherForm({ ...weatherForm, latitude: e.target.value })}
                  className="w-full rounded-xl border border-nh-admin-border bg-nh-admin-bg px-4 py-2.5 text-sm text-nh-admin-text outline-none focus:border-nh-admin-primary-border" />
              </div>
              <div>
                <label className="block text-xs font-medium text-nh-admin-text mb-1">Longitude</label>
                <input type="text" value={weatherForm.longitude} onChange={(e) => setWeatherForm({ ...weatherForm, longitude: e.target.value })}
                  className="w-full rounded-xl border border-nh-admin-border bg-nh-admin-bg px-4 py-2.5 text-sm text-nh-admin-text outline-none focus:border-nh-admin-primary-border" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-nh-admin-text mb-1">Units</label>
                <select value={weatherForm.units} onChange={(e) => setWeatherForm({ ...weatherForm, units: e.target.value })}
                  className="w-full rounded-xl border border-nh-admin-border bg-nh-admin-bg px-4 py-2.5 text-sm text-nh-admin-text outline-none focus:border-nh-admin-primary-border">
                  <option value="metric">Metric (°C)</option>
                  <option value="imperial">Imperial (°F)</option>
                </select>
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={weatherForm.isEnabled} onChange={(e) => setWeatherForm({ ...weatherForm, isEnabled: e.target.checked })}
                    className="w-4 h-4 rounded" />
                  <span className="text-sm text-nh-admin-text">Enabled</span>
                </label>
              </div>
            </div>
          </div>
          <button onClick={handleSaveWeather} className="rounded-xl bg-nh-admin-primary px-4 py-2.5 text-sm text-white transition-all hover:bg-nh-admin-primary-hover">
            Save Weather Config
          </button>
        </div>
      )}

      {/* ─── Traffic Sources Tab ──────────────────────────────────────────── */}
      {activeTab === 'traffic' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button
              onClick={() => { setEditingId(null); setTrafficForm({ name: '', apiEndpoint: '', apiKey: '', region: '', isEnabled: true }); setModalOpen(true) }}
              className="flex items-center gap-2 rounded-xl bg-nh-admin-primary px-4 py-2 text-sm text-white transition-all hover:bg-nh-admin-primary-hover"
            >
              <Plus className="h-4 w-4" /> New Source
            </button>
          </div>
          {trafficSources.length === 0 ? (
            <div className="rounded-2xl border border-nh-admin-border bg-nh-admin-surface p-8 text-center">
              <p className="text-sm text-nh-admin-text-secondary">No traffic alert sources configured yet.</p>
            </div>
          ) : (
            trafficSources.map((t) => (
              <div key={t.id} className="rounded-2xl border border-nh-admin-border bg-nh-admin-surface p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${t.isEnabled ? 'bg-nh-admin-emerald-bg text-nh-admin-success' : 'bg-nh-admin-border text-nh-admin-text-secondary'}`}>
                        {t.isEnabled ? 'Enabled' : 'Disabled'}
                      </span>
                      {t.region && <span className="text-[10px] text-nh-admin-text-muted">Region: {t.region}</span>}
                    </div>
                    <h3 className="text-sm font-bold text-nh-admin-text">{t.name}</h3>
                    {t.apiEndpoint && <p className="text-xs text-nh-admin-text-secondary truncate mt-0.5">{t.apiEndpoint}</p>}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => { setEditingId(t.id); setTrafficForm({ name: t.name, apiEndpoint: t.apiEndpoint ?? '', apiKey: t.apiKey ?? '', region: t.region ?? '', isEnabled: t.isEnabled }); setModalOpen(true) }} className="rounded-lg p-2 text-nh-admin-text-secondary hover:bg-nh-admin-border hover:text-white" title="Edit">
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button onClick={() => handleDeleteTraffic(t.id)} className="rounded-lg p-2 text-nh-admin-text-secondary hover:bg-nh-admin-danger-bg hover:text-red-400" title="Delete">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ─── Modal ─────────────────────────────────────────────────────────── */}
      {modalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-nh-admin-backdrop backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-nh-admin-border bg-nh-admin-surface p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-black text-nh-admin-text mb-6">
              {editingId ? 'Edit' : 'New'} {activeTab === 'banners' ? 'Banner' : activeTab === 'news' ? 'Article' : activeTab === 'alerts' ? 'Alert' : activeTab === 'utility' ? 'Link' : 'Traffic Source'}
            </h2>

            {/* Banner Form */}
            {activeTab === 'banners' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-nh-admin-text mb-1">Title *</label>
                  <input type="text" value={bannerForm.title} onChange={(e) => setBannerForm({ ...bannerForm, title: e.target.value })}
                    className="w-full rounded-xl border border-nh-admin-border bg-nh-admin-bg px-4 py-2.5 text-sm text-nh-admin-text outline-none focus:border-nh-admin-primary-border" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-nh-admin-text mb-1">Subtitle</label>
                  <input type="text" value={bannerForm.subtitle} onChange={(e) => setBannerForm({ ...bannerForm, subtitle: e.target.value })}
                    className="w-full rounded-xl border border-nh-admin-border bg-nh-admin-bg px-4 py-2.5 text-sm text-nh-admin-text outline-none focus:border-nh-admin-primary-border" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-nh-admin-text mb-1">Image URL</label>
                  <input type="text" value={bannerForm.imageUrl} onChange={(e) => setBannerForm({ ...bannerForm, imageUrl: e.target.value })}
                    className="w-full rounded-xl border border-nh-admin-border bg-nh-admin-bg px-4 py-2.5 text-sm text-nh-admin-text outline-none focus:border-nh-admin-primary-border" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-nh-admin-text mb-1">Link URL</label>
                  <input type="text" value={bannerForm.linkUrl} onChange={(e) => setBannerForm({ ...bannerForm, linkUrl: e.target.value })}
                    className="w-full rounded-xl border border-nh-admin-border bg-nh-admin-bg px-4 py-2.5 text-sm text-nh-admin-text outline-none focus:border-nh-admin-primary-border" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-nh-admin-text mb-1">Sort Order</label>
                    <input type="number" value={bannerForm.sortOrder} onChange={(e) => setBannerForm({ ...bannerForm, sortOrder: parseInt(e.target.value) || 0 })}
                      className="w-full rounded-xl border border-nh-admin-border bg-nh-admin-bg px-4 py-2.5 text-sm text-nh-admin-text outline-none focus:border-nh-admin-primary-border" />
                  </div>
                  <div className="flex items-end">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={bannerForm.isActive} onChange={(e) => setBannerForm({ ...bannerForm, isActive: e.target.checked })}
                        className="w-4 h-4 rounded" />
                      <span className="text-sm text-nh-admin-text">Active</span>
                    </label>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-nh-admin-text mb-1">Start Date</label>
                    <input type="datetime-local" value={bannerForm.startDate} onChange={(e) => setBannerForm({ ...bannerForm, startDate: e.target.value })}
                      className="w-full rounded-xl border border-nh-admin-border bg-nh-admin-bg px-4 py-2.5 text-sm text-nh-admin-text outline-none focus:border-nh-admin-primary-border" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-nh-admin-text mb-1">End Date</label>
                    <input type="datetime-local" value={bannerForm.endDate} onChange={(e) => setBannerForm({ ...bannerForm, endDate: e.target.value })}
                      className="w-full rounded-xl border border-nh-admin-border bg-nh-admin-bg px-4 py-2.5 text-sm text-nh-admin-text outline-none focus:border-nh-admin-primary-border" />
                  </div>
                </div>
              </div>
            )}

            {/* News Form */}
            {activeTab === 'news' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-nh-admin-text mb-1">Title *</label>
                  <input type="text" value={newsForm.title} onChange={(e) => setNewsForm({ ...newsForm, title: e.target.value })}
                    className="w-full rounded-xl border border-nh-admin-border bg-nh-admin-bg px-4 py-2.5 text-sm text-nh-admin-text outline-none focus:border-nh-admin-primary-border" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-nh-admin-text mb-1">Body *</label>
                  <textarea value={newsForm.body} onChange={(e) => setNewsForm({ ...newsForm, body: e.target.value })} rows={4}
                    className="w-full rounded-xl border border-nh-admin-border bg-nh-admin-bg px-4 py-2.5 text-sm text-nh-admin-text outline-none focus:border-nh-admin-primary-border" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-nh-admin-text mb-1">Summary</label>
                  <textarea value={newsForm.summary} onChange={(e) => setNewsForm({ ...newsForm, summary: e.target.value })} rows={2}
                    className="w-full rounded-xl border border-nh-admin-border bg-nh-admin-bg px-4 py-2.5 text-sm text-nh-admin-text outline-none focus:border-nh-admin-primary-border" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-nh-admin-text mb-1">Category</label>
                    <select value={newsForm.category} onChange={(e) => setNewsForm({ ...newsForm, category: e.target.value })}
                      className="w-full rounded-xl border border-nh-admin-border bg-nh-admin-bg px-4 py-2.5 text-sm text-nh-admin-text outline-none focus:border-nh-admin-primary-border">
                      {NEWS_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-nh-admin-text mb-1">Image URL</label>
                    <input type="text" value={newsForm.imageUrl} onChange={(e) => setNewsForm({ ...newsForm, imageUrl: e.target.value })}
                      className="w-full rounded-xl border border-nh-admin-border bg-nh-admin-bg px-4 py-2.5 text-sm text-nh-admin-text outline-none focus:border-nh-admin-primary-border" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-end gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={newsForm.isActive} onChange={(e) => setNewsForm({ ...newsForm, isActive: e.target.checked })}
                        className="w-4 h-4 rounded" />
                      <span className="text-sm text-nh-admin-text">Active</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={newsForm.isFeatured} onChange={(e) => setNewsForm({ ...newsForm, isFeatured: e.target.checked })}
                        className="w-4 h-4 rounded" />
                      <span className="text-sm text-nh-admin-text">Featured</span>
                    </label>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-nh-admin-text mb-1">Publish Date</label>
                    <input type="datetime-local" value={newsForm.publishedAt} onChange={(e) => setNewsForm({ ...newsForm, publishedAt: e.target.value })}
                      className="w-full rounded-xl border border-nh-admin-border bg-nh-admin-bg px-4 py-2.5 text-sm text-nh-admin-text outline-none focus:border-nh-admin-primary-border" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-nh-admin-text mb-1">Expires At</label>
                    <input type="datetime-local" value={newsForm.expiresAt} onChange={(e) => setNewsForm({ ...newsForm, expiresAt: e.target.value })}
                      className="w-full rounded-xl border border-nh-admin-border bg-nh-admin-bg px-4 py-2.5 text-sm text-nh-admin-text outline-none focus:border-nh-admin-primary-border" />
                  </div>
                </div>
              </div>
            )}

            {/* Alert Form */}
            {activeTab === 'alerts' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-nh-admin-text mb-1">Title *</label>
                  <input type="text" value={alertForm.title} onChange={(e) => setAlertForm({ ...alertForm, title: e.target.value })}
                    className="w-full rounded-xl border border-nh-admin-border bg-nh-admin-bg px-4 py-2.5 text-sm text-nh-admin-text outline-none focus:border-nh-admin-primary-border" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-nh-admin-text mb-1">Description</label>
                  <textarea value={alertForm.description} onChange={(e) => setAlertForm({ ...alertForm, description: e.target.value })} rows={3}
                    className="w-full rounded-xl border border-nh-admin-border bg-nh-admin-bg px-4 py-2.5 text-sm text-nh-admin-text outline-none focus:border-nh-admin-primary-border" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-nh-admin-text mb-1">Severity</label>
                    <select value={alertForm.severity} onChange={(e) => setAlertForm({ ...alertForm, severity: e.target.value })}
                      className="w-full rounded-xl border border-nh-admin-border bg-nh-admin-bg px-4 py-2.5 text-sm text-nh-admin-text outline-none focus:border-nh-admin-primary-border">
                      {SEVERITY_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-nh-admin-text mb-1">Location</label>
                    <input type="text" value={alertForm.location} onChange={(e) => setAlertForm({ ...alertForm, location: e.target.value })}
                      className="w-full rounded-xl border border-nh-admin-border bg-nh-admin-bg px-4 py-2.5 text-sm text-nh-admin-text outline-none focus:border-nh-admin-primary-border" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-nh-admin-text mb-1">Expires At</label>
                    <input type="datetime-local" value={alertForm.expiresAt} onChange={(e) => setAlertForm({ ...alertForm, expiresAt: e.target.value })}
                      className="w-full rounded-xl border border-nh-admin-border bg-nh-admin-bg px-4 py-2.5 text-sm text-nh-admin-text outline-none focus:border-nh-admin-primary-border" />
                  </div>
                  <div className="flex items-end">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={alertForm.isActive} onChange={(e) => setAlertForm({ ...alertForm, isActive: e.target.checked })}
                        className="w-4 h-4 rounded" />
                      <span className="text-sm text-nh-admin-text">Active</span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Utility Form */}
            {activeTab === 'utility' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-nh-admin-text mb-1">Title *</label>
                  <input type="text" value={utilityForm.title} onChange={(e) => setUtilityForm({ ...utilityForm, title: e.target.value })}
                    className="w-full rounded-xl border border-nh-admin-border bg-nh-admin-bg px-4 py-2.5 text-sm text-nh-admin-text outline-none focus:border-nh-admin-primary-border" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-nh-admin-text mb-1">URL *</label>
                  <input type="text" value={utilityForm.url} onChange={(e) => setUtilityForm({ ...utilityForm, url: e.target.value })}
                    className="w-full rounded-xl border border-nh-admin-border bg-nh-admin-bg px-4 py-2.5 text-sm text-nh-admin-text outline-none focus:border-nh-admin-primary-border" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-nh-admin-text mb-1">Category</label>
                    <select value={utilityForm.category} onChange={(e) => setUtilityForm({ ...utilityForm, category: e.target.value })}
                      className="w-full rounded-xl border border-nh-admin-border bg-nh-admin-bg px-4 py-2.5 text-sm text-nh-admin-text outline-none focus:border-nh-admin-primary-border">
                      {UTILITY_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-nh-admin-text mb-1">Commission Rate (%)</label>
                    <input type="number" min="0" max="100" step="0.1" value={utilityForm.commissionRate} onChange={(e) => setUtilityForm({ ...utilityForm, commissionRate: e.target.value })}
                      className="w-full rounded-xl border border-nh-admin-border bg-nh-admin-bg px-4 py-2.5 text-sm text-nh-admin-text outline-none focus:border-nh-admin-primary-border" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-nh-admin-text mb-1">Icon URL</label>
                  <input type="text" value={utilityForm.iconUrl} onChange={(e) => setUtilityForm({ ...utilityForm, iconUrl: e.target.value })}
                    className="w-full rounded-xl border border-nh-admin-border bg-nh-admin-bg px-4 py-2.5 text-sm text-nh-admin-text outline-none focus:border-nh-admin-primary-border" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-nh-admin-text mb-1">Description</label>
                  <input type="text" value={utilityForm.description} onChange={(e) => setUtilityForm({ ...utilityForm, description: e.target.value })}
                    className="w-full rounded-xl border border-nh-admin-border bg-nh-admin-bg px-4 py-2.5 text-sm text-nh-admin-text outline-none focus:border-nh-admin-primary-border" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-nh-admin-text mb-1">Sort Order</label>
                    <input type="number" value={utilityForm.sortOrder} onChange={(e) => setUtilityForm({ ...utilityForm, sortOrder: parseInt(e.target.value) || 0 })}
                      className="w-full rounded-xl border border-nh-admin-border bg-nh-admin-bg px-4 py-2.5 text-sm text-nh-admin-text outline-none focus:border-nh-admin-primary-border" />
                  </div>
                  <div className="flex items-end">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={utilityForm.isActive} onChange={(e) => setUtilityForm({ ...utilityForm, isActive: e.target.checked })}
                        className="w-4 h-4 rounded" />
                      <span className="text-sm text-nh-admin-text">Active</span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Traffic Form */}
            {activeTab === 'traffic' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-nh-admin-text mb-1">Name *</label>
                  <input type="text" value={trafficForm.name} onChange={(e) => setTrafficForm({ ...trafficForm, name: e.target.value })}
                    className="w-full rounded-xl border border-nh-admin-border bg-nh-admin-bg px-4 py-2.5 text-sm text-nh-admin-text outline-none focus:border-nh-admin-primary-border" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-nh-admin-text mb-1">API Endpoint</label>
                  <input type="text" value={trafficForm.apiEndpoint} onChange={(e) => setTrafficForm({ ...trafficForm, apiEndpoint: e.target.value })}
                    className="w-full rounded-xl border border-nh-admin-border bg-nh-admin-bg px-4 py-2.5 text-sm text-nh-admin-text outline-none focus:border-nh-admin-primary-border" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-nh-admin-text mb-1">API Key</label>
                  <input type="password" value={trafficForm.apiKey} onChange={(e) => setTrafficForm({ ...trafficForm, apiKey: e.target.value })}
                    className="w-full rounded-xl border border-nh-admin-border bg-nh-admin-bg px-4 py-2.5 text-sm text-nh-admin-text outline-none focus:border-nh-admin-primary-border" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-nh-admin-text mb-1">Region</label>
                    <input type="text" value={trafficForm.region} onChange={(e) => setTrafficForm({ ...trafficForm, region: e.target.value })}
                      className="w-full rounded-xl border border-nh-admin-border bg-nh-admin-bg px-4 py-2.5 text-sm text-nh-admin-text outline-none focus:border-nh-admin-primary-border" />
                  </div>
                  <div className="flex items-end">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={trafficForm.isEnabled} onChange={(e) => setTrafficForm({ ...trafficForm, isEnabled: e.target.checked })}
                        className="w-4 h-4 rounded" />
                      <span className="text-sm text-nh-admin-text">Enabled</span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-6 flex items-center justify-end gap-3">
              <button onClick={() => setModalOpen(false)} className="rounded-xl border border-nh-admin-border bg-nh-admin-bg px-4 py-2.5 text-sm text-nh-admin-text transition-all hover:border-nh-admin-primary">
                Cancel
              </button>
              <button
                onClick={() => {
                  switch (activeTab) {
                    case 'banners': handleSaveBanner(); break
                    case 'news': handleSaveNews(); break
                    case 'alerts': handleSaveAlert(); break
                    case 'utility': handleSaveUtility(); break
                    case 'traffic': handleSaveTraffic(); break
                  }
                }}
                className="rounded-xl bg-nh-admin-primary px-4 py-2.5 text-sm text-white transition-all hover:bg-nh-admin-primary-hover"
              >
                {editingId ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}