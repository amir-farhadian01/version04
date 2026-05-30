import { useState } from 'react'

interface StaffMember {
  id: string
  displayName: string | null
  firstName: string | null
  lastName: string | null
  avatarUrl: string | null
}

interface PackageCard {
  name: string
  price: string
  unit: string
  accentClass: string
  tag: string | null
  desc: string
  photoRequired?: boolean
  staffMembers?: StaffMember[]
}

const PACKAGES: PackageCard[] = [
  {
    name: 'Standard Oil Change',
    price: '$69',
    unit: '/service',
    accentClass: 'text-nh-accent border-l-nh-accent',
    tag: 'Best Seller',
    desc: 'Includes oil + filter + 21-point check',
    photoRequired: true,
    staffMembers: [
      { id: '1', displayName: 'Mike R.', firstName: 'Mike', lastName: 'R.', avatarUrl: null },
      { id: '2', displayName: 'Sarah J.', firstName: 'Sarah', lastName: 'J.', avatarUrl: null },
      { id: '3', displayName: 'Tom K.', firstName: 'Tom', lastName: 'K.', avatarUrl: null },
      { id: '4', displayName: 'Lisa M.', firstName: 'Lisa', lastName: 'M.', avatarUrl: null },
    ],
  },
  {
    name: 'Full Vehicle Service',
    price: '$149',
    unit: '/service',
    accentClass: 'text-nh-primary border-l-nh-primary',
    tag: 'Recommended',
    desc: 'Brake inspection, fluid top-up, tire rotation',
    photoRequired: true,
    staffMembers: [
      { id: '5', displayName: 'Alex W.', firstName: 'Alex', lastName: 'W.', avatarUrl: null },
      { id: '6', displayName: 'Jenna P.', firstName: 'Jenna', lastName: 'P.', avatarUrl: null },
    ],
  },
  {
    name: 'Winter Prep Package',
    price: '$199',
    unit: '/service',
    accentClass: 'text-nh-success border-l-nh-success',
    tag: 'New',
    desc: 'Tires, battery, antifreeze, wipers',
    photoRequired: false,
    staffMembers: [],
  },
]

const TABS = ['Packages', 'Inventory', 'Reviews', 'About']

