import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { StatusBar } from '../../components/ui/phone/StatusBar'
import { BottomNav, NavIcons } from '../../components/ui/phone/BottomNav'
import { useAuthStore } from '../../store/authStore'
import StoriesRow from '../../components/social/StoriesRow'
import SearchBox from '../../components/home/SearchBox'

const CATEGORIES = [
  { icon: '🏗️', label: 'Building' },
  { icon: '🚗', label: 'Auto' },
  { icon: '💅', label: 'Beauty' },
  { icon: '🚚', label: 'Transport' },
  { icon: '🏥', label: 'Health' },
] as const

type HomeData = {
  location: { city: string; neighborhood: string | null; shortLocation: string }
  weather: { temp: number; condition: string; icon: string }
  policeAlerts: Array<{ title: string; description: string; severity: string; time: string }>
  news: Array<{ id: string; title: string; summary: string; category: string; color: string; time: string; mediaUrl?: string | null }>
  events: Array<{ id: string; name: string; date: string; gradient: [string, string] }>
  marketData: { avgServicePrice: number | null; activeProviders: number | null; topCategories: Array<{ name: string; count: number }> }
  serviceRates: Array<{ serviceName: string; avgPrice: number; minPrice: number; maxPrice: number; sampleSize: number }>
  utilityLinks: Array<{ id: string; title: string; url: string; description: string | null; category: string; logoUrl: string | null }>
}

/**
 * HomeScreen — Matches Flutter's home_screen.dart exactly.
 * Header, week card, search + categories, services, news, events, score card, floating bottom nav.
 * Data is fetched dynamically from /api/home.
 */
