import { useState, useRef, useEffect } from 'react'
import { useAuthStore } from '../../store/authStore'
import { usePostComments, useCreateComment, useDeleteComment, type PostComment } from '../../services/socialFeedApi'

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

export default function CommentsSheet({ postId, onClose }: CommentsSheetProps) {
  const { user } = useAuthStore()
  const { data, isLoading, error } = usePostComments(postId)
  const createComment = useCreateComment()
  const deleteComment = useDeleteComment()
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const handleSubmit = async () => {
    if (!text.trim() || !user) return
    setSubmitting(true)
    try {
      await createComment.mutateAsync({ postId, text: text.trim() })
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

  const comments: PostComment[] = data?.data ?? []
  const getInitial = (author: PostComment['author']) => (author.displayName ?? 'U').charAt(0).toUpperCase()

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
            <div key={comment.id} className="flex gap-2.5 py-2 border-b border-nh-border">
              <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-[13px] text-white shrink-0 overflow-hidden"
                style={{ background: comment.author.avatarUrl ? `url(${comment.author.avatarUrl}) center/cover` : undefined }}>
                {!comment.author.avatarUrl && getInitial(comment.author)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-nh-text">{comment.author.displayName ?? 'User'}</span>
                  <span className="text-[10px] text-nh-text-muted">{formatTimeAgo(comment.createdAt)}</span>
                </div>
                <div className="text-[13px] text-nh-text-secondary leading-relaxed break-words mt-0.5">{comment.text}</div>
              </div>
              {user && user.id === comment.authorId && (
                <div onClick={() => handleDelete(comment.id)} className="text-[10px] text-nh-text-muted cursor-pointer px-1 py-0.5 self-start">🗑</div>
              )}
            </div>
          ))}
          <div className="h-2" />
        </div>

        {/* Input */}
        <div className="px-4 py-2.5 border-t border-nh-border flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add a comment..."
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