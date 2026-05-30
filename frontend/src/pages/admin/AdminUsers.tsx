import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../lib/api'
import { Users, Search, RefreshCw, CheckCircle2, XCircle, AlertCircle, ChevronRight } from 'lucide-react'

type AdminUser = {
  id: string
  email: string
  phone: string | null
  firstName: string | null
  lastName: string | null
  displayName: string | null
  avatarUrl: string | null
  role: string
  staffRole: string | null
  status: string
  isVerified: boolean
  createdAt: string
  updatedAt: string
  lastLoginAt: string | null
  kyc: {
    personalStatus: string
    businessStatus: string
  }
  ownedCompany: { id: string; name: string; kycStatus?: string } | null
  counts: {
    requestsAsCustomer: number
    requestsAsProvider: number
    contracts: number
    services: number
  }
}

export default function AdminUsers() {
  const navigate = useNavigate()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [segment, setSegment] = useState<'all' | 'clients' | 'providers'>('all')
  const [error, setError] = useState<string | null>(null)

  const fetchUsers = async () => {
    setLoading(true)
    setError(null)
    try {
      let endpoint = '/admin/users'
      if (segment === 'clients') endpoint = '/admin/users/clients'
      else if (segment === 'providers') endpoint = '/admin/users/providers'
      const res = await api.get<{ items: AdminUser[]; total: number }>(endpoint)
      setUsers(res.data.items ?? [])
    } catch (err: any) {
      setError(err?.response?.data?.error ?? err.message ?? 'Failed to load users')
      setUsers([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchUsers() }, [segment])

  const filtered = search
    ? users.filter((u) =>
        [u.email, u.displayName, u.firstName, u.lastName, u.id]
          .filter(Boolean)
          .some((f) => f!.toLowerCase().includes(search.toLowerCase())),
      )
    : users

  const statusBadge = (status: string) => {
    const map: Record<string, { color: string; icon: React.ReactNode }> = {
      active: { color: 'text-[#0fc98a] bg-[#0fc98a]/10', icon: <CheckCircle2 className="h-3 w-3" /> },
      suspended: { color: 'text-[#ff4d4d] bg-[#ff4d4d]/10', icon: <XCircle className="h-3 w-3" /> },
      pending: { color: 'text-[#ffb800] bg-[#ffb800]/10', icon: <AlertCircle className="h-3 w-3" /> },
    }
    const s = map[status] ?? { color: 'text-[#6a6e88] bg-[#2a2f4a]/50', icon: <AlertCircle className="h-3 w-3" /> }
    return (
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${s.color}`}>
        {s.icon}
        {status}
      </span>
    )
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black text-[#f0f2ff]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Users
          </h1>
          <p className="mt-1 text-sm text-[#6a6e88]">Manage all platform users</p>
        </div>
        <button
          onClick={fetchUsers}
          className="flex items-center gap-2 rounded-xl border border-[#2a2f4a] bg-[#1e2235] px-4 py-2 text-sm text-[#f0f2ff] transition-all hover:border-[#2b6eff]"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#4a4f70]" />
          <input
            type="text"
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-[#2a2f4a] bg-[#1e2235] py-2.5 pl-10 pr-4 text-sm text-[#f0f2ff] placeholder-[#4a4f70] outline-none transition-all focus:border-[#2b6eff]"
          />
        </div>
        <div className="flex rounded-xl border border-[#2a2f4a] overflow-hidden">
          {(['all', 'clients', 'providers'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSegment(s)}
              className={`px-4 py-2 text-sm font-medium transition-all ${
                segment === s
                  ? 'bg-[#2b6eff] text-white'
                  : 'bg-[#1e2235] text-[#6a6e88] hover:text-[#f0f2ff]'
              }`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-2xl border border-[#ff4d4d]/30 bg-[#ff4d4d]/10 p-4 text-sm text-[#ff4d4d]">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-[#2a2f4a] bg-[#1e2235]">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#2a2f4a] border-t-[#2b6eff]" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <Users className="h-12 w-12 text-[#4a4f70]" />
            <p className="text-sm text-[#6a6e88]">No users found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[#2a2f4a] bg-[#1a1d2e]">
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#6a6e88]">User</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#6a6e88]">Email</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#6a6e88]">Role</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#6a6e88]">Status</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#6a6e88]">Verified</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#6a6e88]">Joined</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2a2f4a]">
                {filtered.map((user) => (
                  <tr
                    key={user.id}
                    className="cursor-pointer transition-colors hover:bg-[#1a1d2e]/50"
                    onClick={() => navigate(`/admin/users/${user.id}`)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#2b6eff]/10 text-[#2b6eff] text-sm font-bold">
                          {(user.displayName ?? user.firstName ?? user.email)[0]?.toUpperCase() ?? '?'}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-[#f0f2ff]">
                            {(user.displayName ?? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim()) || '—'}
                          </p>
                          <p className="text-[11px] text-[#4a4f70]">{user.id.slice(0, 8)}...</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-[#6a6e88]">{user.email}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-md bg-[#2a2f4a]/50 px-2 py-0.5 text-[11px] font-medium text-[#6a6e88]">
                        {user.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">{statusBadge(user.status)}</td>
                    <td className="px-4 py-3">
                      {user.isVerified ? (
                        <CheckCircle2 className="h-4 w-4 text-[#0fc98a]" />
                      ) : (
                        <XCircle className="h-4 w-4 text-[#4a4f70]" />
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-[#6a6e88]">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        className="rounded-lg p-1.5 text-[#4a4f70] transition-colors hover:bg-[#2a2f4a] hover:text-[#f0f2ff]"
                        onClick={(e) => {
                          e.stopPropagation()
                          navigate(`/admin/users/${user.id}`)
                        }}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Summary */}
      {!loading && filtered.length > 0 && (
        <p className="text-center text-xs text-[#4a4f70]">
          Showing {filtered.length} of {users.length} user{users.length !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  )
}
