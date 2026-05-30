import { useState, useRef, useEffect, useCallback } from 'react'
import { useAuthStore } from '../../store/authStore'
import { StatusBar } from '../../components/ui/phone/StatusBar'
import { BottomNav, NavIcons } from '../../components/ui/phone/BottomNav'
import StoriesRow from '../../components/social/StoriesRow'
import PostCard from '../../components/social/PostCard'
import CreatePostModal from '../../components/social/CreatePostModal'
import FeedFilters from '../../components/social/FeedFilters'
import { useFeedPostsInfinite, type FeedQueryParams, type FeedPost } from '../../services/socialFeedApi'

const PILL_TABS = [
  { key: 'general' as const, label: 'General' },
  { key: 'business' as const, label: 'Business' },
]

/**
 * ExplorerPage — Social feed with General/Business sub-tabs.
 * Uses the /api/social/posts/feed endpoint via TanStack Query.
 */
export default function Explore() {
  const { user } = useAuthStore()
  const [activeTab, setActiveTab] = useState<'general' | 'business'>('general')
  const [sort, setSort] = useState<'recent' | 'popular'>('recent')
  const [showCreatePost, setShowCreatePost] = useState(false)

  // Feed filter state
  const [followingOnly, setFollowingOnly] = useState(false)
  const [city, setCity] = useState('')
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | undefined>(undefined)

  const params: Omit<FeedQueryParams, 'page'> = {
    pageSize: 10,
    sort: sort,
    businessOnly: activeTab === 'business',
    followingOnly: followingOnly || undefined,
    city: city || undefined,
    categoryId: selectedCategoryId,
  }

  const {
    data,
    isLoading,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useFeedPostsInfinite(params)

  const posts: FeedPost[] = data?.pages.flatMap((p) => p.data) ?? []

  // Infinite scroll — IntersectionObserver on sentinel
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage()
        }
      },
      { threshold: 0.1 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  // Pull-to-refresh state
  const [refreshing, setRefreshing] = useState(false)
  const [pullStartY, setPullStartY] = useState(0)
  const [pullDistance, setPullDistance] = useState(0)
  const feedRef = useRef<HTMLDivElement>(null)

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (feedRef.current && feedRef.current.scrollTop <= 0) {
      setPullStartY(e.touches[0].clientY)
    }
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (pullStartY && feedRef.current && feedRef.current.scrollTop <= 0) {
      const dist = Math.max(0, (e.touches[0].clientY - pullStartY) * 0.4)
      setPullDistance(dist)
    }
  }, [pullStartY])

  const handleTouchEnd = useCallback(async () => {
    if (pullDistance > 60) {
      setRefreshing(true)
      setPullDistance(0)
      setPullStartY(0)
      await refetch()
      setRefreshing(false)
    } else {
      setPullDistance(0)
      setPullStartY(0)
    }
  }, [pullDistance, refetch])

  // Blog skeleton cards matching real PostCard structure
  const SkeletonCard = () => (
    <div className="bg-nh-surface rounded-2xl mx-[14px] mt-3 border border-nh-border overflow-hidden animate-pulse">
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <div className="w-10 h-10 rounded-xl bg-nh-border-elevated shrink-0" />
        <div className="flex-1">
          <div className="h-3 w-[55%] bg-nh-border-elevated rounded mb-1.5" />
          <div className="h-2.5 w-[35%] bg-nh-border-elevated rounded" />
        </div>
      </div>
      <div className="w-full bg-nh-border-elevated" style={{ aspectRatio: '4/3' }} />
      <div className="px-3 py-2.5">
        <div className="h-3 w-[80%] bg-nh-border-elevated rounded mb-1.5" />
        <div className="h-3 w-[60%] bg-nh-border-elevated rounded" />
      </div>
    </div>
  )

  const LoadingMore = () => (
    <div className="py-4 text-center">
      <div className="inline-block w-5 h-5 border-2 border-nh-primary border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="relative h-full flex flex-col bg-nh-bg">
      <StatusBar title="9:41" showNotifDot />

      {/* Tabs: General | Business */}
      <div className="flex bg-nh-bg border-b border-nh-border">
        {PILL_TABS.map((tab) => {
          const active = activeTab === tab.key
          return (
            <div
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-[14px] text-center text-sm font-medium cursor-pointer transition-all duration-200 border-b-[2.5px] ${
                active
                  ? 'text-nh-primary border-b-nh-primary'
                  : 'text-nh-text-muted border-b-transparent'
              }`}
            >
              {tab.label}
            </div>
          )
        })}
      </div>

      {/* Location bar */}
      <div className="px-[14px] pt-2 flex items-center">
        <svg width="16" height="16" viewBox="0 0 24 24" className="fill-nh-primary">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
        </svg>
        <span className="text-[13px] font-semibold text-nh-primary ml-1.5 flex-1">
          Nearby
        </span>
      </div>

      {/* Feed Filters (Following, City, Interest chips) */}
      <FeedFilters
        followingOnly={followingOnly}
        onFollowingChange={setFollowingOnly}
        city={city}
        onCityChange={setCity}
        categoryId={selectedCategoryId}
        onCategoryChange={setSelectedCategoryId}
        isAuthenticated={!!user}
      />

      {/* Search + Sort Filter */}
      <ExploreSearchBox />
      <div className="px-[14px] pt-1 flex gap-2 items-center">
        {/* Sort toggle */}
        <div
          onClick={() => setSort(sort === 'recent' ? 'popular' : 'recent')}
          className="bg-nh-surface rounded-[10px] border border-nh-border px-3 py-2.5 text-[11px] font-semibold text-nh-text-secondary cursor-pointer whitespace-nowrap"
        >
          {sort === 'recent' ? '🔥 Popular' : '🕐 Recent'}
        </div>
      </div>

      {/* Stories Row */}
      <StoriesRow onAddStory={() => setShowCreatePost(true)} />

      {/* FAB - Create Post */}
      <div
        onClick={() => setShowCreatePost(true)}
        className="absolute bottom-[110px] right-5 z-40 w-12 h-12 rounded-full flex items-center justify-center cursor-pointer text-2xl text-white shadow-lg"
        style={{ background: 'linear-gradient(135deg, var(--nh-primary), var(--nh-accent))' }}
        title="Create Post"
      >
        +
      </div>

      {/* Pull-to-refresh indicator */}
      {pullDistance > 0 && (
        <div
          className="flex items-center justify-center transition-all"
          style={{ height: Math.min(pullDistance, 80), opacity: Math.min(pullDistance / 60, 1) }}
        >
          <div className={`w-6 h-6 border-2 border-nh-primary border-t-transparent rounded-full ${pullDistance > 60 ? 'animate-spin' : ''}`} />
        </div>
      )}

      {/* Refreshing banner */}
      {refreshing && (
        <div className="flex items-center justify-center py-3 bg-nh-surface border-b border-nh-border">
          <div className="w-4 h-4 border-2 border-nh-primary border-t-transparent rounded-full animate-spin mr-2" />
          <span className="text-xs text-nh-text-muted">Refreshing...</span>
        </div>
      )}

      {/* Posts Feed */}
      <div
        ref={feedRef}
        className="flex-1 overflow-auto"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {isLoading && (
          <div className="py-5">
            {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
          </div>
        )}

        {error && (
          <div className="px-[14px] py-10 text-center">
            <div className="text-[48px] mb-3">😕</div>
            <div className="text-sm text-nh-text-muted mb-1">
              Could not load feed
            </div>
            <div className="text-xs text-nh-text-muted mb-3">
              Check your connection and try again
            </div>
            <div
              onClick={() => refetch()}
              className="inline-block bg-nh-primary text-white rounded-lg px-5 py-2 text-[13px] font-semibold cursor-pointer hover:opacity-90"
            >
              Retry
            </div>
          </div>
        )}

        {!isLoading && !error && posts.length === 0 && (
          <div className="px-[14px] py-10 text-center">
            <div className="text-[48px] mb-3">📍</div>
            <div className="text-sm font-semibold text-nh-text-secondary mb-1">
              No content in your area
            </div>
            <div className="text-xs text-nh-text-muted mb-3">
              {city ? `No posts found in "${city}". Try a different city or explore all areas.` : 'Be the first to create a post in your neighbourhood!'}
            </div>
            {city && (
              <div
                onClick={() => setCity('')}
                className="inline-block bg-nh-surface border border-nh-border text-nh-text-secondary rounded-lg px-4 py-1.5 text-[12px] font-medium cursor-pointer hover:bg-nh-surface-elevated"
              >
                Clear Location Filter
              </div>
            )}
          </div>
        )}

        {!isLoading && !error && posts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}

        {/* Infinite scroll sentinel & loading indicator */}
        <div ref={sentinelRef} className="h-1" />

        {isFetchingNextPage && (
          <LoadingMore />
        )}

        {!hasNextPage && posts.length > 0 && (
          <div className="py-5 text-center text-nh-text-muted text-[11px]">
            — You're all caught up —
          </div>
        )}

        <div className="h-20" />
      </div>

      {/* Floating Bottom Nav */}
      <BottomNav
        items={[
          { id: 'home', label: 'Home', icon: NavIcons.home },
          { id: 'social', label: 'Explorer', active: true, icon: NavIcons.social },
          { id: 'activity', label: 'Activity', icon: NavIcons.activity },
          { id: 'biz', label: 'Business', isBiz: true, icon: NavIcons.business },
        ]}
      />

      {/* Create Post Modal */}
      {showCreatePost && (
        <CreatePostModal
          onClose={() => setShowCreatePost(false)}
          onSuccess={() => refetch()}
        />
      )}
    </div>
  )
}

/** Functional search box for Explore page — searches services via /api/services/search */
function ExploreSearchBox() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (query.length < 2) {
      setResults([])
      setShowDropdown(false)
      return
    }
    setLoading(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/services/search?q=${encodeURIComponent(query)}&limit=8`)
        const json = await res.json()
        setResults(json?.data?.services ?? [])
        setShowDropdown(true)
      } catch { /* ignore */ }
      finally { setLoading(false) }
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query])

  // Click outside to close
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSelect = useCallback((service: any) => {
    setShowDropdown(false)
    setQuery('')
    window.location.href = `/order/new?serviceId=${service.id}`
  }, [])

  return (
    <div ref={wrapperRef} className="relative px-[10px] sm:px-[14px] pt-2">
      <div className="flex-1 bg-nh-surface rounded-[10px] px-[12px] sm:px-[14px] py-2 sm:py-2.5 flex items-center gap-2 border border-nh-border">
        <svg width="14" height="14" viewBox="0 0 24 24" className="fill-nh-text-muted flex-shrink-0">
          <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search services..."
          className="flex-1 bg-transparent text-[12px] sm:text-[13px] text-nh-text placeholder-nh-text-muted outline-none min-w-0"
        />
        {loading && (
          <div className="w-3 h-3 sm:w-3.5 sm:h-3.5 border-2 border-nh-primary border-t-transparent rounded-full animate-spin flex-shrink-0" />
        )}
      </div>

      {/* Results dropdown */}
      {showDropdown && results.length > 0 && (
        <div className="absolute z-50 left-[10px] right-[10px] sm:left-[14px] sm:right-[14px] mt-1 rounded-xl border border-nh-border bg-nh-surface shadow-2xl max-h-[40vh] overflow-y-auto">
          {results.map((svc: any) => (
            <button
              key={svc.id}
              onClick={() => handleSelect(svc)}
              className="w-full flex items-center gap-2 sm:gap-3 px-2.5 sm:px-3 py-2 sm:py-2.5 text-left hover:bg-nh-surface-elevated transition-colors"
            >
              <span className="text-base sm:text-lg flex-shrink-0">🔧</span>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] sm:text-[13px] font-medium text-nh-text truncate">{svc.name}</div>
                <div className="text-[10px] sm:text-[11px] text-nh-text-secondary truncate">{svc.categoryName ?? svc.breadcrumb?.[0] ?? 'Service'}</div>
              </div>
              <span className="text-[10px] sm:text-[11px] text-nh-primary font-medium flex-shrink-0">Order →</span>
            </button>
          ))}
        </div>
      )}

      {showDropdown && query.length >= 2 && results.length === 0 && !loading && (
        <div className="absolute z-50 left-[10px] right-[10px] sm:left-[14px] sm:right-[14px] mt-1 rounded-xl border border-nh-border bg-nh-surface shadow-2xl p-4 sm:p-6 text-center">
          <div className="text-xl sm:text-2xl mb-1.5 sm:mb-2">🔍</div>
          <p className="text-[12px] sm:text-[13px] text-nh-text-secondary">No services found for "{query}"</p>
        </div>
      )}
    </div>
  )
}