export default function ServiceDetail() {
  const [pkgTab, setPkgTab] = useState(0)

  return (
    <div className="flex-1 flex flex-col">
      {/* Back + Share header */}
      <div className="flex items-center px-4 py-2.5 border-b border-nh-border gap-3 bg-nh-bg">
        <svg width="20" height="20" viewBox="0 0 24 24" className="fill-nh-text-secondary cursor-pointer">
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
          <div className="h-[110px] relative" style={{ background: 'linear-gradient(135deg,#AC2B1A,#280A00)' }} />
          <div className="absolute -bottom-7 left-[18px] w-14 h-14 rounded-2xl bg-nh-accent border-[3px] border-nh-surface flex items-center justify-center text-[22px] font-bold text-white font-heading">
            A
          </div>
          <div className="absolute -bottom-7 left-[82px] bg-nh-primary rounded-lg px-2.5 py-1 text-[11px] font-semibold text-white flex items-center gap-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
            </svg>
            Verified
          </div>
        </div>

        {/* Business Info */}
        <div className="px-[18px] pt-10 pb-4">
          <div className="text-xl font-bold text-nh-text font-heading">
            AutoFix Vaughan
          </div>
          <div className="text-xs text-nh-text-muted my-1 mb-2">@autofix_vaughan · Auto Repair & Service</div>
          <div className="flex gap-1.5 flex-wrap mb-2">
            <div className="bg-nh-surface rounded-lg px-2.5 py-1 text-[11px] text-nh-text-secondary">⭐ 4.9 (184 reviews)</div>
            <div className="bg-nh-surface rounded-lg px-2.5 py-1 text-[11px] text-nh-text-secondary">🏆 12 yrs active</div>
            <div className="bg-nh-surface rounded-lg px-2.5 py-1 text-[11px] text-nh-text-secondary">📍 Vaughan, ON</div>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            <div className="bg-nh-surface-elevated border border-nh-success/30 rounded-lg px-2.5 py-1 text-[11px] text-nh-success">🛡️ Insured</div>
            <div className="bg-nh-surface-elevated border border-nh-warning/30 rounded-lg px-2.5 py-1 text-[11px] text-nh-warning">✅ Warranty</div>
            <div className="bg-nh-surface-elevated border border-nh-border rounded-lg px-2.5 py-1 text-[11px] text-nh-text-secondary">📋 Lic: ON-7823-AUTO</div>
          </div>
        </div>

        {/* Package Tabs */}
        <div className="flex bg-nh-bg border-b border-nh-border">
          {TABS.map((tab, i) => (
            <div
              key={tab}
              onClick={() => setPkgTab(i)}
              className={`flex-1 py-3 text-center text-[13px] font-medium cursor-pointer transition-all duration-200 border-b-2 ${
                pkgTab === i
                  ? 'text-nh-primary border-nh-primary'
                  : 'text-nh-text-muted border-transparent'
              }`}
            >
              {tab}
            </div>
          ))}
        </div>

        {/* Package Cards */}
        {PACKAGES.map((pkg, i) => {
          const accentText = pkg.accentClass.split(' ').find(c => c.startsWith('text-')) || 'text-nh-primary'
          return (
            <div
              key={i}
              className="bg-nh-surface rounded-[14px] mx-[14px] mt-3 p-[14px] border border-nh-border relative overflow-hidden"
            >
              {/* Left accent bar */}
              <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-[14px] bg-current ${accentText}`} />
              {/* Tag */}
              {pkg.tag && (
                <div className={`absolute top-3 right-3 rounded-lg px-2.5 py-0.5 text-[10px] font-bold bg-current/15 ${accentText}`}>
                  {pkg.tag}
                </div>
              )}
              <div className="pl-2">
                <div className="text-sm font-semibold text-nh-text mb-1 pr-[60px]">
                  {pkg.name}
                </div>
                <div className="text-[11px] text-nh-text-muted mb-2">{pkg.desc}</div>
                <div>
                  <span className={`text-2xl font-bold font-heading ${accentText}`}>
                    {pkg.price}
                  </span>
                  <span className="text-xs text-nh-text-muted ml-0.5">{pkg.unit}</span>
                </div>
                {/* Staff Avatar Row */}
                {pkg.staffMembers && pkg.staffMembers.length > 0 && (
                  <div className="flex gap-2 mt-2.5 items-center">
                    <div className="flex">
                      {pkg.staffMembers.slice(0, 3).map((s) => (
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
                      {pkg.staffMembers.length > 3
                        ? `${pkg.staffMembers.slice(0, 3).map(s => s.firstName ?? s.displayName).filter(Boolean).join(', ')} +${pkg.staffMembers.length - 3} more`
                        : pkg.staffMembers.map(s => s.firstName ?? s.displayName).filter(Boolean).join(', ')}
                    </span>
                  </div>
                )}
                {/* Photo Required Badge */}
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
                Add to Cart
              </div>
            </div>
          )
        })}

        {/* Custom Builder */}
        <div className="mx-[14px] mt-3 bg-nh-surface-elevated rounded-[14px] p-[14px] border border-nh-primary/20 flex items-center gap-3">
          <div className="w-10 h-10 bg-nh-primary/10 rounded-[10px] flex items-center justify-center shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" className="fill-nh-primary">
              <path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z" />
            </svg>
          </div>
          <div className="flex-1">
            <div className="text-[13px] font-semibold text-nh-primary">Build Custom Package</div>
            <div className="text-[11px] text-nh-text-secondary mt-0.5">Choose your own oil, filters & parts</div>
          </div>
          <div className="text-nh-primary text-xl">›</div>
        </div>

        <div className="h-[100px]" /> {/* space for floating nav */}
      </div>

    </div>
  )
}