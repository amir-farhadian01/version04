import { useState, useRef, useEffect } from 'react'
import { useAuthStore } from '../../store/authStore'
import {
  usePostComments,
  useCreateComment,
  useDeleteComment,
  useToggleCommentLike,
  usePostReplies,
  useCreateReply,
  type PostComment,
} from '../../services/socialFeedApi'

interface CommentsSheetProps {
  postId: string
  onClose: () => void
}

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.floor(hrs / 24)
  return `${days}d`
}

function getInitial(name: string | null | undefined): string {
  return (name ?? 'U').charAt(0).toUpperCase()
}

/** Single comment row with like/reply actions */
function CommentRow({
  comment,
  postId,
  user,
  onReply,
  onDelete,
  onToggleLike,
}: {
  comment: PostComment
  postId: string
  user: { id: string } | null
  onReply: (commentId: string, authorName: string) => void
  onDelete: (commentId: string) => void
  onToggleLike: (commentId: string) => void
}) {
  const [showReplies, setShowReplies] = useState(false)
  const { data: repliesData } = usePostReplies(postId, comment.id)
  const replies = (showReplies ? repliesData?.data : undefined) ?? []
  const isLiked = comment.isLiked

  return (
    <div>
      <div className="flex gap-2.5 py-2">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-[13px] text-white shrink-0 overflow-hidden"
          style={{ background: comment.author.avatarUrl ? `url(${comment.author.avatarUrl}) center/cover` : undefined }}
        >
          {!comment.author.avatarUrl && getInitial(comment.author.displayName)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-nh-text">{comment.author.displayName ?? 'User'}</span>
            <span className="text-[10px] text-nh-text-muted">{formatTimeAgo(comment.createdAt)}</span>
          </div>
          <div className="text-[13px] text-nh-text-secondary leading-relaxed break-words mt-0.5">{comment.text}</div>
          {/* Attachments */}
          {comment.attachments && comment.attachments.length > 0 && (
            <div className="flex gap-1.5 mt-1.5 flex-wrap">
              {comment.attachments.map((att) => (
                <div key={att.id} className="w-16 h-16 rounded-md overflow-hidden bg-nh-surface-elevated border border-nh-border">
                  {att.type === 'image' ? (
                    <img src={att.url} alt="" className="w-full h-full object-cover" />
                  ) : att.type === 'video' ? (
                    <video src={att.url} className="w-full h-full object-cover" muted />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[10px] text-nh-text-muted px-1 text-center leading-tight">
                      {att.fileName ?? 'File'}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          {/* Actions: like + reply + delete */}
          <div className="flex items-center gap-3 mt-1">
            <div onClick={() => onToggleLike(comment.id)} className={`flex items-center gap-1 text-[11px] cursor-pointer select-none ${isLiked ? 'text-nh-danger' : 'text-nh-text-muted'}`}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill={isLiked ? 'var(--nh-danger)' : 'none'} stroke={isLiked ? 'var(--nh-danger)' : 'currentColor'} strokeWidth={isLiked ? 0 : 2}>
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
              {comment.likeCount > 0 && comment.likeCount}
            </div>
            <div onClick={() => onReply(comment.id, comment.author.displayName ?? 'User')} className="text-[11px] text-nh-text-muted cursor-pointer font-semibold">Reply</div>
            {user && user.id === comment.authorId && (
              <div onClick={() => onDelete(comment.id)} className="text-[10px] text-nh-text-muted cursor-pointer ml-auto">🗑</div>
            )}
          </div>

          {/* View/Hide replies */}
          {comment.replyCount > 0 && (
            <div onClick={() => setShowReplies(!showReplies)} className="text-[11px] text-nh-text-muted font-semibold cursor-pointer mt-1.5 ml-0">
              {showReplies ? 'Hide replies' : `View ${comment.replyCount} ${comment.replyCount === 1 ? 'reply' : 'replies'}`}
            </div>
          )}

          {/* Replies list (indented) */}
          {showReplies && replies.length > 0 && (
            <div className="ml-9 mt-1 border-l-2 border-nh-border pl-3">
              {replies.map((reply) => (
                <div key={reply.id} className="flex gap-2 py-1.5">
                  <div
                    className="w-6 h-6 rounded-md flex items-center justify-center font-bold text-[10px] text-white shrink-0 overflow-hidden"
                    style={{ background: reply.author.avatarUrl ? `url(${reply.author.avatarUrl}) center/cover` : undefined }}
                  >
                    {!reply.author.avatarUrl && getInitial(reply.author.displayName)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="text-[11px] font-semibold text-nh-text">{reply.author.displayName ?? 'User'}</span>
                      <span className="text-[9px] text-nh-text-muted">{formatTimeAgo(reply.createdAt)}</span>
                    </div>
                    <div className="text-[12px] text-nh-text-secondary break-words mt-0.5">{reply.text}</div>
                    <div onClick={() => onToggleLike(reply.id)} className={`flex items-center gap-1 text-[10px] cursor-pointer select-none mt-1 ${reply.isLiked ? 'text-nh-danger' : 'text-nh-text-muted'}`}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill={reply.isLiked ? 'var(--nh-danger)' : 'none'} stroke={reply.isLiked ? 'var(--nh-danger)' : 'currentColor'} strokeWidth={reply.isLiked ? 0 : 2}>
                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                      </svg>
                      {reply.likeCount > 0 && reply.likeCount}
                    </div>
                  </div>
                  {user && user.id === reply.authorId && (
                    <div onClick={() => onDelete(reply.id)} className="text-[9px] text-nh-text-muted cursor-pointer self-start">🗑</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function CommentsSheet({ postId, onClose }: CommentsSheetProps) {
  const { user } = useAuthStore()
  const { data, isLoading, error } = usePostComments(postId)
  const createComment = useCreateComment()
  const createReply = useCreateReply()
  const deleteComment = useDeleteComment()
  const toggleCommentLike = useToggleCommentLike()
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const handleSubmit = async () => {
    if (!text.trim() || !user) return
    setSubmitting(true)
    try {
      if (replyTo) {
        await createReply.mutateAsync({ postId, parentId: replyTo.id, text: text.trim() })
        setReplyTo(null)
      } else {
        await createComment.mutateAsync({ postId, text: text.trim() })
      }
      setText('')
      setTimeout(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' }) }, 100)
    } catch { /* silently fail */ } finally { setSubmitting(false) }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit() }
  }

  const handleDelete = async (commentId: string) => {
    try { await deleteComment.mutateAsync({ postId, commentId }) } catch { /* silently fail */ }
  }

  const handleToggleLike = async (commentId: string) => {
    try { await toggleCommentLike.mutateAsync({ postId, commentId }) } catch { /* silently fail */ }
  }

  const handleReply = (commentId: string, authorName: string) => {
    setReplyTo({ id: commentId, name: authorName })
    inputRef.current?.focus()
  }

  const cancelReply = () => setReplyTo(null)

  const comments: PostComment[] = data?.data ?? []

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center">
      {/* Backdrop */}
      <div onClick={onClose} className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Sheet */}
      <div className="relative w-full max-w-[600px] max-h-[80vh] bg-nh-surface rounded-t-[20px] flex flex-col overflow-hidden border border-nh-border border-b-0">
        {/* Handle + Title */}
        <div className="px-4 pt-3 pb-2 border-b border-nh-border flex items-center relative">
          <div className="w-10 h-1 rounded-sm bg-nh-border mx-auto absolute left-1/2 -translate-x-1/2 top-2" />
          <span className="text-[15px] font-semibold text-nh-text flex-1 mt-1">Comments</span>
          <div onClick={onClose} className="text-xl text-nh-text-muted cursor-pointer px-1">×</div>
        </div>

        {/* Comments List */}
        <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-2">
          {isLoading && <div className="py-6 text-center text-[13px] text-nh-text-muted">Loading comments...</div>}
          {error && <div className="py-6 text-center text-[13px] text-nh-danger">Could not load comments</div>}
          {!isLoading && !error && comments.length === 0 && (
            <div className="py-8 text-center text-[13px] text-nh-text-muted">
              <div className="text-[32px] mb-2">💬</div>No comments yet. Be the first!
            </div>
          )}
          {comments.map((comment) => (
            <CommentRow
              key={comment.id}
              comment={comment}
              postId={postId}
              user={user}
              onReply={handleReply}
              onDelete={handleDelete}
              onToggleLike={handleToggleLike}
            />
          ))}
          <div className="h-2" />
        </div>

        {/* Reply indicator */}
        {replyTo && (
          <div className="px-4 py-1.5 flex items-center gap-2 text-[11px] text-nh-text-muted border-t border-nh-border">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polyline points="9 17 4 12 9 7" /><path d="M20 18v-2a4 4 0 0 0-4-4H4" /></svg>
            <span className="flex-1">Replying to {replyTo.name}</span>
            <div onClick={cancelReply} className="cursor-pointer text-nh-danger font-semibold">Cancel</div>
          </div>
        )}

        {/* Input */}
        <div className="px-4 py-2.5 border-t border-nh-border flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={replyTo ? `Reply to ${replyTo.name}...` : 'Add a comment...'}
            rows={1}
            className="flex-1 bg-nh-surface border border-nh-border rounded-xl px-3 py-2 text-[13px] text-nh-text resize-none outline-none max-h-[100px] font-inherit"
          />
          <div onClick={handleSubmit}
            className={`rounded-lg px-[14px] py-1.5 text-xs font-semibold whitespace-nowrap ${
              text.trim() ? 'bg-nh-primary text-white cursor-pointer' : 'bg-nh-border-elevated text-nh-text-muted cursor-default'
            } ${submitting ? 'opacity-60' : ''}`}>
            {submitting ? '...' : 'Post'}
          </div>
        </div>
      </div>
    </div>
  )
}