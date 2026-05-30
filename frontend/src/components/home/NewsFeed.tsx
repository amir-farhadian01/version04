import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useHomeNews } from '../../services/homeContentApi.js'

const CATEGORY_TABS = [
  { key: 'sports', label: 'Sports', icon: '⚽', color: 'bg-blue-500/15 text-blue-400' },
  { key: 'community', label: 'Community', icon: '🤝', color: 'bg-emerald-500/15 text-emerald-400' },
  { key: 'events', label: 'Events', icon: '🎉', color: 'bg-purple-500/15 text-purple-400' },
  { key: 'city', label: 'City', icon: '🏙️', color: 'bg-amber-500/15 text-amber-400' },
  { key: 'promotions', label: 'Promotions', icon: '💸', color: 'bg-pink-500/15 text-pink-400' },
] as const

function formatPublishedDate(dateStr: string | null): string {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

export default function NewsFeed() {
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const { data, isLoading } = useHomeNews({
    category: activeCategory === 'all' ? undefined : activeCategory,
    pageSize: 10,
  })
  const navigate = useNavigate()

  const articles = data?.data ?? []

  return (
    <div className="space-y-3">
      {/* Category tabs */}
      <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
        <button
          onClick={() => setActiveCategory('all')}
          className={`flex-shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold transition-all ${
            activeCategory === 'all'
              ? 'bg-nh-primary text-white'
              : 'border border-nh-border text-nh-text-secondary hover:border-nh-border-elevated hover:text-white'
          }`}
        >
          All
        </button>
        {CATEGORY_TABS.map((cat) => (
          <button
            key={cat.key}
            onClick={() => setActiveCategory(cat.key)}
            className={`flex-shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold transition-all ${
              activeCategory === cat.key
                ? `${cat.color} ring-1 ring-current/20`
                : 'border border-nh-border text-nh-text-secondary hover:border-nh-border-elevated hover:text-white'
            }`}
          >
            <span className="text-xs">{cat.icon}</span>
            {cat.label}
          </button>
        ))}
      </div>

      {/* Content area */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl border border-nh-border bg-nh-surface p-4 animate-pulse">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-16 h-3 bg-nh-surface-elevated rounded" />
                <div className="w-8 h-3 bg-nh-surface-elevated rounded" />
              </div>
              <div className="w-3/4 h-4 bg-nh-surface-elevated rounded mb-2" />
              <div className="w-full h-3 bg-nh-surface-elevated rounded" />
            </div>
          ))}
        </div>
      ) : articles.length > 0 ? (
        <div className="space-y-3">
          {articles.map((article) => {
            const catInfo = CATEGORY_TABS.find((c) => c.key === article.category)
            return (
              <div
                key={article.id}
                onClick={() => navigate(`/home/news/${article.id}`)}
                className="rounded-2xl border border-nh-border bg-nh-surface overflow-hidden cursor-pointer transition-all hover:border-nh-border-elevated hover:translate-y-[-2px] shadow-sm hover:shadow-md"
              >
                {article.imageUrl && (
                  <div className="relative h-32 overflow-hidden">
                    <img
                      src={article.imageUrl}
                      alt={article.title}
                      className="w-full h-full object-cover"
                    />
                    {article.isFeatured && (
                      <div className="absolute top-3 left-3 rounded-full bg-nh-primary px-2.5 py-0.5 text-[10px] font-bold text-white">
                        Featured
                      </div>
                    )}
                  </div>
                )}

                <div className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          catInfo?.color ?? 'bg-nh-surface-elevated text-nh-text-secondary'
                        }`}
                    >
                      {catInfo?.icon ?? '📄'} {catInfo?.label ?? article.category}
                    </span>
                    {article.isFeatured && !article.imageUrl && (
                      <span className="rounded-full bg-nh-primary/15 text-nh-primary px-2 py-0.5 text-[10px] font-bold">
                        Featured
                      </span>
                    )}
                    <span className="text-[10px] text-nh-text-muted ml-auto">
                      {formatPublishedDate(article.publishedAt)}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-nh-text leading-snug mb-1.5 font-heading">
                    {article.title}
                  </h3>

                  {article.summary && (
                    <p className="text-xs text-nh-text-secondary line-clamp-2 leading-relaxed">
                      {article.summary}
                    </p>
                  )}

                  {/* Swipe action hint */}
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-nh-border">
                    <span className="text-[10px] text-nh-text-muted">Tap to read more</span>
                    <svg
                      className="w-3.5 h-3.5 text-nh-text-muted"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-nh-border bg-nh-surface p-8 text-center">
          <div className="text-3xl mb-3">📰</div>
          <p className="text-sm text-nh-text-secondary">No news articles yet</p>
          <p className="text-[11px] text-nh-text-muted mt-1">Check back later for local updates</p>
        </div>
      )}
    </div>
  )
}