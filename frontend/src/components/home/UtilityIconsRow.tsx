import { useState } from 'react'
import { useUtilityLinks, useTrackUtilityClick } from '../../services/homeContentApi.js'
import type { UtilityLink } from '../../services/homeContentApi.js'

const UTILITY_CATEGORIES = [
  { key: 'banks', label: 'Banks', icon: '🏦' },
  { key: 'insurance', label: 'Insurance', icon: '🛡️' },
  { key: 'fuel', label: 'Fuel', icon: '⛽' },
  { key: 'government', label: 'Government', icon: '🏛️' },
  { key: 'health', label: 'Health', icon: '🏥' },
  { key: 'transit', label: 'Transit', icon: '🚌' },
] as const

export default function UtilityIconsRow() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const { data: links, isLoading } = useUtilityLinks(selectedCategory ?? undefined)
  const trackClick = useTrackUtilityClick()

  const handleCategoryTap = (category: string) => {
    setSelectedCategory((prev) => (prev === category ? null : category))
  }

  const handleLinkClick = (link: UtilityLink) => {
    trackClick.mutate(link.id)
    window.open(link.url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="space-y-3">
      {/* Icon row */}
      <div className="flex gap-3 overflow-x-auto scrollbar-none pb-1">
        {UTILITY_CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            onClick={() => handleCategoryTap(cat.key)}
            className={`flex flex-col items-center gap-1.5 flex-shrink-0 transition-all duration-200 min-w-[52px] ${
              selectedCategory === cat.key ? 'scale-105' : ''
            }`}
          >
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl transition-all duration-200 ${
                selectedCategory === cat.key
                  ? 'bg-nh-primary shadow-lg shadow-nh-primary/30'
                  : 'bg-nh-surface border border-nh-border hover:border-nh-border-elevated'
              }`}
            >
              {cat.icon}
            </div>
            <span
              className={`text-[10px] font-medium text-center leading-tight ${
                selectedCategory === cat.key ? 'text-nh-primary' : 'text-nh-text-secondary'
              }`}
            >
              {cat.label}
            </span>
          </button>
        ))}
      </div>

      {/* Expanded filtered list */}
      {selectedCategory && (
        <div className="rounded-2xl border border-nh-border bg-nh-surface p-3 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold text-nh-text uppercase tracking-wider">
              {UTILITY_CATEGORIES.find((c) => c.key === selectedCategory)?.label} Links
            </h4>
            <button
              onClick={() => setSelectedCategory(null)}
              className="text-[10px] text-nh-text-secondary hover:text-white transition-colors"
            >
              Close
            </button>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 rounded-xl bg-nh-surface-elevated animate-pulse" />
              ))}
            </div>
          ) : links && links.length > 0 ? (
            <div className="space-y-1.5">
              {links.map((link) => (
                <button
                  key={link.id}
                  onClick={() => handleLinkClick(link)}
                  className="w-full flex items-center gap-3 rounded-xl p-2.5 text-left transition-all hover:bg-nh-surface-elevated group"
                >
                  {link.iconUrl ? (
                    <img
                      src={link.iconUrl}
                      alt={link.title}
                      className="w-7 h-7 rounded-lg object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-lg bg-nh-surface-elevated flex items-center justify-center flex-shrink-0 text-xs">
                      {UTILITY_CATEGORIES.find((c) => c.key === selectedCategory)?.icon ?? '🔗'}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-nh-text group-hover:text-white transition-colors truncate">
                      {link.title}
                    </div>
                    {link.description && (
                      <div className="text-[10px] text-nh-text-secondary truncate mt-0.5">{link.description}</div>
                    )}
                  </div>
                  <svg
                    className="w-3.5 h-3.5 text-nh-text-muted group-hover:text-nh-primary transition-colors flex-shrink-0"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M7 17L17 7M17 7H7M17 7V17" />
                  </svg>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-xs text-nh-text-secondary">No links available for this category yet.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}