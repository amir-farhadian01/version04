import { useState, useEffect, useCallback, useRef } from 'react'

interface StoryAuthor {
  id: string
  displayName: string
  avatarUrl: string | null
}

interface Story {
  id: string
  authorId: string
  author: StoryAuthor
  mediaUrl: string
  thumbnailUrl: string | null
  caption: string | null
  linkUrl: string | null
  linkLabel: string | null
  views: number
  expiresAt: string
  createdAt: string
  viewed: boolean
  _count?: { viewers: number }
}

interface StoryViewerProps {
  stories: Story[]
  initialIndex?: number
  onClose: () => void
}

export default function StoryViewer({ stories, initialIndex = 0, onClose }: StoryViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const [progress, setProgress] = useState(0)
  const [paused, setPaused] = useState(false)
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const storyDuration = 5000

  const currentStory = stories[currentIndex]

  useEffect(() => {
    if (!currentStory || currentStory.viewed) return
    const token = localStorage.getItem('neighborly-auth')
    if (!token) return
    fetch(`/api/stories/${currentStory.id}/view`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    }).catch(() => {})
  }, [currentStory])

  const startProgress = useCallback(() => {
    if (progressRef.current) clearInterval(progressRef.current)
    const interval = 50
    const step = (interval / storyDuration) * 100
    progressRef.current = setInterval(() => {
      setProgress((prev) => {
        const next = prev + step
        if (next >= 100) {
          if (currentIndex < stories.length - 1) { setCurrentIndex((i) => i + 1); return 0 }
          else { onClose(); return 0 }
        }
        return next
      })
    }, interval)
  }, [currentIndex, stories.length, onClose])

  useEffect(() => {
    if (!paused) startProgress()
    return () => { if (progressRef.current) clearInterval(progressRef.current) }
  }, [currentIndex, paused, startProgress])

  const goToPrevious = () => { if (currentIndex > 0) { setCurrentIndex((i) => i - 1); setProgress(0) } }
  const goToNext = () => { if (currentIndex < stories.length - 1) { setCurrentIndex((i) => i + 1); setProgress(0) } else { onClose() } }

  const handleTap = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const third = rect.width / 3
    if (x < third) goToPrevious()
    else if (x > rect.width - third) goToNext()
    else setPaused((p) => !p)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
    if (e.key === 'ArrowLeft') goToPrevious()
    if (e.key === 'ArrowRight') goToNext()
  }

  if (!currentStory) return null

  const isVideo = currentStory.mediaUrl.match(/\.(mp4|webm|mov)$/i)

  return (
    <div className="fixed inset-0 z-[9999] bg-black flex flex-col cursor-pointer" onClick={handleTap} onKeyDown={handleKeyDown} tabIndex={0} role="dialog" aria-label="Story viewer"
      style={{ cursor: paused ? 'default' : 'pointer' }}>
      {/* Progress bars */}
      <div className="flex gap-[3px] px-2 pt-2 relative z-10">
        {stories.map((_, i) => (
          <div key={i} className="flex-1 h-0.5 bg-white/30 rounded-sm overflow-hidden">
            <div className="h-full bg-white rounded-sm transition-[width] duration-300" style={{ width: i < currentIndex ? '100%' : i === currentIndex ? `${progress}%` : '0%', transition: i === currentIndex ? 'none' : 'width 0.3s' }} />
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3 relative z-10">
        <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden text-nh-primary"
          style={{ background: currentStory.author.avatarUrl ? `url(${currentStory.author.avatarUrl}) center/cover` : undefined }}>
          {!currentStory.author.avatarUrl && currentStory.author.displayName?.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1">
          <div className="text-[13px] font-semibold text-white">{currentStory.author.displayName}</div>
          <div className="text-[11px] text-white/60">{new Date(currentStory.createdAt).toLocaleDateString()}</div>
        </div>
        <button onClick={(e) => { e.stopPropagation(); onClose() }} className="bg-white/15 border-0 rounded-full w-8 h-8 text-white text-lg cursor-pointer flex items-center justify-center leading-none" aria-label="Close">✕</button>
      </div>

      {/* Media */}
      <div className="flex-1 flex items-center justify-center relative overflow-hidden">
        {isVideo ? (
          <video src={currentStory.mediaUrl} autoPlay muted loop className="max-w-full max-h-full object-contain" />
        ) : (
          <img src={currentStory.mediaUrl} alt={currentStory.caption || 'Story'} className="max-w-full max-h-full object-contain" />
        )}
        {currentStory.caption && (
          <div className="absolute bottom-0 left-0 right-0 px-4 pt-10 pb-4" style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.7))' }}>
            <div className="text-sm text-white leading-relaxed">{currentStory.caption}</div>
            {currentStory.linkUrl && (
              <a href={currentStory.linkUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                className="inline-block mt-2 bg-nh-primary text-white px-4 py-2 rounded-lg text-[13px] font-semibold no-underline">
                {currentStory.linkLabel || 'Learn More'}
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  )
}