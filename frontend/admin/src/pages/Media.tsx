import { useState, useEffect } from 'react'
import api from '../lib/api'
import { Image, Search, RefreshCw, CheckCircle, XCircle, AlertTriangle } from 'lucide-react'

type MediaItem = {
  id: string
  url: string
  thumbnailUrl: string | null
  mimeType: string
  moderationStatus: string
  flagCount: number
  views: number
  createdAt: string
  uploader: { id: string; displayName: string | null; email: string }
  post: { id: string; caption: string } | null
}

type MediaResponse = {
  data: MediaItem[]
  total: number
  page: number
  pageSize: number
}

const MODERATION_COLORS: Record<string, string> = {
  APPROVED: 'bg-nh-admin-success-bg text-nh-admin-success',
  PENDING: 'bg-nh-admin-warning-bg text-nh-admin-warning',
  REMOVED: 'bg-nh-admin-danger-bg text-nh-admin-danger',
  WARNED: 'bg-nh-admin-amber-bg text-nh-admin-amber',
}

function modBadge(status: string) {
  const color = MODERATION_COLORS[status] ?? 'bg-nh-admin-border text-nh-admin-text-secondary'
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${color}`}>
      {status}
    </span>
  )
}

export default function AdminMedia() {
  const [media, setMedia] = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const pageSize = 20

  const fetchMedia = async (p = page) => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.get<MediaResponse>(`/admin/media?page=${p}&pageSize=${pageSize}`)
      setMedia(res.data.data ?? [])
      setTotal(res.data.total ?? 0)
      setPage(res.data.page ?? p)
    } catch (err: any) {
      setError(err?.response?.data?.error ?? err.message ?? 'Failed to load media')
      setMedia([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchMedia(1) }, [])

  const handleModerate = async (id: string, action: 'APPROVED' | 'REMOVED' | 'WARNED') => {
    try {
      await api.post(`/admin/media/${id}/moderate`, { action })
      fetchMedia(page)
    } catch (err: any) {
      setError(err?.response?.data?.error ?? err.message ?? 'Failed to moderate')
    }
  }

  const filtered = search
    ? media.filter((m) =>
        [m.id, m.uploader?.email, m.uploader?.displayName, m.moderationStatus, m.mimeType]
          .filter(Boolean)
          .some((f) => f!.toLowerCase().includes(search.toLowerCase())),
      )
    : media

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black text-nh-admin-text">Media</h1>
          <p className="mt-1 text-sm text-nh-admin-text-secondary">Review and moderate uploaded media assets</p>
        </div>
        <button onClick={() => fetchMedia(page)} className="flex items-center gap-2 rounded-xl border border-nh-admin-border bg-nh-admin-surface px-4 py-2 text-sm text-nh-admin-text transition-all hover:border-nh-admin-primary">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-nh-admin-text-muted" />
        <input type="text" placeholder="Search media..." value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-nh-admin-border bg-nh-admin-surface py-2.5 pl-10 pr-4 text-sm text-nh-admin-text placeholder-nh-admin-text-muted outline-none transition-all focus:border-nh-admin-primary-border" />
      </div>

      {error && <div className="rounded-2xl border border-nh-admin-danger/30 bg-nh-admin-danger-bg p-4 text-sm text-nh-admin-danger">{error}</div>}

      <div className="overflow-hidden rounded-2xl border border-nh-admin-border bg-nh-admin-surface">
        {loading ? (
          <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-2 border-nh-admin-border border-t-nh-admin-primary" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <Image className="h-12 w-12 text-nh-admin-text-muted" />
            <p className="text-sm text-nh-admin-text-secondary">No media found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-nh-admin-border bg-nh-admin-surface-elevated">
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-nh-admin-text-secondary">Preview</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-nh-admin-text-secondary">Type</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-nh-admin-text-secondary">Uploader</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-nh-admin-text-secondary">Status</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-nh-admin-text-secondary">Flags</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-nh-admin-text-secondary">Views</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-nh-admin-text-secondary">Uploaded</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-nh-admin-text-secondary">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-nh-admin-border">
                {filtered.map((m) => (
                  <tr key={m.id} className="transition-colors hover:bg-nh-admin-surface-hover">
                    <td className="px-4 py-3">
                      {m.thumbnailUrl || (m.mimeType.startsWith('image/') && m.url) ? (
                        <img src={m.thumbnailUrl ?? m.url} alt="" className="h-10 w-10 rounded-lg object-cover" />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-nh-admin-border">
                          <Image className="h-5 w-5 text-nh-admin-text-muted" />
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-nh-admin-text-secondary font-mono text-[11px]">{m.mimeType}</td>
                    <td className="px-4 py-3 text-sm text-nh-admin-text-secondary">{m.uploader?.displayName ?? m.uploader?.email ?? '—'}</td>
                    <td className="px-4 py-3">{modBadge(m.moderationStatus)}</td>
                    <td className="px-4 py-3 text-sm text-nh-admin-text-secondary">{m.flagCount > 0 ? <span className="text-nh-admin-danger font-medium">{m.flagCount}</span> : '0'}</td>
                    <td className="px-4 py-3 text-sm text-nh-admin-text-secondary">{m.views}</td>
                    <td className="px-4 py-3 text-sm text-nh-admin-text-secondary">{new Date(m.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {m.moderationStatus !== 'APPROVED' && (
                          <button onClick={() => handleModerate(m.id, 'APPROVED')} title="Approve"
                            className="rounded-lg p-1.5 text-nh-admin-success hover:bg-nh-admin-success-bg transition-colors">
                            <CheckCircle className="h-4 w-4" />
                          </button>
                        )}
                        {m.moderationStatus !== 'WARNED' && (
                          <button onClick={() => handleModerate(m.id, 'WARNED')} title="Warn"
                            className="rounded-lg p-1.5 text-nh-admin-amber hover:bg-nh-admin-amber-bg transition-colors">
                            <AlertTriangle className="h-4 w-4" />
                          </button>
                        )}
                        {m.moderationStatus !== 'REMOVED' && (
                          <button onClick={() => handleModerate(m.id, 'REMOVED')} title="Remove"
                            className="rounded-lg p-1.5 text-nh-admin-danger hover:bg-nh-admin-danger-bg transition-colors">
                            <XCircle className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button disabled={page <= 1} onClick={() => fetchMedia(page - 1)}
            className="rounded-lg border border-nh-admin-border bg-nh-admin-surface px-3 py-1.5 text-sm text-nh-admin-text disabled:opacity-40 hover:border-nh-admin-primary transition-all">
            Previous
          </button>
          <span className="text-sm text-nh-admin-text-secondary">Page {page} of {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => fetchMedia(page + 1)}
            className="rounded-lg border border-nh-admin-border bg-nh-admin-surface px-3 py-1.5 text-sm text-nh-admin-text disabled:opacity-40 hover:border-nh-admin-primary transition-all">
            Next
          </button>
        </div>
      )}
    </div>
  )
}