export default function HomeScreen() {
  const [notifOpen, setNotifOpen] = useState(false)
  const [homeData, setHomeData] = useState<HomeData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const displayName = user?.displayName || `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Alex'
  const initial = displayName.charAt(0).toUpperCase()

  const fetchHomeData = async () => {
    setLoading(true)
    setError(null)
    try {
      const token = localStorage.getItem('neighborly-auth')
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) {
        try {
          const parsed = JSON.parse(token)
          const t = parsed?.state?.token
          if (t) headers['Authorization'] = `Bearer ${t}`
        } catch { /* ignore */ }
      }
      const res = await fetch('/api/home?city=Vaughan', { headers })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: HomeData = await res.json()
      setHomeData(data)
    } catch (err: any) {
      setError(err.message ?? 'Failed to load home data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchHomeData() }, [])

  const news = homeData?.news ?? []
  const events = homeData?.events ?? []
  const services = homeData?.utilityLinks ?? []
  const weather = homeData?.weather ?? { temp: 13, condition: 'Sunny', icon: '☀️' }
  const policeAlerts = homeData?.policeAlerts ?? []
  const marketData = homeData?.marketData ?? { avgServicePrice: null, activeProviders: null, topCategories: [] }
  const location = homeData?.location ?? { city: 'Vaughan', neighborhood: null, shortLocation: 'Vaughan, ON' }

  return (
    <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <StatusBar title="9:41" onNotifClick={() => setNotifOpen(!notifOpen)} showNotifDot />

      {/* Notification Panel */}
      {notifOpen && (
        <div
          style={{
            position: 'absolute',
            top: 48,
            left: 0,
            right: 0,
            zIndex: 300,
            background: 'var(--bg2)',
            borderBottom: '1px solid var(--border2)',
            maxHeight: 360,
            overflowY: 'auto',
          }}
        >
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Notifications</span>
            <span style={{ fontSize: 11, color: 'var(--primary)', cursor: 'pointer' }}>Mark all read</span>
          </div>
          {[
            { title: 'New offer from AutoFix Vaughan', subtitle: 'Oil change package – $69 · 5 min ago', unread: true },
            { title: policeAlerts.length > 0 ? policeAlerts[0].title : 'Police alert: Road closure on Major Mackenzie', subtitle: 'Vaughan, ON · 22 min ago', unread: true },
            { title: events.length > 0 ? `${events[0].name} starts tomorrow!` : 'Craft Festival starts tomorrow!', subtitle: events.length > 0 ? `${events[0].date}` : 'Vaughan Mills · May 10 · 10:00 AM', unread: false },
            { title: 'BeautyStudio reviewed your order', subtitle: '5 stars · 2 days ago', unread: false },
          ].map((n, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                padding: 12,
                borderBottom: '1px solid var(--border)',
                background: n.unread ? 'rgba(43,110,255,0.04)' : 'transparent',
              }}
            >
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--card)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                {n.unread ? '🔔' : '📅'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: 'var(--text)', fontWeight: 500, lineHeight: 1.5 }}>{n.title}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{n.subtitle}</div>
              </div>
              {n.unread && <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--primary)', flexShrink: 0, marginTop: 5 }} />}
            </div>
          ))}
        </div>
      )}

      {/* Scrollable content */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {/* Header */}
        <div style={{ padding: '0 18px 14px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 500, color: 'var(--primary)', marginBottom: 2 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="var(--primary)">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
              </svg>
              {location.shortLocation}
            </div>
            <div style={{ fontSize: 19, fontWeight: 700, color: 'var(--text)', fontFamily: "'Space Grotesk', sans-serif" }}>
              Good morning, {displayName.split(' ')[0]} 👋
            </div>
          </div>
          <div
            onClick={() => navigate('/app/profile')}
            style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--primary-dim)', border: '2px solid var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'var(--primary)', fontSize: 15, cursor: 'pointer', flexShrink: 0 }}
          >
            {initial}
          </div>
        </div>

        {/* Stories Row */}
        <StoriesRow />

        {/* Week Card */}
        <div style={{ margin: '14px 14px 0', borderRadius: 18, overflow: 'hidden', height: 140, background: 'linear-gradient(135deg, var(--primary), #0a1228)' }}>
          <div style={{ padding: 16 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,0.12)', borderRadius: 20, padding: '4px 10px', fontSize: 11, color: 'rgba(200,216,255,1)', marginBottom: 8 }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="rgba(200,216,255,1)">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
              </svg>
              Photo of the Week
            </div>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#fff', fontFamily: "'Space Grotesk', sans-serif", marginBottom: 10 }}>
              {location.city} Highlights
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 20, padding: '4px 10px', fontSize: 11, color: 'rgba(208,224,255,1)' }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="rgba(208,224,255,1)">
                  <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z" />
                </svg>
                {weather.temp}°C · {weather.condition}
              </div>
              {policeAlerts.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(255,184,0,0.15)', borderRadius: 20, padding: '4px 10px', fontSize: 11, color: 'rgba(208,224,255,1)' }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="rgba(208,224,255,1)">
                    <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
                  </svg>
                  Police Alert
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Search + Categories */}
        <div style={{ padding: '14px 14px 0' }}>
          <div style={{ background: 'var(--card)', borderRadius: 16, padding: 14 }}>
            <SearchBox />
            <div style={{ display: 'flex', gap: 0, marginTop: 10 }}>
              {CATEGORIES.map((cat) => (
                <div key={cat.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flex: 1, cursor: 'pointer' }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--card2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                    {cat.icon}
                  </div>
                  <span style={{ fontSize: 10, color: 'var(--text2)', textAlign: 'center' }}>{cat.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Public & Government Services */}
        <div style={{ padding: '14px 14px 0' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--text2)">
              <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
            </svg>
            Public & Government Services
          </div>
          {loading ? (
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
              {[1, 2, 3, 4].map((i) => (
                <div key={i} style={{ background: 'var(--card)', borderRadius: 10, padding: '8px 12px', width: 80, height: 20, opacity: 0.5 }} />
              ))}
            </div>
          ) : services.length > 0 ? (
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
              {services.map((svc) => (
                <div
                  key={svc.id}
                  style={{
                    background: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    padding: '8px 12px',
                    whiteSpace: 'nowrap',
                    fontSize: 12,
                    color: 'var(--text2)',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  {svc.logoUrl ? (
                    <img src={svc.logoUrl} alt={svc.title} style={{ height: 16, marginRight: 4, verticalAlign: 'middle' }} />
                  ) : null}
                  {svc.title}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--text3)', padding: '8px 0' }}>No services available yet</div>
          )}
        </div>

        {/* Local News */}
        <div style={{ padding: '14px 14px 0' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--text2)">
              <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" />
            </svg>
            Local News
          </div>
          {loading ? (
            <div>
              {[1, 2, 3].map((i) => (
                <div key={i} style={{ background: 'var(--card)', borderRadius: 12, padding: '12px 14px', marginBottom: 8, height: 20, opacity: 0.5 }} />
              ))}
            </div>
          ) : news.length > 0 ? (
            news.map((item) => (
              <div
                key={item.id}
                style={{
                  background: 'var(--card)',
                  borderRadius: 12,
                  padding: '12px 14px',
                  marginBottom: 8,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  cursor: 'pointer',
                }}
              >
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: item.color, flexShrink: 0 }} />
                <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5, flex: 1 }}>{item.summary || item.title}</div>
                <div style={{ fontSize: 10, color: 'var(--text3)', flexShrink: 0 }}>{item.time}</div>
              </div>
            ))
          ) : (
            <div style={{ fontSize: 12, color: 'var(--text3)', padding: '8px 0' }}>No news available</div>
          )}
        </div>

        {/* Local Events */}
        <div style={{ padding: '14px 14px 0' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--text2)">
              <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11z" />
            </svg>
            Local Events
          </div>
          {loading ? (
            <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
              {[1, 2, 3].map((i) => (
                <div key={i} style={{ width: 150, flexShrink: 0, borderRadius: 14, height: 100, background: 'var(--card)', opacity: 0.5 }} />
              ))}
            </div>
          ) : events.length > 0 ? (
            <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
              {events.map((evt) => (
                <div
                  key={evt.id}
                  style={{
                    width: 150,
                    flexShrink: 0,
                    borderRadius: 14,
                    overflow: 'hidden',
                    height: 100,
                    background: `linear-gradient(135deg,${evt.gradient[0]},${evt.gradient[1]})`,
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ padding: 12, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', fontFamily: "'Space Grotesk', sans-serif" }}>{evt.name}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>{evt.date}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--text3)', padding: '8px 0' }}>No upcoming events</div>
          )}
        </div>

        {/* Market Data Section */}
        {marketData.avgServicePrice && (
          <div style={{ padding: '14px 14px 0' }}>
            <div style={{ background: 'var(--card)', borderRadius: 16, padding: 14, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--text2)">
                  <path d="M3.5 18.49l6-6.01 4 4L22 6.92l-1.41-1.41-7.09 7.97-4-4L2 16.99z" />
                </svg>
                Market Data · {location.city}
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1, background: 'var(--bg)', borderRadius: 10, padding: 10, textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--primary)', fontFamily: "'Space Grotesk', sans-serif" }}>
                    ${marketData.avgServicePrice.toFixed(0)}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>Avg Price</div>
                </div>
                {marketData.activeProviders && (
                  <div style={{ flex: 1, background: 'var(--bg)', borderRadius: 10, padding: 10, textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--secondary)', fontFamily: "'Space Grotesk', sans-serif" }}>
                      {marketData.activeProviders}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>Providers</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Score Card */}
        <div style={{ margin: '14px 14px 14px', background: 'var(--card)', borderRadius: 16, padding: 14, border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 4 }}>Your Interaction Score</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--secondary)', fontFamily: "'Space Grotesk', sans-serif" }}>2,840 pts</div>
            </div>
            <div style={{ background: 'var(--primary-dim)', borderRadius: 8, padding: '6px 12px', textAlign: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--primary)', fontFamily: "'Space Grotesk', sans-serif" }}>3.2 km</div>
              <div style={{ fontSize: 10, color: 'var(--text2)', marginTop: 2 }}>Your Reach</div>
            </div>
          </div>
          <div style={{ height: 6, background: 'var(--bg)', borderRadius: 3, marginTop: 10, overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 3, background: 'linear-gradient(90deg,var(--secondary),var(--primary))', width: '56%', transition: 'width .8s' }} />
          </div>
          <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 6 }}>Keep engaging to expand your neighborhood radius!</div>
        </div>

        {/* Error state with retry */}
        {error && (
          <div style={{ padding: '0 14px 14px' }}>
            <div style={{ background: 'rgba(255,77,77,0.1)', borderRadius: 12, padding: 12, textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: 'var(--red)', marginBottom: 8 }}>Failed to load: {error}</div>
              <button onClick={fetchHomeData} style={{ background: 'var(--primary)', color: 'var(--text)', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 12, cursor: 'pointer' }}>
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Bottom spacing for floating nav */}
        <div style={{ height: 80 }} />
      </div>

      {/* Floating Bottom Nav */}
      <BottomNav
        items={[
          { id: 'home', label: 'Home', active: true, icon: NavIcons.home },
          { id: 'social', label: 'Social', icon: NavIcons.social },
          { id: 'activity', label: 'Activity', icon: NavIcons.activity },
          { id: 'biz', label: 'Business', isBiz: true, icon: NavIcons.business },
        ]}
      />
    </div>
  )
}
