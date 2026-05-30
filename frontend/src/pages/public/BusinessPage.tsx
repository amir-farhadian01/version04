import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../../lib/api'

interface StaffMember {
  id: string
  displayName: string | null
  firstName: string | null
  lastName: string | null
  avatarUrl: string | null
  isPrimary?: boolean
}

interface PackageItem {
  id: string
  name: string
  description: string | null
  price: number
  currency: string
  durationMinutes: number | null
  breakTimeMinutes: number | null
  bookingMode: string
  photoRequired: boolean
  assignedStaff: StaffMember[]
}

interface BusinessData {
  company: {
    id: string
    name: string
    slug: string | null
    slogan: string | null
    about: string | null
    logoUrl: string | null
    coverImageUrl: string | null
    address: string | null
    phone: string | null
    website: string | null
    type: string
    kycStatus: string
    location: unknown
  }
  trust: {
    licenseNumber: string | null
    licenseVerified: boolean
    hasLiabilityInsurance: boolean
    insuranceVerified: boolean
    experienceYears: number | null
    avgRating: number
    totalScore: number
    kycVerified: boolean
  }
  portfolio: {
    history: string | null
    mission: string | null
    galleryUrls: string[]
    businessHours: Record<string, { open: string; close: string }> | null
    tags: string[]
  }
  stats: {
    totalServices: number
    totalStaff: number
    totalReviews: number
    totalOrders: number
  }
}

interface ReviewItem {
  id: string
  rating: number
  reviewText: string | null
  createdAt: string
  customer: {
    id: string
    displayName: string | null
    firstName: string | null
    lastName: string | null
    avatarUrl: string | null
  }
  serviceName: string | null
}

const TABS = ['Services', 'About', 'Reviews', 'Gallery']

