import { useState } from 'react'
import { useWeather, useActiveAlerts } from '../../services/homeContentApi.js'

interface NeighbourhoodBannerProps {
  neighbourhoodName: string
  neighbourhoodPhoto?: string | null
  onExpand: () => void
}

const WEATHER_ICON_MAP: Record<string, string> = {
  sunny: '☀️',
  clear: '☀️',
  partly_cloudy: '⛅',
  cloudy: '☁️',
  overcast: '☁️',
  rain: '🌧️',
  light_rain: '🌦️',
  heavy_rain: '🌧️',
  thunderstorm: '⛈️',
  snow: '🌨️',
  fog: '🌫️',
  wind: '💨',
}

function getWeatherEmoji(condition: string): string {
  const lower = condition.toLowerCase().replace(/\s+/g, '_')
  for (const [key, emoji] of Object.entries(WEATHER_ICON_MAP)) {
    if (lower.includes(key)) return emoji
  }
  return '🌤️'
}

function getSeverityBadge(severity: string): string {
  switch (severity) {
    case 'critical': return 'bg-nh-danger/20 text-nh-danger border-nh-danger/30'
    case 'warning': return 'bg-nh-warning/20 text-nh-warning border-nh-warning/30'
    default: return 'bg-nh-primary/20 text-nh-primary border-nh-primary/30'
  }
}

function getSeverityLabel(severity: string): string {
  switch (severity) {
    case 'critical': return 'critical'
    case 'warning': return 'warning'
    default: return 'info'
  }
}

