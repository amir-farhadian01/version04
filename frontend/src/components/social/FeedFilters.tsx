import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../../lib/api'
import { NHBadge } from '../ui/NHBadge'

interface CategoryChip {
  id: string
  name: string
}

interface FeedFiltersProps {
  followingOnly: boolean
  onFollowingChange: (v: boolean) => void
  city: string
  onCityChange: (v: string) => void
  categoryId: string | undefined
  onCategoryChange: (id: string | undefined) => void
  isAuthenticated: boolean
}

/**
 * FeedFilters — Horizontal filter bar for the Explorer feed.
 * Provides Following toggle, city search, and interest chips.
 */
export default function FeedFilters({
  followingOnly,
  onFollowingChange,
  city,
  onCityChange,
  categoryId,
  onCategoryChange,
  isAuthenticated,
}: FeedFiltersProps) {
  const [cityInput, setCityInput] = useState(city)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync external city value back to input
  useEffect(() => {
    setCityInput(city)
  }, [city])

  const handleCityChange = useCallback(
    (value: string) => {
      setCityInput(value)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        onCityChange(value.trim())
      }, 400)
    },
    [onCityChange],
  )

  // Fetch top-level categories for interest chips
  const { data: categories } = useQuery<CategoryChip[]>({
    queryKey: ['categories', 'root'],
    queryFn: async () => {
      const { data } = await api.get<CategoryChip[]>('/categories', {
        params: { parentId: 'null' },
      })
      return data
    },
    staleTime: 5 * 60 * 1000,
  })

  const visibleCategories = (categories ?? []).slice(0, 12)

  return (
    <div className="px-[14px] pt-2.5 pb-1.5 space-y-2">
      {/* Row 1: Following toggle + City input */}
      <div className="flex items-center gap-2">
        {isAuthenticated && (
          <div
            onClick={() => onFollowingChange(!followingOnly)}
            className={`flex-shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold cursor-pointer select-none transition-colors duration-150 border ${
              followingOnly
                ? 'bg-nh-primary text-white border-nh-primary'
                : 'bg-nh-surface text-nh-text-secondary border-nh-border'
            }`}
          >
            {followingOnly ? '✓ Following' : 'Following'}
          </div>
        )}

        <div className="flex-1 bg-nh-surface rounded-full px-3 py-1.5 flex items-center gap-1.5 border border-nh-border">
          <svg width="12" height="12" viewBox="0 0 24 24" className="fill-nh-text-muted flex-shrink-0">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
          </svg>
          <input
            type="text"
            value={cityInput}
            onChange={(e) => handleCityChange(e.target.value)}
            placeholder="City..."
            className="flex-1 bg-transparent text-[12px] text-nh-text placeholder:text-nh-text-muted outline-none border-none p-0"
          />
          {cityInput && (
            <div
              onClick={() => {
                setCityInput('')
                onCityChange('')
              }}
              className="text-nh-text-muted cursor-pointer text-sm leading-none px-0.5"
            >
              ✕
            </div>
          )}
        </div>
      </div>

      {/* Row 2: Interest chips (horizontal scroll) */}
      {visibleCategories.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1 -mx-[14px] px-[14px]">
          {visibleCategories.map((cat) => {
            const active = categoryId === cat.id
            return (
              <div
                key={cat.id}
                onClick={() => onCategoryChange(active ? undefined : cat.id)}
                className="flex-shrink-0 cursor-pointer select-none"
              >
                <NHBadge
                  variant="category"
                  label={cat.name}
                  className={
                    active
                      ? 'bg-nh-primary/15 text-nh-primary border border-nh-primary/30'
                      : ''
                  }
                />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}