import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import api from '../../lib/api'
import type { HomeNewsArticle } from '../../services/homeContentApi.js'

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const CATEGORY_LABELS: Record<string, string> = {
  sports: 'Sports',
  community: 'Community',
  events: 'Events',
  city: 'City',
  promotions: 'Promotions',
}

export default function NewsArticlePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: article, isLoading, isError } = useQuery({
    queryKey: ['home', 'news', id],
    queryFn: async () => {
      const { data } = await api.get<{ data: HomeNewsArticle }>(`/home/news/${id}`)
      return data.data
    },
    enabled: !!id,
  })

  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen bg-nh-bg">
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-nh-border border-t-nh-primary" />
        </div>
      </div>
    )
  }

  if (isError || !article) {
    return (
      <div className="flex flex-col min-h-screen bg-nh-bg">
        <div className="px-4 py-3 border-b border-nh-border">
          <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-nh-text-secondary hover:text-nh-text transition-colors">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
            <div className="text-3xl mb-3">📰</div>
            <p className="text-sm text-nh-text-secondary">Article not found</p>
            <button onClick={() => navigate('/')} className="mt-4 rounded-xl bg-nh-primary px-4 py-2 text-xs font-bold text-white transition-all hover:bg-nh-primary-hover">
              Go Home
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-nh-bg">
      {/* Back navigation */}
      <div className="sticky top-0 z-40 bg-nh-bg/90 backdrop-blur-lg border-b border-nh-border px-4 py-3">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-nh-text-secondary hover:text-nh-text transition-colors">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back
        </button>
      </div>

      {/* Article content */}
      <div className="flex-1 overflow-auto pb-20">
        {/* Hero image */}
        {article.imageUrl && (
          <div className="relative h-48 sm:h-64 overflow-hidden">
            <img src={article.imageUrl} alt={article.title} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-nh-bg to-transparent" />
          </div>
        )}

        <div className="px-4 pt-4 sm:px-6 sm:max-w-3xl sm:mx-auto">
          {/* Badges */}
          <div className="flex items-center gap-2 mb-3">
            <span className="rounded-full bg-nh-surface-elevated px-2.5 py-0.5 text-[10px] font-medium text-nh-text-secondary">
              {CATEGORY_LABELS[article.category] ?? article.category}
            </span>
            {article.isFeatured && (
              <span className="rounded-full bg-nh-primary/15 text-nh-primary px-2.5 py-0.5 text-[10px] font-bold">
                Featured
              </span>
            )}
          </div>

          {/* Title */}
          <h1 className="text-xl sm:text-2xl font-black text-nh-text mb-3 font-heading">
            {article.title}
          </h1>

          {/* Published date */}
          {article.publishedAt && (
            <p className="text-xs text-nh-text-muted mb-6">
              Published {formatDate(article.publishedAt)}
            </p>
          )}

          {/* Summary */}
          {article.summary && (
            <div className="rounded-2xl border border-nh-border bg-nh-surface-elevated p-4 mb-6">
              <p className="text-sm text-nh-text-secondary leading-relaxed italic">
                {article.summary}
              </p>
            </div>
          )}

          {/* Body */}
          <div className="prose prose-invert prose-sm max-w-none">
            <p className="text-sm text-nh-text-secondary leading-relaxed whitespace-pre-wrap">
              {article.body}
            </p>
          </div>

          {/* Footer spacing */}
          <div className="h-12" />
        </div>
      </div>
    </div>
  )
}