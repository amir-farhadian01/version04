import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { useToggleLike, useToggleSave, type FeedPost } from '../../services/socialFeedApi'
import FollowButton from './FollowButton'
import CommentsSheet from './CommentsSheet'

interface PostCardProps {
  post: FeedPost
}

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

function getAuthorName(author: FeedPost['author']): string {
  return author.displayName ?? 'User'
}

function getAuthorInitial(author: FeedPost['author']): string {
  return getAuthorName(author).charAt(0).toUpperCase()
}

export default function PostCard({ post }: PostCardProps) {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const toggleLike = useToggleLike()
  const toggleSave = useToggleSave()
  const [showComments, setShowComments] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [mediaIndex, setMediaIndex] = useState(0)
  const [liked, setLiked] = useState(post.isLiked)
  const [saved, setSaved] = useState(post.isSaved)
  const [likeCount, setLikeCount] = useState(post.likeCount)

  const authorName = getAuthorName(post.author)

  const handleLike = async () => {
    if (!user) return
    const prevLiked = liked
    setLiked(!liked)
    setLikeCount((c) => c + (liked ? -1 : 1))
    try {
      const result = await toggleLike.mutateAsync(post.id)
      setLiked(result.liked)
    } catch {
      setLiked(prevLiked)
      setLikeCount((c) => c + (prevLiked ? 1 : -1))
    }
  }

  const handleSave = async () => {
    if (!user) return
    const prevSaved = saved
    setSaved(!saved)
    try {
      const result = await toggleSave.mutateAsync(post.id)
      setSaved(result.saved)
    } catch { setSaved(prevSaved) }
  }

  const navigateToBusiness = () => {
    if (!post.isBusinessPost) return;
    const bizId = post.author.companyId;
    if (bizId) navigate(`/biz/${bizId}`);
  }

  return (
    <>
      <div className="bg-nh-surface rounded-2xl mx-[14px] mt-3 border border-nh-border overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2.5 px-3 py-2.5">
          <div onClick={navigateToBusiness} style={{ cursor: post.isBusinessPost ? 'pointer' : 'default' }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-base font-heading shrink-0 overflow-hidden"
              style={{ background: post.author.avatarUrl ? `url(${post.author.avatarUrl}) center/cover` : undefined }}>
              {!post.author.avatarUrl && getAuthorInitial(post.author)}
            </div>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-1.5">
              <span onClick={navigateToBusiness} className={`text-[13px] font-semibold text-nh-text ${post.isBusinessPost ? 'cursor-pointer' : 'cursor-default'}`}>{authorName}</span>
              {post.isBusinessPost && (
                <span className="text-[10px] font-semibold text-nh-accent bg-nh-accent/15 rounded px-1.5 py-0.5">BUSINESS</span>
              )}
            </div>
            <div className="text-[11px] text-nh-text-muted flex items-center gap-1.5">
              <span onClick={navigateToBusiness} style={{ cursor: post.isBusinessPost ? 'pointer' : 'default' }}>{post.category?.name ?? 'General'}</span>
              <span>·</span>
              <span>{formatTimeAgo(post.publishedAt || post.createdAt)}</span>
              {post.location?.city && <><span>·</span><span>{post.location.city}</span></>}
            </div>
          </div>
          {/* Follow Button (non-business posts, not self) */}
          {user && user.id !== post.authorId && !post.isBusinessPost && (
            <FollowButton userId={post.authorId} size="sm" />
          )}

          {/* Three-dot menu */}
          <div className="relative">
            <div onClick={() => setShowMenu(!showMenu)} className="text-xl text-nh-text-muted cursor-pointer leading-none px-1.5 py-0.5 select-none">···</div>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 top-7 z-50 bg-nh-surface rounded-[10px] border border-nh-border shadow-lg min-w-[160px] overflow-hidden">
                  {post.isBusinessPost ? (
                    <>
                       <div onClick={() => { const bizId = post.author.companyId; if (bizId) { navigate(`/biz/${bizId}`); } setShowMenu(false) }} className="px-[14px] py-2.5 text-xs text-nh-text cursor-pointer border-b border-nh-border">View Business Page</div>
                      {post.linkedService && (
                        <div onClick={() => { navigate(`/services/${post.linkedService!.id}`); setShowMenu(false) }} className="px-[14px] py-2.5 text-xs text-nh-text cursor-pointer border-b border-nh-border">View Service</div>
                      )}
                    </>
                  ) : (
                    <>
                      <div onClick={() => { setShowMenu(false) }} className="px-[14px] py-2.5 text-xs text-nh-text cursor-pointer border-b border-nh-border">Report</div>
                      <div onClick={() => { setShowMenu(false) }} className="px-[14px] py-2.5 text-xs text-nh-danger cursor-pointer">Block User</div>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Media */}
        {post.media && post.media.length > 0 && (
          <div className="relative">
            <div className="w-full bg-nh-surface flex items-center justify-center overflow-hidden relative"
              style={{ aspectRatio: post.media[mediaIndex]?.type === 'video' ? '9/16' : '4/3' }}>
              {post.media[mediaIndex]?.type === 'video' ? (
                <video src={post.media[mediaIndex].url} className="w-full h-full object-cover" autoPlay muted loop playsInline />
              ) : (
                <img src={post.media[mediaIndex].url} alt="" loading="lazy" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
              )}
            </div>
            {/* Swipe indicators */}
            {post.media.length > 1 && (
              <>
                {mediaIndex > 0 && (
                  <div onClick={() => setMediaIndex((i) => i - 1)} className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/50 flex items-center justify-center cursor-pointer text-white text-base">‹</div>
                )}
                {mediaIndex < post.media.length - 1 && (
                  <div onClick={() => setMediaIndex((i) => i + 1)} className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/50 flex items-center justify-center cursor-pointer text-white text-base">›</div>
                )}
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                  {post.media.map((_, i) => (
                    <div key={i} className={`w-1.5 h-1.5 rounded-full ${i === mediaIndex ? 'bg-nh-primary' : 'bg-white/50'}`} />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Caption */}
        {post.caption && (
          <div className="px-3 pt-2.5">
            <div className="text-[13px] text-nh-text leading-relaxed">
              <span className="font-semibold mr-1.5">{authorName}</span>{post.caption}
            </div>
          </div>
        )}

          {/* Linked Service CTA */}
          {post.linkedService && (
            <div className="px-3 pt-2">
              <div className="bg-nh-surface-elevated rounded-lg px-3 py-2 flex items-center gap-2 border border-nh-border">
                <div className="flex-1">
                  <div className="text-[11px] text-nh-text-muted">Bookable service</div>
                  <div className="text-[13px] font-semibold text-nh-primary">{post.linkedService.name}</div>
                </div>
                <div
                  className="bg-nh-primary text-white rounded-md px-2.5 py-1 text-[11px] font-semibold cursor-pointer hover:opacity-90"
                  onClick={(e) => {
                    e.stopPropagation()
                    navigate(`/order/new?serviceId=${post.linkedService!.id}`)
                  }}
                >
                  Book Now
                </div>
              </div>
            </div>
          )}

          {/* Order CTA for business posts without linkedService */}
          {!post.linkedService && post.isBusinessPost && (
            <div className="px-3 pt-2">
              <div
                className="bg-nh-primary text-white rounded-lg px-3 py-2 flex items-center justify-center gap-2 cursor-pointer hover:opacity-90"
                onClick={(e) => {
                  e.stopPropagation()
                  const bizId = post.author.companyId;
                  if (bizId) navigate(`/biz/${bizId}?action=order`)
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18M16 10a4 4 0 01-8 0" />
                </svg>
                <span className="text-[12px] font-semibold">Order Service</span>
              </div>
            </div>
          )}

        {/* Action Bar */}
        <div className="flex gap-4 px-3 py-2.5 items-center">
          {/* Like */}
          <div onClick={handleLike} className={`flex items-center gap-1 text-xs cursor-pointer select-none transition-colors ${liked ? 'text-nh-danger' : 'text-nh-text-muted'}`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill={liked ? 'var(--nh-danger)' : 'none'} stroke={liked ? 'var(--nh-danger)' : 'currentColor'} strokeWidth={liked ? 0 : 2}>
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
            {likeCount}
          </div>
          {/* Comment */}
          <div onClick={() => setShowComments(true)} className="flex items-center gap-1 text-xs text-nh-text-muted cursor-pointer select-none">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
            {post.commentCount}
          </div>
          {/* Direct Message */}
          <div className="flex items-center gap-1 text-xs text-nh-text-muted cursor-pointer select-none">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /></svg>
          </div>
          {/* Save */}
          <div onClick={handleSave} className={`ml-auto text-xs cursor-pointer select-none ${saved ? 'text-nh-warning' : 'text-nh-text-muted'}`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill={saved ? 'var(--nh-warning)' : 'none'} stroke={saved ? 'var(--nh-warning)' : 'currentColor'} strokeWidth={2}>
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
            </svg>
          </div>
        </div>
      </div>

      {showComments && <CommentsSheet postId={post.id} onClose={() => setShowComments(false)} />}
    </>
  )
}