import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  useMyPosts,
  useSavedPosts,
  useDeletePost,
  type FeedPost,
} from '../../services/socialFeedApi'

type TabKey = 'posts' | 'stories' | 'saved'
type ViewMode = 'list' | 'grid'

interface Tab {
  key: TabKey
  label: string
}

const TABS: Tab[] = [
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

function getMediaThumb(post: FeedPost): string | null {
  if (post.media && post.media.length > 0) return post.media[0].url
  return null
}

export default function MyPostsTab() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<TabKey>('posts')
  const [viewMode, setViewMode] = useState<ViewMode>('list')

  const { data: myPostsData, isLoading: loadingMy, isError: errorMy, refetch: refetchMy } = useMyPosts()
  const { data: savedData, isLoading: loadingSaved, isError: errorSaved, refetch: refetchSaved } = useSavedPosts()
  const deletePost = useDeletePost()

  const myPosts = myPostsData?.data ?? []
  const savedPosts = savedData?.data ?? []

  const handleDelete = async (postId: string) => {
    try {
      await deletePost.mutateAsync(postId)
    } catch {
      // silently fail
    }
  }

  const handlePostClick = (post: FeedPost) => {
    navigate(`/explorer/comments`, { state: { postId: post.id } })
  }

  const renderPostList = (
    posts: FeedPost[],
    loading: boolean,
    error: boolean,
    emptyMessage: string,
    showDelete: boolean = false
  ) => {
    if (loading) {
      return (
        <div className="px-4 py-5 space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-xl border border-nh-border bg-nh-surface p-3 flex gap-3 animate-pulse"
            >
              <div className="w-16 h-16 rounded-lg bg-nh-surface-elevated flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-3/5 bg-nh-surface-elevated rounded" />
                <div className="h-2.5 w-4/5 bg-nh-surface-elevated rounded" />
              </div>
            </div>
          ))}
        </div>
      )
    }

    if (error) {
      return (
        <div className="px-4 py-10 text-center">
          <p className="text-sm text-nh-danger mb-3">Failed to load</p>
          <button
            onClick={() => (activeTab === 'saved' ? refetchSaved() : refetchMy())}
            className="rounded-xl bg-nh-primary px-4 py-2 text-xs font-bold text-white transition-all hover:bg-nh-primary-hover"
          >
            Retry
          </button>
        </div>
      )
    }

    if (posts.length === 0) {
      return (
        <div className="px-4 py-10 text-center">
          <div className="text-3xl mb-2">📭</div>
          <p className="text-sm text-nh-text-secondary">{emptyMessage}</p>
        </div>
      )
    }

    return (
      <div className={`${viewMode === 'grid' ? 'px-4 py-2 grid grid-cols-2 gap-2' : 'px-4 py-2 space-y-2'}`}>
        {posts.map((post) => (
          <div
            key={post.id}
            onClick={() => handlePostClick(post)}
            className={`rounded-xl border border-nh-border bg-nh-surface ${
              viewMode === 'grid'
                ? 'p-2 flex flex-col cursor-pointer hover:border-nh-primary transition-colors'
                : 'p-3 flex gap-3 items-center cursor-pointer hover:border-nh-primary transition-colors'
            }`}
          >
            {/* Thumbnail */}
            <div
              className={`${viewMode === 'grid' ? 'w-full aspect-square' : 'w-16 h-16'} rounded-lg flex-shrink-0 flex items-center justify-center text-2xl overflow-hidden`}
              style={{
                background: getMediaThumb(post)
                  ? `url(${getMediaThumb(post)}) center/cover`
                  : undefined,
                backgroundColor: getMediaThumb(post) ? undefined : 'var(--nh-surface-elevated)',
              }}
            >
              {!getMediaThumb(post) && '📷'}
            </div>

            {/* Info */}
            <div className={`${viewMode === 'grid' ? 'mt-1.5' : 'flex-1 min-w-0'}`}>
              <div className={`text-xs font-semibold text-nh-text mb-1 ${viewMode === 'grid' ? 'line-clamp-2' : 'truncate'}`}>
                {post.caption
                  ? post.caption.slice(0, viewMode === 'grid' ? 50 : 80) + (post.caption.length > (viewMode === 'grid' ? 50 : 80) ? '...' : '')
                  : 'No caption'}
              </div>
              <div className={`flex items-center gap-3 text-[10px] text-nh-text-muted ${viewMode === 'grid' ? 'flex-wrap gap-x-1.5 gap-y-0.5' : ''}`}>
                <span>{post.category?.name ?? 'General'}</span>
                <span>❤ {post.likeCount}</span>
                <span>💬 {post.commentCount}</span>
                <span>{formatTimeAgo(post.createdAt)}</span>
              </div>
            </div>

            {/* Delete action — hidden in grid mode */}
            {showDelete && viewMode !== 'grid' && (
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(post.id); }}
                className="text-nh-text-muted hover:text-nh-danger transition-colors p-1"
                title="Delete post"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                </svg>
              </button>
            )}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div>
      {/* Tabs: Posts | Stories | Saved — with list/grid toggle */}
      <div className="flex border-b border-nh-border sticky top-[60px] z-30 bg-nh-bg items-center">
        <div className="flex flex-1">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-3 text-center text-xs font-bold transition-all ${
                activeTab === tab.key
                  ? 'text-nh-primary border-b-2 border-nh-primary'
                  : 'text-nh-text-muted border-b-2 border-transparent hover:text-nh-text-secondary'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* List / Grid toggle */}
        {(activeTab === 'posts' || activeTab === 'saved') && (
          <button
            onClick={() => setViewMode(v => v === 'list' ? 'grid' : 'list')}
            className="w-7 h-7 mr-3 flex items-center justify-center rounded-lg border border-nh-border bg-nh-surface text-nh-text-secondary hover:text-nh-primary transition-colors flex-shrink-0"
            title={viewMode === 'list' ? 'Switch to grid view' : 'Switch to list view'}
          >
            {viewMode === 'list' ? (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
            ) : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            )}
          </button>
        )}
      </div>

      {/* Tab Content — pt-10 gives generous clearance from sticky tab bar */}
      <div className="pt-10">
        {activeTab === 'posts' &&
          renderPostList(myPosts, loadingMy, !!errorMy, "You haven't created any posts yet", true)}
        {activeTab === 'stories' && (
          <div className="px-4 py-10 text-center">
            <div className="text-3xl mb-2">📸</div>
            <p className="text-sm text-nh-text-secondary mb-1">Your stories</p>
            <p className="text-[11px] text-nh-text-muted">
              Active stories appear here. Expired stories will be greyed out.
            </p>
          </div>
        )}
        {activeTab === 'saved' &&
          renderPostList(savedPosts, loadingSaved, !!errorSaved, 'No saved posts yet', false)}
      </div>
    </div>
  )
}