import { useState, useCallback, useRef, useEffect } from 'react'
import { useHomeSearch } from '../../services/homeContentApi.js'

interface SearchResult {
  id: string
  type: 'service' | 'business' | 'category' | 'skill'
  title: string
  subtitle: string | null
  imageUrl: string | null
  rating?: number
  price?: number
  distance?: number
  availableNow?: boolean
}

const TYPE_ICONS: Record<string, string> = {
  service: '🔧',
  business: '🏢',
  category: '📂',
  skill: '🎯',
}

const TYPE_LABELS: Record<string, string> = {
  service: 'Service',
  business: 'Business',
  category: 'Category',
  skill: 'Skill',
}

const FILTER_OPTIONS = [
  { key: 'distance', label: 'Distance' },
  { key: 'rating', label: 'Rating' },
  { key: 'price', label: 'Price' },
  { key: 'available', label: 'Available Now' },
] as const

export default function SearchBox() {
  const [query, setQuery] = useState('')
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set())
  const [showResults, setShowResults] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const { data: results, isLoading } = useHomeSearch(query)

  const toggleFilter = useCallback((filter: string) => {
    setActiveFilters((prev) => {
      const next = new Set(prev)
      if (next.has(filter)) next.delete(filter)
      else next.add(filter)
      return next
    })
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowResults(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleFocus = () => {
    if (query.length >= 2) setShowResults(true)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setQuery(value)
    setShowResults(value.length >= 2)
  }

  const handleResultClick = (result: SearchResult) => {
    setShowResults(false)
    setQuery('')
    switch (result.type) {
      case 'service':
        window.location.href = `/order/new?serviceId=${result.id}`
        break
      case 'category':
        window.location.href = `/explore?category=${result.id}`
        break
      case 'business':
        window.location.href = `/business/${result.id}`
        break
      case 'skill':
      default:
        window.location.href = `/order/new?serviceId=${result.id}`
        break
    }
  }

  return (
    <div className="relative w-full" ref={wrapperRef}>
      {/* Search input */}
      <div className="rounded-2xl border border-nh-border bg-nh-surface p-3 sm:p-4 shadow-lg">
        <div className="flex items-center gap-2 sm:gap-3 bg-nh-bg rounded-xl px-3 sm:px-4 py-2.5 sm:py-3.5 border border-nh-border transition-all focus-within:border-nh-primary">
          <svg
            className="w-4 h-4 sm:w-5 sm:h-5 text-nh-text-muted flex-shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleChange}
            onFocus={handleFocus}
            placeholder="Search services, businesses, skills near you..."
            className="flex-1 bg-transparent text-[13px] sm:text-sm text-nh-text placeholder-nh-text-muted outline-none"
          />
          {query && (
            <button
              onClick={() => {
                setQuery('')
                setShowResults(false)
                inputRef.current?.focus()
              }}
              className="text-nh-text-muted hover:text-nh-text transition-colors"
            >
              <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Filter chips */}
        <div className="flex gap-1.5 sm:gap-2 mt-2 sm:mt-3 overflow-x-auto scrollbar-none pb-0.5">
          {FILTER_OPTIONS.map((filter) => {
            const isActive = activeFilters.has(filter.key)
            return (
              <button
                key={filter.key}
                onClick={() => toggleFilter(filter.key)}
                className={`flex-shrink-0 rounded-full px-2.5 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-[11px] font-medium transition-all ${
                  isActive
                    ? 'bg-nh-primary text-white border border-nh-primary'
                    : 'border border-nh-border text-nh-text-secondary hover:border-nh-border-elevated hover:text-nh-text'
                }`}
              >
                {filter.label}
                {filter.key === 'available' && isActive && (
                  <span className="ml-1 text-emerald-400">●</span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Results dropdown */}
      {showResults && (
        <div className="absolute z-50 left-0 right-0 mt-1.5 sm:mt-2 rounded-2xl border border-nh-border bg-nh-surface shadow-2xl max-h-[45vh] sm:max-h-[50vh] overflow-y-auto">
          {isLoading ? (
            <div className="p-3 sm:p-4 space-y-2 sm:space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-2 sm:gap-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-nh-surface-elevated animate-pulse" />
                  <div className="flex-1 space-y-1.5 sm:space-y-2">
                    <div className="h-2.5 sm:h-3 w-2/3 bg-nh-surface-elevated rounded animate-pulse" />
                    <div className="h-2 sm:h-2.5 w-1/2 bg-nh-surface-elevated rounded animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : results && results.length > 0 ? (
            <div className="p-1.5 sm:p-2">
              {results.map((result) => (
                <button
                  key={result.id}
                  onClick={() => handleResultClick(result)}
                  className="w-full flex items-center gap-2 sm:gap-3 rounded-xl p-2.5 sm:p-3 text-left transition-all hover:bg-nh-surface-elevated"
                >
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-nh-surface-elevated flex items-center justify-center text-base sm:text-lg flex-shrink-0">
                    {result.imageUrl ? (
                      <img src={result.imageUrl} alt="" className="w-full h-full rounded-xl object-cover" />
                    ) : (
                      TYPE_ICONS[result.type] ?? '📋'
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <span className="text-[13px] sm:text-sm font-medium text-nh-text truncate">{result.title}</span>
                      <span className="text-[9px] sm:text-[10px] text-nh-text-muted flex-shrink-0">
                        {TYPE_LABELS[result.type] ?? result.type}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2 mt-0.5">
                      {result.subtitle && (
                        <span className="text-[10px] sm:text-[11px] text-nh-text-secondary truncate">{result.subtitle}</span>
                      )}
                      {result.rating != null && (
                        <span className="flex items-center gap-0.5 text-[9px] sm:text-[10px] text-amber-400">
                          ★ {result.rating.toFixed(1)}
                        </span>
                      )}
                      {result.price != null && (
                        <span className="text-[9px] sm:text-[10px] text-emerald-400">${result.price}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2 mt-1">
                      {result.distance != null && (
                        <span className="text-[9px] sm:text-[10px] text-nh-text-muted">{result.distance.toFixed(1)} km</span>
                      )}
                      {result.availableNow && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] sm:text-[10px] text-emerald-400">
                          <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-emerald-400" /> Available
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : query.length >= 2 ? (
            <div className="p-6 sm:p-8 text-center">
              <div className="text-2xl sm:text-3xl mb-2 sm:mb-3">🔍</div>
              <p className="text-[13px] sm:text-sm text-nh-text-secondary">No results for "{query}"</p>
              <p className="text-[10px] sm:text-[11px] text-nh-text-muted mt-1">Try a different search term</p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}