export default function BusinessPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [data, setData] = useState<BusinessData | null>(null)
  const [packages, setPackages] = useState<PackageItem[]>([])
  const [reviews, setReviews] = useState<ReviewItem[]>([])
  const [activeTab, setActiveTab] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    Promise.all([
      api.get(`/business-page/${id}`),
      api.get(`/business-page/${id}/services`),
      api.get(`/business-page/${id}/reviews`),
    ])
      .then(([profileRes, servicesRes, reviewsRes]) => {
        setData(profileRes.data)
        setPackages(servicesRes.data.items ?? [])
        setReviews(reviewsRes.data.items ?? [])
      })
      .catch((err) => {
        setError(err?.response?.data?.error ?? 'Failed to load business profile')
      })
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-nh-text-secondary">
        Loading...
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-nh-danger">
        {error ?? 'Business not found'}
      </div>
    )
  }

  const { company, trust, portfolio, stats } = data

  return (
    <div className="flex-1 flex flex-col">
      {/* Back + Share header */}
      <div className="flex items-center px-4 py-2.5 border-b border-nh-border gap-3 bg-nh-bg">
        <svg width="20" height="20" viewBox="0 0 24 24" className="fill-nh-text-secondary cursor-pointer" onClick={() => navigate(-1)}>
          <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
        </svg>
        <span className="flex-1 text-sm font-semibold text-nh-text">Business Profile</span>
        <svg width="20" height="20" viewBox="0 0 24 24" className="fill-nh-text-secondary cursor-pointer">
          <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z" />
        </svg>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto scrollbar-none">
        {/* Cover + Logo */}
        <div className="relative">
          <div
            className="h-[110px] relative"
            style={{
              background: company.coverImageUrl
                ? `url(${company.coverImageUrl}) center/cover`
                : 'linear-gradient(135deg,#AC2B1A,#280A00)',
            }}
          />
          <div className="absolute -bottom-7 left-[18px] w-14 h-14 rounded-2xl border-[3px] border-nh-surface flex items-center justify-center text-[22px] font-bold text-white font-heading overflow-hidden"
            style={{ background: company.logoUrl ? `url(${company.logoUrl}) center/cover` : undefined }}
          >
            {!company.logoUrl && (company.name?.[0] ?? 'B').toUpperCase()}
          </div>
          {trust.kycVerified && (
            <div className="absolute -bottom-7 left-[82px] bg-nh-primary rounded-lg px-2.5 py-1 text-[11px] font-semibold text-white flex items-center gap-1">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
              </svg>
              Verified
            </div>
          )}
        </div>

        {/* Business Info */}
        <div className="px-[18px] pt-10 pb-4">
          <div className="text-xl font-bold text-nh-text font-heading">
            {company.name}
          </div>
          <div className="text-xs text-nh-text-muted my-1 mb-2">
            {company.slogan ? `@${company.slug ?? company.name.toLowerCase().replace(/\s+/g, '_')} · ${company.slogan}` : `@${company.slug ?? company.name.toLowerCase().replace(/\s+/g, '_')}`}
          </div>
          <div className="flex gap-1.5 flex-wrap mb-2">
            {trust.avgRating > 0 && (
              <div className="bg-nh-surface rounded-lg px-2.5 py-1 text-[11px] text-nh-text-secondary">
                ⭐ {trust.avgRating.toFixed(1)} ({stats.totalReviews} reviews)
              </div>
            )}
            {trust.experienceYears != null && (
              <div className="bg-nh-surface rounded-lg px-2.5 py-1 text-[11px] text-nh-text-secondary">
                🏆 {trust.experienceYears} yrs active
              </div>
            )}
            {company.address && (
              <div className="bg-nh-surface rounded-lg px-2.5 py-1 text-[11px] text-nh-text-secondary">
                📍 {company.address}
              </div>
            )}
          </div>
          {/* Trust Badges */}
          <div className="flex gap-1.5 flex-wrap">
            {trust.hasLiabilityInsurance && (
              <div className="bg-nh-surface-elevated border border-nh-success/30 rounded-lg px-2.5 py-1 text-[11px] text-nh-success">
                🛡️ Insured
              </div>
            )}
            {trust.licenseVerified && (
              <div className="bg-nh-surface-elevated border border-nh-border rounded-lg px-2.5 py-1 text-[11px] text-nh-text-secondary">
                📋 Lic: {trust.licenseNumber ?? 'Verified'}
              </div>
            )}
            {trust.totalScore > 0 && (
              <div className="bg-nh-surface-elevated border border-nh-warning/30 rounded-lg px-2.5 py-1 text-[11px] text-nh-warning">
                🏅 Score: {trust.totalScore.toFixed(0)}
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex bg-nh-bg border-b border-nh-border">
          {TABS.map((tab, i) => (
            <div
              key={tab}
              onClick={() => setActiveTab(i)}
              className={`flex-1 py-3 text-center text-[13px] font-medium cursor-pointer transition-all duration-200 border-b-2 ${
                activeTab === i
                  ? 'text-nh-primary border-nh-primary'
                  : 'text-nh-text-muted border-transparent'
              }`}
            >
              {tab}
            </div>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 0 && (
          <div>
            {packages.length === 0 && (
              <div className="p-6 text-center text-[13px] text-nh-text-muted">
                No services available yet
              </div>
            )}
            {packages.map((pkg) => (
              <div
                key={pkg.id}
                className="bg-nh-surface rounded-[14px] mx-[14px] mt-3 p-[14px] border border-nh-border relative overflow-hidden"
              >
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-nh-primary rounded-l-[14px]" />
                <div className="pl-2">
                  <div className="text-sm font-semibold text-nh-text mb-1">
                    {pkg.name}
                  </div>
                  {pkg.description && (
                    <div className="text-[11px] text-nh-text-muted mb-2">{pkg.description}</div>
                  )}
                  <div>
                    <span className="text-2xl font-bold font-heading text-nh-primary">
                      ${pkg.price.toFixed(2)}
                    </span>
                    <span className="text-xs text-nh-text-muted ml-0.5">{pkg.currency}</span>
                  </div>
                  {pkg.durationMinutes && (
                    <div className="text-[11px] text-nh-text-muted mt-1">
                      ⏱ {pkg.durationMinutes} min
                    </div>
                  )}
                  {/* Staff Avatar Row */}
                  {pkg.assignedStaff.length > 0 && (
                    <div className="flex gap-2 mt-2.5 items-center">
                      <div className="flex">
                        {pkg.assignedStaff.slice(0, 3).map((s) => (
                          <div
                            key={s.id}
                            className="w-[26px] h-[26px] rounded-full border-2 border-nh-surface -ml-1.5 bg-nh-surface-elevated flex items-center justify-center text-[10px] font-semibold text-nh-text-secondary overflow-hidden shrink-0"
                            title={s.displayName ?? `${s.firstName ?? ''} ${s.lastName ?? ''}`}
                          >
                            {s.avatarUrl ? (
                              <img src={s.avatarUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              (s.firstName?.[0] ?? s.displayName?.[0] ?? '?').toUpperCase()
                            )}
                          </div>
                        ))}
                      </div>
                      <span className="text-[10px] text-nh-text-muted">
                        {pkg.assignedStaff.length > 3
                          ? `${pkg.assignedStaff.slice(0, 3).map(s => s.firstName ?? s.displayName).filter(Boolean).join(', ')} +${pkg.assignedStaff.length - 3} more`
                          : pkg.assignedStaff.map(s => s.firstName ?? s.displayName).filter(Boolean).join(', ')}
                      </span>
                    </div>
                  )}
                  {pkg.photoRequired && (
                    <div className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-md bg-nh-warning/15 text-[10px] font-semibold text-nh-warning">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                      </svg>
                      Photo Required
                    </div>
                  )}
                </div>
                <div className="absolute bottom-[14px] right-[14px] bg-nh-primary rounded-lg px-[14px] py-1.5 text-[11px] font-bold text-white cursor-pointer">
                  Book Now
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 1 && (
          <div className="p-[18px]">
            {portfolio.history && (
              <div className="mb-4">
                <div className="text-sm font-semibold text-nh-text mb-1.5">Our Story</div>
                <div className="text-xs text-nh-text-secondary leading-relaxed">{portfolio.history}</div>
              </div>
            )}
            {portfolio.mission && (
              <div className="mb-4">
                <div className="text-sm font-semibold text-nh-text mb-1.5">Mission</div>
                <div className="text-xs text-nh-text-secondary leading-relaxed">{portfolio.mission}</div>
              </div>
            )}
            {company.about && (
              <div className="mb-4">
                <div className="text-sm font-semibold text-nh-text mb-1.5">About</div>
                <div className="text-xs text-nh-text-secondary leading-relaxed">{company.about}</div>
              </div>
            )}
            {portfolio.tags.length > 0 && (
              <div>
                <div className="text-sm font-semibold text-nh-text mb-1.5">Tags</div>
                <div className="flex gap-1.5 flex-wrap">
                  {portfolio.tags.map((tag) => (
                    <span key={tag} className="bg-nh-surface-elevated rounded-md px-2 py-0.5 text-[11px] text-nh-text-secondary">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {!portfolio.history && !portfolio.mission && !company.about && portfolio.tags.length === 0 && (
              <div className="text-center text-[13px] text-nh-text-muted p-6">
                No information available
              </div>
            )}
          </div>
        )}

        {activeTab === 2 && (
          <div className="p-[18px]">
            {reviews.length === 0 && (
              <div className="text-center text-[13px] text-nh-text-muted p-6">
                No reviews yet
              </div>
            )}
            {reviews.map((review) => (
              <div
                key={review.id}
                className="bg-nh-surface rounded-xl p-[14px] mb-2.5 border border-nh-border"
              >
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="w-8 h-8 rounded-full bg-nh-surface-elevated flex items-center justify-center text-xs font-semibold text-nh-text-secondary overflow-hidden shrink-0">
                    {review.customer.avatarUrl ? (
                      <img src={review.customer.avatarUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      (review.customer.firstName?.[0] ?? review.customer.displayName?.[0] ?? '?').toUpperCase()
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="text-xs font-semibold text-nh-text">
                      {review.customer.displayName ?? `${review.customer.firstName ?? ''} ${review.customer.lastName ?? ''}`}
                    </div>
                    <div className="text-[10px] text-nh-text-muted">
                      {'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)} · {new Date(review.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  {review.serviceName && (
                    <div className="text-[10px] text-nh-text-muted bg-nh-surface-elevated rounded-md px-1.5 py-0.5">
                      {review.serviceName}
                    </div>
                  )}
                </div>
                {review.reviewText && (
                  <div className="text-xs text-nh-text-secondary leading-relaxed">{review.reviewText}</div>
                )}
              </div>
            ))}
          </div>
        )}

        {activeTab === 3 && (
          <div className="p-[18px]">
            {portfolio.galleryUrls.length === 0 ? (
              <div className="text-center text-[13px] text-nh-text-muted p-6">
                No gallery images yet
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {portfolio.galleryUrls.map((url, i) => (
                  <div
                    key={i}
                    className="aspect-square rounded-[10px] overflow-hidden bg-nh-surface-elevated"
                  >
                    <img src={url} alt={`Gallery ${i + 1}`} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="h-[100px]" /> {/* space for floating nav */}
      </div>

    </div>
  )
}