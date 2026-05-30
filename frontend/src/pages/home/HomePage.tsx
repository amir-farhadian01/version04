import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import NeighbourhoodBanner from '../../components/home/NeighbourhoodBanner'
import UtilityIconsRow from '../../components/home/UtilityIconsRow'
import SearchBox from '../../components/home/SearchBox'
import NewsFeed from '../../components/home/NewsFeed'
import MyPostsTab from './MyPostsTab'

type SubTab = 'home' | 'myposts'

const SUB_TABS: { key: SubTab; label: string }[] = [
  { key: 'home', label: 'HOME' },
  { key: 'myposts', label: 'MY POSTS' },
]

export default function HomePage() {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('home')
  const { user } = useAuthStore()

  const displayName = user?.displayName || `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Neighbour'
  const initial = displayName.charAt(0).toUpperCase()

  const handleBannerExpand = () => {
    // Could scroll to banner or track analytics
  }

  return (
    <div className="flex flex-col min-h-screen bg-nh-bg">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-nh-bg/90 backdrop-blur-lg border-b border-nh-border">
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <h1 className="text-lg font-black text-nh-text font-heading">
              Good morning, {displayName.split(' ')[0]} 👋
            </h1>
            <p className="text-[11px] text-nh-text-muted mt-0.5">Your neighbourhood, your community</p>
          </div>
          <Link to="/profile" className="w-9 h-9 rounded-full bg-nh-primary flex items-center justify-center text-sm font-bold text-white cursor-pointer" aria-label="Profile">
            {initial}
          </Link>
        </div>

        {/* Sub-tabs */}
        <div className="flex gap-0 px-4 pb-0">
          {SUB_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveSubTab(tab.key)}
              className={`relative px-4 py-2.5 text-xs font-bold transition-all ${
                activeSubTab === tab.key
                  ? 'text-nh-primary'
                  : 'text-nh-text-muted hover:text-nh-text-secondary'
              }`}
            >
              {tab.label}
              {activeSubTab === tab.key && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-nh-primary rounded-full" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {activeSubTab === 'home' && (
          <div className="px-4 pt-3 pb-20 space-y-4">
            {/* Neighbourhood Banner */}
            <NeighbourhoodBanner
              neighbourhoodName="Your Neighbourhood"
              onExpand={handleBannerExpand}
            />

            {/* Utility Icons Row */}
            <UtilityIconsRow />

            {/* Search Box */}
            <SearchBox />

            {/* Local News & Events Feed */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-sm font-bold text-nh-text font-heading">
                  Local News & Events
                </h2>
                <span className="text-[10px] text-nh-text-muted">· swipe to explore</span>
              </div>
              <NewsFeed />
            </div>
          </div>
        )}

        {activeSubTab === 'myposts' && <MyPostsTab />}
      </div>
    </div>
  )
}