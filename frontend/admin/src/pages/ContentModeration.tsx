import { useState, useEffect } from 'react'
import api from '../lib/api'
import {
  Search, RefreshCw, CheckCircle, XCircle, AlertTriangle,
  MessageSquare, User, FileText, Eye, ShieldAlert
} from 'lucide-react'

type ModerationStatus = 'APPROVED' | 'PENDING' | 'FLAGGED' | 'REMOVED' | 'WARNED'

interface PostForModeration {
  id: string
  caption: string | null
  moderationStatus: ModerationStatus
  moderationReasons: string[]
  flagCount: number
  isBusinessPost: boolean
  publishedAt: string | null
  createdAt: string
  author: {
    id: string
    displayName: string | null
    email: string
    avatarUrl: string | null
  }
  category: { id: string; name: string } | null
  _count: { likes: number; comments: number; saves: number }
  media: { id: string; url: string; type: string }[]
}

interface ModerationResponse {
  data: PostForModeration[]
  total: number
  page: number
  pageSize: number
}

const STATUS_COLORS: Record<string, string> = {
  APPROVED: 'bg-nh-admin-success-bg text-nh-admin-success',
  PENDING: 'bg-nh-admin-warning-bg text-nh-admin-warning',
  FLAGGED: 'bg-nh-admin-danger-bg text-nh-admin-danger',
  REMOVED: 'bg-nh-admin-border text-nh-admin-text-secondary',
  WARNED: 'bg-nh-admin-amber-bg text-nh-admin-amber',
}

