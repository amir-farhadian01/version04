import { useState, useEffect } from 'react'
import api from '../lib/api'
import { Shield, Search, CheckCircle2, XCircle, Clock, RefreshCw, Building2, UserCheck, User, Eye, FileText, Star, ThumbsUp, ThumbsDown, AlertTriangle } from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────

type KycTab = 'personal' | 'business' | 'level0'

type KycResponse<T> = {
  page: number
  pageSize: number
  total: number
  rows: T[]
}

interface BusinessKycRow {
  id: string
  status: string
  submittedAt: string
  updatedAt: string
  userId: string
  companyId: string
  schemaVersion: number
  answers: Record<string, unknown>
  uploads: Record<string, unknown>
  reviewNote: string | null
  user: {
    email: string
    displayName: string | null
    declaredLegalName: string | null
  }
  company: {
    id: string
    name: string
  }
}

interface TrustScoreData {
  workspaceId: string
  kycVerified: boolean
  licenseVerified: boolean
  insuranceVerified: boolean
  avgRating: number
  totalScore: number
}

// ── Component ──────────────────────────────────────────────────────────────

export default function AdminKyc() {
  const [tab, setTab] = useState<KycTab>('personal')
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [error, setError] = useState<string | null>(null)

  // ── Business review modal ─────────────────────────────────────────────────
  const [reviewItem, setReviewItem] = useState<BusinessKycRow | null>(null)
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject' | 'request_resubmit' | null>(null)
  const [reviewNote, setReviewNote] = useState('')
  const [reviewing, setReviewing] = useState(false)

  // ── Document preview modal ───────────────────────────────────────────────
  const [docPreview, setDocPreview] = useState<{ title: string; url: string } | null>(null)

  // ── Trust score modal ────────────────────────────────────────────────────
  const [trustScoreItem, setTrustScoreItem] = useState<BusinessKycRow | null>(null)
  const [trustScore, setTrustScore] = useState<TrustScoreData | null>(null)
  const [tsKycVerified, setTsKycVerified] = useState(false)
  const [tsLicenseVerified, setTsLicenseVerified] = useState(false)
  const [tsInsuranceVerified, setTsInsuranceVerified] = useState(false)
  const [tsAvgRating, setTsAvgRating] = useState(0)
  const [savingTrustScore, setSavingTrustScore] = useState(false)
  const [trustScoreError, setTrustScoreError] = useState<string | null>(null)

  const fetchKyc = async () => {
    setLoading(true)
    setError(null)
    try {
      const params: Record<string, string> = {}
      if (statusFilter) params.status = statusFilter
      if (search) params.q = search

      let endpoint: string
      if (tab === 'personal') endpoint = '/admin/kyc/personal'
      else if (tab === 'business') endpoint = '/admin/kyc/business'
      else endpoint = '/admin/kyc/level0'

      const res = await api.get<KycResponse<any>>(endpoint, { params })
      setItems(res.data.rows ?? [])
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err
        ? (err as any).response?.data?.error ?? 'Failed to load KYC submissions'
        : 'Failed to load KYC submissions'
      setError(msg)
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchKyc() }, [tab, statusFilter])

  const filtered = search
    ? items.filter((k) => {
        const user = k.user ?? k
        const email = user.email ?? ''
        const name = user.displayName ?? user.declaredLegalName ?? ''
        const companyName = k.company?.name ?? ''
        return (
          email.toLowerCase().includes(search.toLowerCase()) ||
          name.toLowerCase().includes(search.toLowerCase()) ||
          companyName.toLowerCase().includes(search.toLowerCase())
        )
      })
    : items

  const statusBadge = (status: string) => {
    const map: Record<string, { color: string; icon: React.ReactNode }> = {
      approved: { color: 'text-nh-admin-success bg-nh-admin-success-bg', icon: <CheckCircle2 className="h-3 w-3" /> },
      rejected: { color: 'text-nh-admin-danger bg-nh-admin-danger-bg', icon: <XCircle className="h-3 w-3" /> },
      pending: { color: 'text-nh-admin-warning bg-nh-admin-warning-bg', icon: <Clock className="h-3 w-3" /> },
      submitted: { color: 'text-nh-admin-primary bg-nh-admin-primary-bg', icon: <Clock className="h-3 w-3" /> },
      draft: { color: 'text-nh-admin-text-secondary bg-nh-admin-border', icon: <FileText className="h-3 w-3" /> },
      request_resubmit: { color: 'text-nh-admin-warning bg-nh-admin-warning-bg', icon: <AlertTriangle className="h-3 w-3" /> },
    }
    const s = map[(status ?? '').toLowerCase()] ?? { color: 'text-nh-admin-text-secondary bg-nh-admin-border', icon: <Clock className="h-3 w-3" /> }
    return (
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${s.color}`}>
        {s.icon}
        {status}
      </span>
    )
  }

  const tabs: { key: KycTab; label: string; icon: React.ReactNode }[] = [
    { key: 'personal', label: 'Personal', icon: <User className="h-4 w-4" /> },
    { key: 'business', label: 'Business', icon: <Building2 className="h-4 w-4" /> },
    { key: 'level0', label: 'Level 0', icon: <UserCheck className="h-4 w-4" /> },
  ]

  // ── Business review action ────────────────────────────────────────────────
  const openReviewModal = (item: BusinessKycRow, action: 'approve' | 'reject' | 'request_resubmit') => {
    setReviewItem(item)
    setReviewAction(action)
    setReviewNote('')
  }

  const handleReview = async () => {
    if (!reviewItem || !reviewAction) return
    setReviewing(true)
    try {
      const endpoint = `/admin/kyc/business/${reviewItem.id}/${reviewAction}`
      await api.put(endpoint, { reviewNote: reviewNote || undefined })
      setReviewItem(null)
      setReviewAction(null)
      setReviewNote('')
      fetchKyc()
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err
        ? (err as any).response?.data?.error ?? 'Review failed'
        : 'Review failed'
      setError(msg)
    }
    setReviewing(false)
  }

  // ── Trust score ───────────────────────────────────────────────────────────
  const openTrustScoreModal = async (item: BusinessKycRow) => {
    setTrustScoreItem(item)
    setTrustScoreError(null)
    try {
      const res = await api.get<TrustScoreData>(`/admin/kyc/business/${item.id}/trust-score`)
      const ts = res.data
      setTrustScore(ts)
      setTsKycVerified(ts.kycVerified)
      setTsLicenseVerified(ts.licenseVerified)
      setTsInsuranceVerified(ts.insuranceVerified)
      setTsAvgRating(ts.avgRating)
    } catch {
      // Default values
      const companyId = item.companyId
      setTrustScore({
        workspaceId: companyId,
        kycVerified: false,
        licenseVerified: false,
        insuranceVerified: false,
        avgRating: 0,
        totalScore: 0,
      })
      setTsKycVerified(false)
      setTsLicenseVerified(false)
      setTsInsuranceVerified(false)
      setTsAvgRating(0)
    }
  }

  const calculateScore = (kyc: boolean, license: boolean, insurance: boolean, rating: number) => {
    const kycScore = kyc ? 30 : 0
    const licenseScore = license ? 25 : 0
    const insuranceScore = insurance ? 25 : 0
    const ratingScore = Math.round((rating / 5) * 20)
    return kycScore + licenseScore + insuranceScore + ratingScore
  }

  const handleSaveTrustScore = async () => {
    if (!trustScoreItem) return
    setSavingTrustScore(true)
    setTrustScoreError(null)
    try {
      await api.put(`/admin/kyc/business/${trustScoreItem.id}/trust-score`, {
        kycVerified: tsKycVerified,
        licenseVerified: tsLicenseVerified,
        insuranceVerified: tsInsuranceVerified,
        avgRating: tsAvgRating,
      })
      setTrustScoreItem(null)
      setTrustScore(null)
      fetchKyc()
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err
        ? (err as any).response?.data?.error ?? 'Failed to save trust score'
        : 'Failed to save trust score'
      setTrustScoreError(msg)
    }
    setSavingTrustScore(false)
  }

  // ── Level 0 acknowledge action ─────────────────────────────────────────────
  const handleLevel0Acknowledge = async (userId: string) => {
    try {
      await api.post(`/admin/kyc/level0/${userId}/acknowledge`)
      fetchKyc()
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err
        ? (err as any).response?.data?.error ?? 'Failed to acknowledge'
        : 'Failed to acknowledge'
      setError(msg)
    }
  }

  // ── Business tab table ─────────────────────────────────────────────────────
  const renderBusinessTable = () => {
    const bizItems = filtered as BusinessKycRow[]
    return (
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-nh-admin-border bg-nh-admin-surface-elevated">
            <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-nh-admin-text-secondary">User</th>
            <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-nh-admin-text-secondary">Company</th>
            <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-nh-admin-text-secondary">Status</th>
            <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-nh-admin-text-secondary">Submitted</th>
            <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-nh-admin-text-secondary">Docs</th>
            <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-nh-admin-text-secondary">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-nh-admin-border">
          {bizItems.map((item) => {
            const user = item.user
            const displayName = user?.displayName ?? user?.declaredLegalName ?? user?.email ?? '—'
            const email = user?.email ?? ''
            const initial = (displayName[0] ?? '?').toUpperCase()
            const uploads = item.uploads as Record<string, string> | null

            return (
              <tr key={item.id} className="transition-colors hover:bg-nh-admin-surface-hover">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-nh-admin-primary-bg text-nh-admin-primary text-sm font-bold">
                      {initial}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-nh-admin-text">{displayName}</p>
                      <p className="text-[11px] text-nh-admin-text-muted">{email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-nh-admin-text-secondary">{item.company?.name ?? '—'}</td>
                <td className="px-4 py-3">{statusBadge(item.status)}</td>
                <td className="px-4 py-3 text-sm text-nh-admin-text-secondary">
                  {item.submittedAt ? new Date(item.submittedAt).toLocaleDateString() : '—'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    {uploads?.licenseDocUrl && (
                      <button
                        onClick={() => setDocPreview({ title: 'License Document', url: uploads.licenseDocUrl as string })}
                        className="flex items-center gap-1 rounded-md bg-nh-admin-border px-2 py-1 text-[10px] text-nh-admin-text hover:bg-nh-admin-border transition-colors"
                      >
                        <Eye className="h-3 w-3" /> License
                      </button>
                    )}
                    {uploads?.insuranceDocUrl && (
                      <button
                        onClick={() => setDocPreview({ title: 'Insurance Certificate', url: uploads.insuranceDocUrl as string })}
                        className="flex items-center gap-1 rounded-md bg-nh-admin-border px-2 py-1 text-[10px] text-nh-admin-text hover:bg-nh-admin-border transition-colors"
                      >
                        <Eye className="h-3 w-3" /> Insurance
                      </button>
                    )}
                    {!uploads?.licenseDocUrl && !uploads?.insuranceDocUrl && (
                      <span className="text-[10px] text-nh-admin-text-muted">—</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {/* Approve */}
                    {(item.status === 'submitted' || item.status === 'pending') && (
                      <>
                        <button
                          onClick={() => openReviewModal(item, 'approve')}
                          className="flex items-center gap-1 rounded-md bg-nh-admin-success-bg px-2 py-1 text-[10px] text-nh-admin-success hover:bg-nh-admin-success-bg transition-colors"
                          title="Approve"
                        >
                          <ThumbsUp className="h-3 w-3" /> Approve
                        </button>
                        <button
                          onClick={() => openReviewModal(item, 'reject')}
                          className="flex items-center gap-1 rounded-md bg-nh-admin-danger-bg px-2 py-1 text-[10px] text-nh-admin-danger hover:bg-nh-admin-danger-bg transition-colors"
                          title="Reject"
                        >
                          <ThumbsDown className="h-3 w-3" /> Reject
                        </button>
                        <button
                          onClick={() => openReviewModal(item, 'request_resubmit')}
                          className="flex items-center gap-1 rounded-md bg-nh-admin-warning-bg px-2 py-1 text-[10px] text-nh-admin-warning hover:bg-nh-admin-warning-bg transition-colors"
                          title="Request Resubmission"
                        >
                          <AlertTriangle className="h-3 w-3" /> Resubmit
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => openTrustScoreModal(item)}
                      className="flex items-center gap-1 rounded-md bg-nh-admin-primary-bg px-2 py-1 text-[10px] text-nh-admin-primary hover:bg-nh-admin-primary-bg transition-colors"
                      title="Trust Score"
                    >
                      <Star className="h-3 w-3" /> Score
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    )
  }

  // ── Level 0 table (dedicated shape: user + verification flags) ─────────────
  const renderLevel0Table = () => (
    <table className="w-full text-left">
      <thead>
        <tr className="border-b border-nh-admin-border bg-nh-admin-surface-elevated">
          <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-nh-admin-text-secondary">User</th>
          <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-nh-admin-text-secondary">Email</th>
          <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-nh-admin-text-secondary">Phone</th>
          <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-nh-admin-text-secondary">Address</th>
          <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-nh-admin-text-secondary">Last Updated</th>
          <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-nh-admin-text-secondary">Actions</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-nh-admin-border">
        {filtered.map((item: any) => {
          // Level0 items have shape: { user: {...}, emailVerified, phoneVerified, address, ... }
          const user = item.user ?? item
          const displayName = user.displayName ?? user.email ?? '—'
          const email = user.email ?? ''
          const phone = user.phone ?? ''
          const initial = ((user.displayName ?? user.firstName ?? user.email ?? '?')[0] ?? '?').toUpperCase()

          return (
            <tr key={user.id ?? 'unknown'} className="transition-colors hover:bg-nh-admin-surface-hover">
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-nh-admin-primary-bg text-nh-admin-primary text-sm font-bold">
                    {initial}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-nh-admin-text">{displayName}</p>
                    <p className="text-[11px] text-nh-admin-text-muted">{email}</p>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3">
                {item.emailVerified
                  ? <span className="inline-flex items-center gap-1 text-nh-admin-success text-xs"><CheckCircle2 className="h-3 w-3" /> Verified</span>
                  : <span className="inline-flex items-center gap-1 text-nh-admin-danger text-xs"><XCircle className="h-3 w-3" /> Missing</span>}
              </td>
              <td className="px-4 py-3">
                {item.phoneVerified
                  ? <span className="inline-flex items-center gap-1 text-nh-admin-success text-xs"><CheckCircle2 className="h-3 w-3" /> {phone || 'Verified'}</span>
                  : <span className="inline-flex items-center gap-1 text-nh-admin-danger text-xs"><XCircle className="h-3 w-3" /> Missing</span>}
              </td>
              <td className="px-4 py-3">
                {item.address
                  ? <span className="text-xs text-nh-admin-text-secondary max-w-[200px] truncate block">{item.address}</span>
                  : <span className="inline-flex items-center gap-1 text-nh-admin-danger text-xs"><XCircle className="h-3 w-3" /> Missing</span>}
              </td>
              <td className="px-4 py-3 text-xs text-nh-admin-text-secondary">
                {item.lastUpdated ? new Date(item.lastUpdated).toLocaleDateString() : '—'}
              </td>
              <td className="px-4 py-3">
                <button
                  onClick={() => handleLevel0Acknowledge(user.id)}
                  className={`flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium transition-colors ${
                    item.adminAcknowledgedAt
                      ? 'bg-nh-admin-success-bg text-nh-admin-success cursor-default'
                      : 'bg-nh-admin-primary-bg text-nh-admin-primary hover:bg-nh-admin-primary-bg'
                  }`}
                >
                  {item.adminAcknowledgedAt ? (
                    <><CheckCircle2 className="h-3 w-3" /> Acknowledged</>
                  ) : (
                    <><UserCheck className="h-3 w-3" /> Acknowledge</>
                  )}
                </button>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )

  // ── Common table for personal ──────────────────────────────────────────────
  const renderCommonTable = (tableTab: KycTab) => (
    <table className="w-full text-left">
      <thead>
        <tr className="border-b border-nh-admin-border bg-nh-admin-surface-elevated">
          <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-nh-admin-text-secondary">User</th>
          {tableTab === 'business' && (
            <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-nh-admin-text-secondary">Company</th>
          )}
          {tableTab === 'personal' && (
            <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-nh-admin-text-secondary">Legal Name</th>
          )}
          <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-nh-admin-text-secondary">Status</th>
          <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-nh-admin-text-secondary">Submitted</th>
          <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-nh-admin-text-secondary">Updated</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-nh-admin-border">
        {filtered.map((item: any) => {
          const user = item.user ?? item
          const displayName = user.displayName ?? user.declaredLegalName ?? user.email ?? '—'
          const email = user.email ?? ''
          const initial = (displayName[0] ?? '?').toUpperCase()

          return (
            <tr key={item.id ?? user.id} className="transition-colors hover:bg-nh-admin-surface-hover">
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-nh-admin-primary-bg text-nh-admin-primary text-sm font-bold">
                    {initial}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-nh-admin-text">{displayName}</p>
                    <p className="text-[11px] text-nh-admin-text-muted">{email}</p>
                  </div>
                </div>
              </td>
              {tableTab === 'business' && (
                <td className="px-4 py-3 text-sm text-nh-admin-text-secondary">
                  {item.company?.name ?? '—'}
                </td>
              )}
              {tableTab === 'personal' && (
                <td className="px-4 py-3 text-sm text-nh-admin-text-secondary">
                  {item.declaredLegalName ?? '—'}
                </td>
              )}
              <td className="px-4 py-3">{statusBadge(item.status)}</td>
              <td className="px-4 py-3 text-sm text-nh-admin-text-secondary">
                {new Date(item.submittedAt ?? item.createdAt).toLocaleDateString()}
              </td>
              <td className="px-4 py-3 text-sm text-nh-admin-text-secondary">
                {new Date(item.updatedAt).toLocaleDateString()}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )

  // ── Review Modal ───────────────────────────────────────────────────────────
  const renderReviewModal = () => {
    if (!reviewItem || !reviewAction) return null
    const actionLabels: Record<string, string> = {
      approve: 'Approve Business KYC',
      reject: 'Reject Business KYC',
      request_resubmit: 'Request Resubmission',
    }
    const actionColors: Record<string, string> = {
      approve: '#0fc98a',
      reject: '#ff4d4d',
      request_resubmit: '#ffb800',
    }

    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4">
        <div className="w-full max-w-md rounded-2xl border border-nh-admin-border bg-nh-admin-surface p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-nh-admin-border">
              {reviewAction === 'approve' ? <ThumbsUp className="h-5 w-5 text-nh-admin-success" /> :
               reviewAction === 'reject' ? <ThumbsDown className="h-5 w-5 text-nh-admin-danger" /> :
               <AlertTriangle className="h-5 w-5 text-nh-admin-warning" />}
            </div>
            <div>
              <h3 className="text-base font-semibold text-nh-admin-text">
                {actionLabels[reviewAction]}
              </h3>
              <p className="text-xs text-nh-admin-text-secondary">
                {reviewItem.user?.displayName ?? reviewItem.user?.email} · {reviewItem.company?.name}
              </p>
            </div>
          </div>

          <div className="mb-4">
            <label className="mb-1 block text-xs font-medium text-nh-admin-text-secondary">Review Note</label>
            <textarea
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              placeholder={reviewAction === 'approve' ? 'Optional approval note...' : 'Reason for rejection / what needs to be fixed...'}
              className="w-full rounded-xl border border-nh-admin-border bg-nh-admin-surface-elevated p-3 text-sm text-nh-admin-text placeholder-nh-admin-text-muted outline-none focus:border-nh-admin-primary-border resize-none"
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={() => setReviewItem(null)}
              className="rounded-xl border border-nh-admin-border px-4 py-2.5 text-sm text-nh-admin-text-secondary hover:text-nh-admin-text transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleReview}
              disabled={reviewing}
              className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ background: actionColors[reviewAction] }}
            >
              {reviewing ? 'Processing...' : actionLabels[reviewAction].replace('Business KYC', '').trim()}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Document Preview Modal ─────────────────────────────────────────────────
  const renderDocPreviewModal = () => {
    if (!docPreview) return null
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4">
        <div className="w-full max-w-2xl rounded-2xl border border-nh-admin-border bg-nh-admin-surface p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-semibold text-nh-admin-text">
              {docPreview.title}
            </h3>
            <button
              onClick={() => setDocPreview(null)}
              className="rounded-lg p-1.5 text-nh-admin-text-secondary hover:bg-nh-admin-border hover:text-nh-admin-text transition-colors"
            >
              <XCircle className="h-5 w-5" />
            </button>
          </div>
          <div className="flex items-center justify-center rounded-xl border border-nh-admin-border bg-nh-admin-surface-elevated p-8">
            {docPreview.url.match(/\.(jpg|jpeg|png|gif|webp)/i) ? (
              <img src={docPreview.url} alt={docPreview.title} className="max-h-96 rounded-lg object-contain" />
            ) : (
              <div className="flex flex-col items-center gap-3 text-center">
                <FileText className="h-16 w-16 text-nh-admin-text-muted" />
                <p className="text-sm text-nh-admin-text-secondary">PDF document preview not available inline</p>
                <a
                  href={docPreview.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-xl bg-nh-admin-primary px-4 py-2 text-sm font-semibold text-white hover:bg-nh-admin-primary-90 transition-colors"
                >
                  <FileText className="h-4 w-4" /> Open Document
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── Trust Score Modal ──────────────────────────────────────────────────────
  const renderTrustScoreModal = () => {
    if (!trustScoreItem) return null
    const totalScore = calculateScore(tsKycVerified, tsLicenseVerified, tsInsuranceVerified, tsAvgRating)
    const scoreColor = totalScore >= 70 ? '#0fc98a' : totalScore >= 40 ? '#ffb800' : '#ff4d4d'

    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4">
        <div className="w-full max-w-md rounded-2xl border border-nh-admin-border bg-nh-admin-surface p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-nh-admin-primary-bg">
                <Star className="h-5 w-5 text-nh-admin-primary" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-nh-admin-text">
                  Trust Score
                </h3>
                <p className="text-xs text-nh-admin-text-secondary">{trustScoreItem.company?.name}</p>
              </div>
            </div>
            <div className="text-3xl font-bold" style={{ color: scoreColor }}>
              {totalScore}
            </div>
          </div>

          {/* Score bar */}
          <div className="mb-6">
            <div className="h-2 w-full overflow-hidden rounded-full bg-nh-admin-border">
              <div className="h-full rounded-full transition-all duration-300" style={{ width: `${totalScore}%`, background: scoreColor }} />
            </div>
            <div className="mt-1 text-right text-[10px] text-nh-admin-text-muted">{totalScore}/100</div>
          </div>

          <div className="mb-6 space-y-4">
            {/* KYC Verified */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-nh-admin-text">KYC Verified</span>
              <button
                onClick={() => setTsKycVerified(!tsKycVerified)}
                className={`rounded-lg px-3 py-1 text-xs font-semibold transition-colors ${
                  tsKycVerified ? 'bg-nh-admin-success-bg text-nh-admin-success' : 'bg-nh-admin-border text-nh-admin-text-muted'
                }`}
              >
                {tsKycVerified ? 'Yes' : 'No'}
              </button>
            </div>

            {/* License Verified */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-nh-admin-text">License Verified</span>
              <button
                onClick={() => setTsLicenseVerified(!tsLicenseVerified)}
                className={`rounded-lg px-3 py-1 text-xs font-semibold transition-colors ${
                  tsLicenseVerified ? 'bg-nh-admin-success-bg text-nh-admin-success' : 'bg-nh-admin-border text-nh-admin-text-muted'
                }`}
              >
                {tsLicenseVerified ? 'Yes' : 'No'}
              </button>
            </div>

            {/* Insurance Verified */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-nh-admin-text">Insurance Verified</span>
              <button
                onClick={() => setTsInsuranceVerified(!tsInsuranceVerified)}
                className={`rounded-lg px-3 py-1 text-xs font-semibold transition-colors ${
                  tsInsuranceVerified ? 'bg-nh-admin-success-bg text-nh-admin-success' : 'bg-nh-admin-border text-nh-admin-text-muted'
                }`}
              >
                {tsInsuranceVerified ? 'Yes' : 'No'}
              </button>
            </div>

            {/* Average Rating */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm text-nh-admin-text">Average Rating</span>
                <span className="text-xs text-nh-admin-text-muted">{tsAvgRating.toFixed(1)} / 5.0</span>
              </div>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setTsAvgRating(star)}
                    className={`h-8 w-8 rounded-lg text-sm transition-colors ${
                      star <= Math.round(tsAvgRating)
                        ? 'bg-nh-admin-warning-bg text-nh-admin-warning'
                        : 'bg-nh-admin-border text-nh-admin-text-muted'
                    }`}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>

            {/* Manual rating input for fractional values */}
            <div>
              <input
                type="range"
                min="0"
                max="5"
                step="0.5"
                value={tsAvgRating}
                onChange={(e) => setTsAvgRating(parseFloat(e.target.value))}
                className="w-full accent-nh-admin-primary"
              />
              <div className="mt-1 flex justify-between text-[10px] text-nh-admin-text-muted">
                <span>0</span>
                <span>1</span>
                <span>2</span>
                <span>3</span>
                <span>4</span>
                <span>5</span>
              </div>
            </div>
          </div>

          {/* Score breakdown */}
          <div className="mb-6 rounded-xl border border-nh-admin-border bg-nh-admin-surface-elevated p-3">
            <div className="text-[11px] font-semibold text-nh-admin-text-secondary mb-2">SCORE BREAKDOWN</div>
            <div className="space-y-1 text-xs text-nh-admin-text-secondary">
              <div className="flex justify-between">
                <span>KYC (30 pts):</span>
                <span className={tsKycVerified ? 'text-nh-admin-success' : ''}>{tsKycVerified ? 30 : 0}/30</span>
              </div>
              <div className="flex justify-between">
                <span>License (25 pts):</span>
                <span className={tsLicenseVerified ? 'text-nh-admin-success' : ''}>{tsLicenseVerified ? 25 : 0}/25</span>
              </div>
              <div className="flex justify-between">
                <span>Insurance (25 pts):</span>
                <span className={tsInsuranceVerified ? 'text-nh-admin-success' : ''}>{tsInsuranceVerified ? 25 : 0}/25</span>
              </div>
              <div className="flex justify-between">
                <span>Rating (20 pts):</span>
                <span>{Math.round((tsAvgRating / 5) * 20)}/20</span>
              </div>
              <div className="border-t border-nh-admin-border pt-1 font-semibold text-nh-admin-text">
                <div className="flex justify-between">
                  <span>Total:</span>
                  <span>{totalScore}/100</span>
                </div>
              </div>
            </div>
          </div>

          {trustScoreError && (
            <div className="mb-4 rounded-xl border border-nh-admin-danger/30 bg-nh-admin-danger-bg p-3 text-xs text-nh-admin-danger">
              {trustScoreError}
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button
              onClick={() => { setTrustScoreItem(null); setTrustScore(null) }}
              className="rounded-xl border border-nh-admin-border px-4 py-2.5 text-sm text-nh-admin-text-secondary hover:text-nh-admin-text transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveTrustScore}
              disabled={savingTrustScore}
              className="flex items-center gap-2 rounded-xl bg-nh-admin-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-nh-admin-primary-90 transition-colors disabled:opacity-50"
            >
              {savingTrustScore ? 'Saving...' : 'Save Trust Score'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black text-nh-admin-text">
            KYC Verification
          </h1>
          <p className="mt-1 text-sm text-nh-admin-text-secondary">Identity & business verification submissions</p>
        </div>
        <button
          onClick={fetchKyc}
          className="flex items-center gap-2 rounded-xl border border-nh-admin-border bg-nh-admin-surface px-4 py-2 text-sm text-nh-admin-text transition-all hover:border-nh-admin-primary"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-nh-admin-border bg-nh-admin-surface-elevated p-1 w-fit">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setStatusFilter(''); setSearch('') }}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              tab === t.key
                ? 'bg-nh-admin-primary text-white'
                : 'text-nh-admin-text-secondary hover:text-nh-admin-text'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-nh-admin-text-muted" />
          <input
            type="text"
            placeholder="Search by name, email, or company..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-nh-admin-border bg-nh-admin-surface py-2.5 pl-10 pr-4 text-sm text-nh-admin-text placeholder-nh-admin-text-muted outline-none transition-all focus:border-nh-admin-primary-border"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-xl border border-nh-admin-border bg-nh-admin-surface px-4 py-2.5 text-sm text-nh-admin-text outline-none transition-all focus:border-nh-admin-primary-border"
        >
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="submitted">Submitted</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="draft">Draft</option>
          <option value="request_resubmit">Resubmit Requested</option>
        </select>
      </div>

      {error && (
        <div className="rounded-2xl border border-nh-admin-danger/30 bg-nh-admin-danger-bg p-4 text-sm text-nh-admin-danger">{error}</div>
      )}

      <div className="overflow-hidden rounded-2xl border border-nh-admin-border bg-nh-admin-surface">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-nh-admin-border border-t-nh-admin-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <Shield className="h-12 w-12 text-nh-admin-text-muted" />
            <p className="text-sm text-nh-admin-text-secondary">No KYC submissions found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            {tab === 'business' ? renderBusinessTable() : tab === 'level0' ? renderLevel0Table() : renderCommonTable(tab)}
          </div>
        )}
      </div>

      {/* Modals */}
      {renderReviewModal()}
      {renderDocPreviewModal()}
      {renderTrustScoreModal()}
    </div>
  )
}