export default function NeighbourhoodBanner({
  neighbourhoodName,
  neighbourhoodPhoto,
  onExpand,
}: NeighbourhoodBannerProps) {
  const { data: weather, isLoading: weatherLoading } = useWeather()
  const { data: alerts, isLoading: alertsLoading } = useActiveAlerts()
  const [expanded, setExpanded] = useState(false)

  const activeAlerts = alerts?.filter((a) => a.isActive && a.severity === 'critical') ?? []
  const warningAlerts = alerts?.filter((a) => a.isActive && a.severity !== 'critical') ?? []

  const forecastHours = [
    { time: 'Now', temp: weather?.temp ?? '--', icon: getWeatherEmoji(weather?.condition ?? 'unknown') },
    { time: '+1h', temp: weather?.temp != null ? `${weather.temp + 1}°` : '--', icon: '🌤️' },
    { time: '+2h', temp: weather?.temp != null ? `${weather.temp}°` : '--', icon: '⛅' },
    { time: '+3h', temp: weather?.temp != null ? `${weather.temp - 1}°` : '--', icon: '☁️' },
  ]

  if (weatherLoading && alertsLoading) {
    return (
      <div className="relative h-[20vh] min-h-[180px] rounded-2xl overflow-hidden bg-gradient-to-br from-nh-surface to-nh-surface-elevated animate-pulse">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-6 w-6 rounded-full border-2 border-nh-border border-t-nh-primary animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div
      className="relative rounded-2xl overflow-hidden cursor-pointer transition-all duration-300"
      style={{
        height: expanded ? 'auto' : '20vh',
        minHeight: expanded ? 'auto' : '180px',
        background: neighbourhoodPhoto
          ? `linear-gradient(180deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.7) 100%), url(${neighbourhoodPhoto}) center/cover`
          : 'linear-gradient(135deg, #1a3580 0%, #0a1228 50%, #1a2240 100%)',
      }}
      onClick={() => {
        if (!expanded) {
          setExpanded(true)
          onExpand()
        } else {
          setExpanded(false)
        }
      }}
    >
      {/* Collapsed content */}
      <div className="absolute inset-0 p-4 flex flex-col justify-between">
        {/* Top row: temperature + weather */}
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs text-white/70 font-medium uppercase tracking-wider">
              {neighbourhoodName}
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-black text-white" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                {weather?.temp != null ? `${weather.temp}°` : '--°'}
              </span>
              <span className="text-lg">{getWeatherEmoji(weather?.condition ?? 'unknown')}</span>
            </div>
            <div className="text-xs text-white/60 mt-0.5">{weather?.condition ?? 'Loading...'}</div>
          </div>

          {/* Alert badges */}
          <div className="flex flex-col items-end gap-1.5">
            {activeAlerts.slice(0, 2).map((alert) => (
              <div
                key={alert.id}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${getSeverityBadge(alert.severity)}`}
              >
                {alert.severity === 'critical' ? '!' : 'i'}
                <span className="max-w-[100px] truncate">{alert.title}</span>
              </div>
            ))}
            {activeAlerts.length > 2 && (
              <div className="text-[10px] text-white/50">+{activeAlerts.length - 2} more</div>
            )}
          </div>
        </div>

        {/* Traffic alert chips */}
        {warningAlerts.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto scrollbar-none -mx-4 px-4">
            {warningAlerts.slice(0, 4).map((alert) => (
              <div
                key={alert.id}
                className={`flex-shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-medium border whitespace-nowrap ${getSeverityBadge(alert.severity)}`}
              >
                {alert.location ?? alert.title}
              </div>
            ))}
          </div>
        )}

        {/* Weather forecast mini-strip */}
        <div className="flex items-center gap-3 justify-between">
          {forecastHours.map((f, i) => (
            <div key={i} className="flex flex-col items-center gap-0.5">
              <span className="text-[10px] text-white/50">{f.time}</span>
              <span className="text-sm">{f.icon}</span>
              <span className="text-[10px] text-white/70 font-medium">{f.temp}</span>
            </div>
          ))}
        </div>

        {/* Tap hint */}
        <div className="text-center text-[10px] text-white/40">tap for details</div>
      </div>

      {/* Expanded detail view */}
      {expanded && (
        <div className="mt-[20vh] min-h-[180px] bg-nh-bg/95 backdrop-blur-md p-4 border-t border-nh-border rounded-b-2xl">
          <h3 className="text-sm font-bold text-white mb-3 font-heading">
            Weather & Alerts · {neighbourhoodName}
          </h3>

          {/* Weather detail */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="rounded-xl bg-nh-surface p-3 text-center">
              <div className="text-lg mb-1">{getWeatherEmoji(weather?.condition ?? 'unknown')}</div>
              <div className="text-lg font-bold text-white">{weather?.temp != null ? `${weather.temp}°` : '--°'}</div>
              <div className="text-[10px] text-nh-text-secondary">{weather?.condition ?? 'N/A'}</div>
            </div>
            <div className="rounded-xl bg-nh-surface p-3 text-center">
              <div className="text-lg mb-1">💧</div>
              <div className="text-lg font-bold text-white">{weather?.humidity != null ? `${weather.humidity}%` : '--%'}</div>
              <div className="text-[10px] text-nh-text-secondary">Humidity</div>
            </div>
            <div className="rounded-xl bg-nh-surface p-3 text-center">
              <div className="text-lg mb-1">💨</div>
              <div className="text-lg font-bold text-white">{weather?.windSpeed != null ? `${weather.windSpeed} km/h` : '--'}</div>
              <div className="text-[10px] text-nh-text-secondary">Wind</div>
            </div>
          </div>

          {/* All alerts */}
          {alerts && alerts.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-nh-text-secondary mb-2 uppercase tracking-wider">Active Alerts</h4>
              <div className="space-y-2">
                {alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`rounded-xl p-3 border ${getSeverityBadge(alert.severity)}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider">
                        {getSeverityLabel(alert.severity)}
                      </span>
                      {alert.location && (
                        <span className="text-[10px] opacity-60">· {alert.location}</span>
                      )}
                    </div>
                    <div className="text-xs font-semibold text-white">{alert.title}</div>
                    {alert.description && (
                      <div className="text-[11px] text-white/60 mt-1">{alert.description}</div>
                    )}
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