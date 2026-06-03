import { useParams, useNavigate } from 'react-router-dom'
import {
  usePostDetail,
  useToggleLike,
  useToggleSave,
  type FeedPost,
} from '../../services/socialFeedApi'

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

function PostMediaGallery({ media }: { media: FeedPost['media'] }) {
  if (media.length === 0) {
    return (
      <div className="w-full aspect-square bg-nh-surface-elevated flex items-center justify-center text-6xl">
        📷
      </div>
    )
  }
  return (
    <div className="w-full">
      <img
        src={media[0].url}
        alt="Post image"
        className="w-full object-cover max-h-[480px]"
        loading="lazy"
      />
    </div>
  )
}

export default function PostDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: post, isLoading, isError } = usePostDetail(id)

  const toggleLike = useToggleLike()
  const toggleSave = useToggleSave()

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center py-20">
        <div className="w-10 h-10 border-4 border-nh-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (isError || !post) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-20 px-4 text-center">
        <div className="text-4xl mb-3">😕</div>
        <p className="text-sm text-nh-text-secondary mb-4">
          Post not found or has been removed.
        </p>
        <button
          onClick={() => navigate(-1)}
          className="rounded-xl bg-nh-primary px-5 py-2 text-xs font-bold text-white transition-all hover:bg-nh-primary-hover"
        >
          Go Back
        </button>
      </div>
    )
  }

  const handleToggleLike = () => {
    toggleLike.mutate(post.id)
  }

  const handleToggleSave = () => {
    toggleSave.mutate(post.id)
  }

  return (
    <div className="flex-1 overflow-auto bg-nh-bg pb-20">
      {/* Back button */}
      <div className="sticky top-0 z-30 bg-nh-bg/90 backdrop-blur-lg border-b border-nh-border px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-nh-surface-elevated transition-colors"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" className="fill-nh-text-secondary">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
          </svg>
        </button>
        <span className="text-sm font-semibold text-nh-text">Post</span>
      </div>

      {/* Media */}
      <PostMediaGallery media={post.media} />

      {/* Post Info */}
      <div className="px-4 pt-4">
        {/* Author row */}
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-nh-primary flex items-center justify-center text-white text-sm font-bold">
            {(post.author?.displayName ?? 'U')[0].toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-semibold text-nh-text">
              {post.author?.displayName ?? 'User'}
            </p>
            <p className="text-[11px] text-nh-text-muted">
              {post.category?.name ?? 'General'} · {formatTimeAgo(post.publishedAt || post.createdAt)}
            </p>
          </div>
        </div>

        {/* Caption */}
        {post.caption && (
          <p className="text-sm text-nh-text leading-relaxed mb-4 whitespace-pre-wrap">
            {post.caption}
          </p>
        )}

        {/* Action bar — Like, Comment, Save */}
        <div className="flex items-center gap-2 border-t border-nh-border pt-3 mb-3">
          {/* Like button */}
          <button
            onClick={handleToggleLike}
            disabled={toggleLike.isPending}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              post.isLiked
                ? 'text-nh-danger bg-nh-danger/10'
                : 'text-nh-text-muted hover:text-nh-danger hover:bg-nh-surface-elevated'
            }`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill={post.isLiked ? 'var(--nh-danger)' : 'none'} stroke={post.isLiked ? 'var(--nh-danger)' : 'currentColor'} strokeWidth="2">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
            {post.likeCount}
          </button>

          {/* Comment count (non-interactive stat) */}
          <span className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-nh-text-muted font-semibold">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            {post.commentCount}
          </span>

          <div className="flex-1" />

          {/* Save / Unsave toggle */}
          <button
            onClick={handleToggleSave}
            disabled={toggleSave.isPending}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              post.isSaved
                ? 'text-nh-warning bg-nh-warning/10'
                : 'text-nh-text-muted hover:text-nh-warning hover:bg-nh-surface-elevated'
            }`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill={post.isSaved ? 'var(--nh-warning)' : 'none'} stroke={post.isSaved ? 'var(--nh-warning)' : 'currentColor'} strokeWidth="2">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
            </svg>
            {post.isSaved ? 'Saved' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}