function statusBadge(status: string) {
  const color = STATUS_COLORS[status] ?? 'bg-nh-admin-border text-nh-admin-text-secondary'
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${color}`}>
      {status}
    </span>
  )
}

export default function ContentModeration() {
  const [posts, setPosts] = useState<PostForModeration[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('ALL')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const pageSize = 20

  const fetchPosts = async (p = page) => {
    setLoading(true)
    setError(null)
    try {
      const params: Record<string, string> = { page: String(p), pageSize: String(pageSize) }
      if (filterStatus !== 'ALL') params.moderationStatus = filterStatus
      if (search) params.search = search
      const res = await api.get<ModerationResponse>('/admin/content-moderation/posts', { params })
      setPosts(res.data.data ?? [])
      setTotal(res.data.total ?? 0)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load posts'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPosts(1)
    setPage(1)
  }, [filterStatus, search])

  const handleAction = async (id: string, action: string) => {
    try {
      await api.post(`/admin/content-moderation/posts/${id}/${action}`)
      await fetchPosts(page)
    } catch (err) {
      alert(`Failed to ${action} post`)
    }
  }

  const handleBulkAction = async (action: string) => {
    const flagged = posts.filter((p) => p.moderationStatus === 'FLAGGED' || p.flagCount > 0)
    if (flagged.length === 0) {
      alert('No flagged posts to act on')
      return
    }
    for (const p of flagged) {
      await handleAction(p.id, action)
    }
  }

  const totalPages = Math.ceil(total / pageSize)

  const FILTER_OPTIONS = ['ALL', 'PENDING', 'FLAGGED', 'APPROVED', 'REMOVED', 'WARNED']

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black text-nh-admin-text">
            Content Moderation
          </h1>
          <p className="mt-1 text-sm text-nh-admin-text-secondary">Review and moderate social posts</p>
        </div>
        <button
          onClick={() => fetchPosts(page)}
          className="flex items-center gap-2 rounded-xl border border-nh-admin-border bg-nh-admin-surface px-4 py-2 text-sm text-nh-admin-text transition-all hover:border-nh-admin-primary"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-nh-admin-text-muted" />
          <input
            type="text"
            placeholder="Search posts by caption, author..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-nh-admin-border bg-nh-admin-surface py-2.5 pl-10 pr-4 text-sm text-nh-admin-text placeholder-nh-admin-text-muted outline-none transition-all focus:border-nh-admin-primary-border"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="rounded-xl border border-nh-admin-border bg-nh-admin-surface px-3 py-2.5 text-sm text-nh-admin-text outline-none transition-all focus:border-nh-admin-primary-border"
        >
          {FILTER_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>{opt === 'ALL' ? 'All Statuses' : opt}</option>
          ))}
        </select>
      </div>

      {/* Bulk actions */}
      <div className="flex gap-2">
        <button
          onClick={() => handleBulkAction('approve')}
          className="flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-nh-admin-success-bg px-3 py-1.5 text-xs text-nh-admin-success transition-all hover:bg-nh-admin-success-bg"
        >
          <CheckCircle className="h-3.5 w-3.5" /> Approve All Flagged
        </button>
        <button
          onClick={() => handleBulkAction('warn')}
          className="flex items-center gap-1 rounded-lg border border-nh-admin-amber/30 bg-nh-admin-amber-bg px-3 py-1.5 text-xs text-nh-admin-amber transition-all hover:bg-nh-admin-amber/30"
        >
          <AlertTriangle className="h-3.5 w-3.5" /> Warn All Flagged
        </button>
        <button
          onClick={() => handleBulkAction('remove')}
          className="flex items-center gap-1 rounded-lg border border-nh-admin-rose/30 bg-nh-admin-rose-bg px-3 py-1.5 text-xs text-nh-admin-danger transition-all hover:bg-nh-admin-danger-bg"
        >
          <XCircle className="h-3.5 w-3.5" /> Remove All Flagged
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-2xl border border-nh-admin-danger/30 bg-nh-admin-danger-bg p-4 text-sm text-nh-admin-danger">{error}</div>
      )}

      {/* Posts Table */}
      <div className="overflow-hidden rounded-2xl border border-nh-admin-border bg-nh-admin-surface">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-nh-admin-border border-t-nh-admin-primary" />
          </div>
        ) : posts.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <FileText className="h-12 w-12 text-nh-admin-text-muted" />
            <p className="text-sm text-nh-admin-text-secondary">No posts found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-nh-admin-border bg-nh-admin-surface-elevated">
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-nh-admin-text-secondary">Post</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-nh-admin-text-secondary">Author</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-nh-admin-text-secondary">Category</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-nh-admin-text-secondary">Type</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-nh-admin-text-secondary">Status</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-nh-admin-text-secondary">Engagement</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-nh-admin-text-secondary">Flags</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-nh-admin-text-secondary">Date</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-nh-admin-text-secondary">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-nh-admin-border">
                {posts.map((post) => (
                  <tr key={post.id} className="transition-colors hover:bg-nh-admin-surface-hover">
                    <td className="px-4 py-3">
                      <div className="max-w-[200px]">
                        <div className="flex items-center gap-2">
                          {post.media && post.media.length > 0 ? (
                            <img src={post.media[0].url} alt="" className="h-8 w-8 rounded-lg object-cover" />
                          ) : (
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-nh-admin-border">
                              <MessageSquare className="h-4 w-4 text-nh-admin-text-muted" />
                            </div>
                          )}
                          <span className="text-sm text-nh-admin-text-secondary truncate">
                            {post.caption ? post.caption.slice(0, 60) + (post.caption.length > 60 ? '...' : '') : '(no caption)'}
                          </span>
                        </div>
                        {post.moderationReasons && post.moderationReasons.length > 0 && (
                          <div className="mt-1 flex gap-1 flex-wrap">
                            {post.moderationReasons.map((reason, i) => (
                              <span key={i} className="rounded bg-nh-admin-rose-bg px-1.5 py-0.5 text-[10px] text-nh-admin-danger">{reason}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-nh-admin-text-secondary">
                      <div className="flex items-center gap-2">
                        <div
                          className="flex h-6 w-6 items-center justify-center rounded-full bg-nh-admin-border text-[10px] font-bold text-nh-admin-text overflow-hidden"
                        >
                          {post.author.avatarUrl ? (
                            <img src={post.author.avatarUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            (post.author.displayName?.[0] ?? 'U').toUpperCase()
                          )}
                        </div>
                        {post.author.displayName ?? post.author.email}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-nh-admin-text-secondary">{post.category?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-nh-admin-text-secondary">
                      {post.isBusinessPost ? (
                        <span className="text-nh-admin-amber font-medium">Business</span>
                      ) : (
                        <span className="text-nh-admin-text-muted">Personal</span>
                      )}
                    </td>
                    <td className="px-4 py-3">{statusBadge(post.moderationStatus)}</td>
                    <td className="px-4 py-3 text-sm text-nh-admin-text-secondary">
                      <div className="flex gap-2">
                        <span title="Likes">❤ {post._count?.likes ?? 0}</span>
                        <span title="Comments">💬 {post._count?.comments ?? 0}</span>
                        <span title="Saves">🔖 {post._count?.saves ?? 0}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {post.flagCount > 0 ? (
                        <span className="inline-flex items-center gap-1 text-nh-admin-danger font-medium">
                          <AlertTriangle className="h-3.5 w-3.5" /> {post.flagCount}
                        </span>
                      ) : (
                        <span className="text-nh-admin-text-muted">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-nh-admin-text-secondary">
                      {new Date(post.publishedAt ?? post.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {post.moderationStatus !== 'APPROVED' && (
                          <button
                            onClick={() => handleAction(post.id, 'approve')}
                            title="Approve"
                            className="rounded-lg p-1.5 text-nh-admin-success hover:bg-nh-admin-success-bg transition-colors"
                          >
                            <CheckCircle className="h-4 w-4" />
                          </button>
                        )}
                        {post.moderationStatus !== 'WARNED' && (
                          <button
                            onClick={() => handleAction(post.id, 'warn')}
                            title="Warn User"
                            className="rounded-lg p-1.5 text-nh-admin-amber hover:bg-nh-admin-amber-bg transition-colors"
                          >
                            <AlertTriangle className="h-4 w-4" />
                          </button>
                        )}
                        {post.moderationStatus !== 'REMOVED' && (
                          <button
                            onClick={() => handleAction(post.id, 'remove')}
                            title="Remove"
                            className="rounded-lg p-1.5 text-nh-admin-danger hover:bg-nh-admin-danger-bg transition-colors"
                          >
                            <XCircle className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => window.open(`/explorer?postId=${post.id}`, '_blank')}
                          title="View Post"
                          className="rounded-lg p-1.5 text-nh-admin-text-secondary hover:bg-nh-admin-border transition-colors"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            disabled={page <= 1}
            onClick={() => { const p = page - 1; setPage(p); fetchPosts(p) }}
            className="rounded-lg border border-nh-admin-border bg-nh-admin-surface px-3 py-1.5 text-sm text-nh-admin-text disabled:opacity-40 hover:border-nh-admin-primary transition-all"
          >
            Previous
          </button>
          <span className="text-sm text-nh-admin-text-secondary">Page {page} of {totalPages} ({total} posts)</span>
          <button
            disabled={page >= totalPages}
            onClick={() => { const p = page + 1; setPage(p); fetchPosts(p) }}
            className="rounded-lg border border-nh-admin-border bg-nh-admin-surface px-3 py-1.5 text-sm text-nh-admin-text disabled:opacity-40 hover:border-nh-admin-primary transition-all"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}