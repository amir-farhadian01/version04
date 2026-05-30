import { useState, useEffect } from 'react'
import api from '../../lib/api'
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
  APPROVED: 'bg-emerald-500/20 text-emerald-400',
  PENDING: 'bg-amber-500/20 text-amber-400',
  REMOVED: 'bg-rose-500/20 text-rose-400',
  WARNED: 'bg-orange-500/20 text-orange-400',
}

function modBadge(status: string) {
  const color = MODERATION_COLORS[status] ?? 'bg-[#2a2f4a]/50 text-[#6a6e88]'
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
          <h1 className="text-3xl font-black text-[#f0f2ff]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Media</h1>
          <p className="mt-1 text-sm text-[#6a6e88]">Review and moderate uploaded media assets</p>
        </div>
        <button onClick={() => fetchMedia(page)} className="flex items-center gap-2 rounded-xl border border-[#2a2f4a] bg-[#1e2235] px-4 py-2 text-sm text-[#f0f2ff] transition-all hover:border-[#2b6eff]">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#4a4f70]" />
        <input type="text" placeholder="Search media..." value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-[#2a2f4a] bg-[#1e2235] py-2.5 pl-10 pr-4 text-sm text-[#f0f2ff] placeholder-[#4a4f70] outline-none transition-all focus:border-[#2b6eff]" />
      </div>

      {error && <div className="rounded-2xl border border-[#ff4d4d]/30 bg-[#ff4d4d]/10 p-4 text-sm text-[#ff4d4d]">{error}</div>}

      <div className="overflow-hidden rounded-2xl border border-[#2a2f4a] bg-[#1e2235]">
        {loading ? (
          <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-2 border-[#2a2f4a] border-t-[#2b6eff]" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <Image className="h-12 w-12 text-[#4a4f70]" />
            <p className="text-sm text-[#6a6e88]">No media found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[#2a2f4a] bg-[#1a1d2e]">
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#6a6e88]">Preview</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#6a6e88]">Type</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#6a6e88]">Uploader</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#6a6e88]">Status</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#6a6e88]">Flags</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#6a6e88]">Views</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#6a6e88]">Uploaded</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#6a6e88]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2a2f4a]">
                {filtered.map((m) => (
                  <tr key={m.id} className="transition-colors hover:bg-[#1a1d2e]/50">
                    <td className="px-4 py-3">
                      {m.thumbnailUrl || (m.mimeType.startsWith('image/') && m.url) ? (
                        <img src={m.thumbnailUrl ?? m.url} alt="" className="h-10 w-10 rounded-lg object-cover" />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#2a2f4a]">
                          <Image className="h-5 w-5 text-[#4a4f70]" />
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-[#6a6e88] font-mono text-[11px]">{m.mimeType}</td>
                    <td className="px-4 py-3 text-sm text-[#6a6e88]">{m.uploader?.displayName ?? m.uploader?.email ?? '—'}</td>
                    <td className="px-4 py-3">{modBadge(m.moderationStatus)}</td>
                    <td className="px-4 py-3 text-sm text-[#6a6e88]">{m.flagCount > 0 ? <span className="text-rose-400 font-medium">{m.flagCount}</span> : '0'}</td>
                    <td className="px-4 py-3 text-sm text-[#6a6e88]">{m.views}</td>
                    <td className="px-4 py-3 text-sm text-[#6a6e88]">{new Date(m.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {m.moderationStatus !== 'APPROVED' && (
                          <button onClick={() => handleModerate(m.id, 'APPROVED')} title="Approve"
                            className="rounded-lg p-1.5 text-emerald-400 hover:bg-emerald-500/20 transition-colors">
                            <CheckCircle className="h-4 w-4" />
                          </button>
                        )}
                        {m.moderationStatus !== 'WARNED' && (
                          <button onClick={() => handleModerate(m.id, 'WARNED')} title="Warn"
                            className="rounded-lg p-1.5 text-orange-400 hover:bg-orange-500/20 transition-colors">
                            <AlertTriangle className="h-4 w-4" />
                          </button>
                        )}
                        {m.moderationStatus !== 'REMOVED' && (
                          <button onClick={() => handleModerate(m.id, 'REMOVED')} title="Remove"
                            className="rounded-lg p-1.5 text-rose-400 hover:bg-rose-500/20 transition-colors">
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
            className="rounded-lg border border-[#2a2f4a] bg-[#1e2235] px-3 py-1.5 text-sm text-[#f0f2ff] disabled:opacity-40 hover:border-[#2b6eff] transition-all">
            Previous
          </button>
          <span className="text-sm text-[#6a6e88]">Page {page} of {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => fetchMedia(page + 1)}
            className="rounded-lg border border-[#2a2f4a] bg-[#1e2235] px-3 py-1.5 text-sm text-[#f0f2ff] disabled:opacity-40 hover:border-[#2b6eff] transition-all">
            Next
          </button>
        </div>
      )}
    </div>
  )
}
