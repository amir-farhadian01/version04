import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { StatusBar } from '../../components/ui/phone/StatusBar'
import { BottomNav, NavIcons } from '../../components/ui/phone/BottomNav'
import { useMyPosts, useSavedPosts, useDeletePost, type FeedPost } from '../../services/socialFeedApi'

type TabKey = 'posts' | 'stories' | 'saved'
type ViewMode = 'list' | 'grid'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'posts', label: 'Posts' },
  { key: 'stories', label: 'Stories' },
  { key: 'saved', label: 'Saved' },
]

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}

export default function MyPostsPage() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<TabKey>('posts')
  const [viewMode, setViewMode] = useState<ViewMode>('list')

  const { data: myPostsData, isLoading: loadingMy, error: errorMy, refetch: refetchMy } = useMyPosts()
  const { data: savedData, isLoading: loadingSaved, error: errorSaved, refetch: refetchSaved } = useSavedPosts()
  const deletePost = useDeletePost()

  const myPosts = myPostsData?.data ?? []
  const savedPosts = savedData?.data ?? []

  const handleDelete = async (postId: string) => {
    try { await deletePost.mutateAsync(postId) } catch { /* silently fail */ }
  }

  const getMediaThumb = (post: FeedPost): string | null => {
    if (post.media && post.media.length > 0) return post.media[0].url
    return null
  }

  const renderPostList = (posts: FeedPost[], loading: boolean, error: boolean, emptyMessage: string, showDelete: boolean = false) => {
    if (loading) {
      return (
        <div className="px-[14px] py-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-nh-surface rounded-xl p-3 my-2 flex gap-3 border border-nh-border">
              <div className="w-16 h-16 rounded-[10px] bg-nh-border-elevated shrink-0" />
              <div className="flex-1">
                <div className="h-3 w-[60%] bg-nh-border-elevated rounded mb-1.5" />
                <div className="h-2.5 w-[80%] bg-nh-border-elevated rounded" />
              </div>
            </div>
          ))}
        </div>
      )
    }

    if (error) {
      return (
        <div className="px-[14px] py-10 text-center">
          <div className="text-sm text-nh-text-muted mb-3">Failed to load</div>
          <div onClick={() => activeTab === 'saved' ? refetchSaved() : refetchMy()} className="inline-block px-5 py-2 bg-nh-primary text-white rounded-lg text-[13px] font-semibold cursor-pointer">Retry</div>
        </div>
      )
    }

    if (posts.length === 0) {
      return (
        <div className="px-[14px] py-10 text-center">
          <div className="text-[32px] mb-2">📭</div>
          <div className="text-sm text-nh-text-secondary">{emptyMessage}</div>
        </div>
      )
    }

    return (
      <div className={`${viewMode === 'grid' ? 'px-[14px] py-2 grid grid-cols-2 gap-2' : 'px-[14px] py-2'}`}>
        {posts.map((post) => (
          <div key={post.id} className={`bg-nh-surface rounded-xl border border-nh-border ${
            viewMode === 'grid'
              ? 'p-2 flex flex-col'
              : 'p-3 my-2 flex gap-3 items-center'
          }`}>
            <div className={`${viewMode === 'grid' ? 'w-full aspect-square' : 'w-16 h-16'} rounded-[10px] flex items-center justify-center text-2xl text-nh-text-muted overflow-hidden shrink-0`} style={{
              background: getMediaThumb(post) ? `url(${getMediaThumb(post)}) center/cover` : undefined,
              backgroundColor: getMediaThumb(post) ? undefined : 'var(--nh-surface-elevated)',
            }}>
              {!getMediaThumb(post) && '📷'}
            </div>
            <div className={`${viewMode === 'grid' ? 'mt-1.5' : 'flex-1 min-w-0'}`}>
              <div className={`text-xs font-semibold text-nh-text mb-1 ${viewMode === 'grid' ? 'line-clamp-2' : ''}`}>
                {post.caption ? post.caption.slice(0, viewMode === 'grid' ? 50 : 80) + (post.caption.length > (viewMode === 'grid' ? 50 : 80) ? '...' : '') : 'No caption'}
              </div>
              <div className={`text-[11px] text-nh-text-muted flex gap-2.5 items-center ${viewMode === 'grid' ? 'flex-wrap gap-x-1.5 gap-y-0.5' : ''}`}>
                <span>{post.category?.name ?? 'General'}</span>
                <span>❤ {post.likeCount}</span>
                <span>💬 {post.commentCount}</span>
                <span>{formatTimeAgo(post.createdAt)}</span>
              </div>
            </div>
            {showDelete && !(viewMode === 'grid') && (
              <div onClick={() => handleDelete(post.id)} className="text-sm text-nh-text-muted cursor-pointer p-1" title="Delete post">🗑</div>
            )}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="relative h-full flex flex-col bg-nh-bg">
      <StatusBar title="9:41" showNotifDot />
      <div className="flex items-center px-4 py-2.5 border-b border-nh-border gap-3 bg-nh-bg">
        <svg width="20" height="20" viewBox="0 0 24 24" className="fill-nh-text-secondary cursor-pointer" onClick={() => navigate(-1)}>
          <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
        </svg>
        <span className="flex-1 text-sm font-semibold text-nh-text">My Posts</span>
        {/* List / Grid toggle */}
        <button
          onClick={() => setViewMode(v => v === 'list' ? 'grid' : 'list')}
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-nh-border bg-nh-surface text-nh-text-secondary hover:text-nh-primary transition-colors"
          title={viewMode === 'list' ? 'Switch to grid view' : 'Switch to list view'}
        >
          {viewMode === 'list' ? (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
          ) : (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          )}
        </button>
      </div>
      <div className="flex bg-nh-bg border-b border-nh-border">
        {TABS.map((tab) => (
          <div
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-3 text-center text-[13px] font-medium cursor-pointer transition-all duration-200 border-b-2 ${
              activeTab === tab.key ? 'text-nh-primary border-nh-primary' : 'text-nh-text-muted border-transparent'
            }`}
          >
            {tab.label}
          </div>
        ))}
      </div>
      <div className="flex-1 overflow-auto">
        {/* Posts tab — no extra padding (no overlap issue) */}
        {activeTab === 'posts' && renderPostList(myPosts, loadingMy, !!errorMy, "You haven't created any posts yet", true)}
        {activeTab === 'stories' && (
          <div className="px-[14px] py-10 text-center">
            <div className="text-[32px] mb-2">📸</div>
            <div className="text-sm text-nh-text-secondary mb-1">Your stories</div>
            <div className="text-xs text-nh-text-muted">Active stories appear here. Expired stories will be greyed out.</div>
          </div>
        )}
        {/* Saved tab — padding-top added to prevent cards hiding behind tab bar */}
        {activeTab === 'saved' && <div className="pt-5">{renderPostList(savedPosts, loadingSaved, !!errorSaved, 'No saved posts yet', false)}</div>}
      </div>
      <div className="h-20" />
      <BottomNav
        items={[
          { id: 'home', label: 'Home', icon: NavIcons.home },
          { id: 'social', label: 'Explorer', icon: NavIcons.social },
          { id: 'activity', label: 'Activity', icon: NavIcons.activity },
          { id: 'biz', label: 'Business', isBiz: true, icon: NavIcons.business },
        ]}
      />
    </div>
  )
}