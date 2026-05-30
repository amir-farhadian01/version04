import { useState, useEffect } from 'react'
import StoryViewer from './StoryViewer'

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

interface StoriesRowProps {
  onAddStory?: () => void
}

export default function StoriesRow({ onAddStory }: StoriesRowProps) {
  const [stories, setStories] = useState<Story[]>([])
  const [viewerOpen, setViewerOpen] = useState(false)
  const [viewerIndex, setViewerIndex] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchStories() }, [])

  const fetchStories = async () => {
    try {
      const token = localStorage.getItem('neighborly-auth')
      const headers: Record<string, string> = {}
      if (token) headers['Authorization'] = `Bearer ${token}`
      const res = await fetch('/api/stories/active', { headers })
      if (!res.ok) throw new Error('Failed to fetch stories')
      const json = await res.json()
      setStories(json.data || [])
    } catch (err) {
      console.error('Failed to load stories:', err)
    } finally {
      setLoading(false)
    }
  }

  const openViewer = (index: number) => {
    setViewerIndex(index)
    setViewerOpen(true)
  }

  const groupedByAuthor = stories.reduce<Map<string, { author: StoryAuthor; stories: Story[] }>>(
    (acc, story) => {
      const existing = acc.get(story.authorId)
      if (existing) { existing.stories.push(story) }
      else { acc.set(story.authorId, { author: story.author, stories: [story] }) }
      return acc
    }, new Map(),
  )

  const authorStories = Array.from(groupedByAuthor.values()).map((g) => g.stories[0])

  if (loading) {
    return (
      <div className="flex gap-3 px-[14px] pt-[14px] overflow-x-auto min-h-[90px]">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex flex-col items-center gap-1.5 shrink-0 w-16">
            <div className="w-[58px] h-[58px] rounded-full bg-nh-border-elevated" />
            <div className="w-[50px] h-2.5 rounded bg-nh-border-elevated" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <>
      <div className="flex gap-3 px-[14px] pt-[14px] overflow-x-auto scrollbar-none min-h-[90px]">
        {/* Add Story button */}
        <div onClick={onAddStory} className="flex flex-col items-center gap-1.5 shrink-0 w-16 cursor-pointer">
          <div className="w-[58px] h-[58px] rounded-full p-0.5 bg-nh-border-elevated flex items-center justify-center">
            <div className="w-full h-full rounded-full bg-nh-surface flex items-center justify-center text-2xl text-nh-primary border-2 border-nh-surface">
              +
            </div>
          </div>
          <span className="text-[10px] text-nh-text-secondary text-center">Your Story</span>
        </div>

        {/* Story circles */}
        {authorStories.map((story, i) => (
          <div key={story.id} onClick={() => openViewer(i)} className="flex flex-col items-center gap-1.5 shrink-0 w-16 cursor-pointer">
            <div
              className="w-[58px] h-[58px] rounded-full p-0.5"
              style={{ background: story.viewed ? 'var(--nh-border-elevated-color, rgba(255,255,255,0.12))' : 'linear-gradient(135deg, var(--nh-primary), var(--nh-accent))' }}
            >
              <div className="w-full h-full rounded-full border-2 border-nh-surface overflow-hidden flex items-center justify-center text-xl font-bold text-nh-text-secondary font-heading"
                style={{ background: story.author.avatarUrl ? `url(${story.author.avatarUrl}) center/cover` : undefined }}>
                {!story.author.avatarUrl && story.author.displayName?.charAt(0).toUpperCase()}
              </div>
            </div>
            <span className="text-[10px] text-nh-text-secondary text-center truncate w-full">{story.author.displayName}</span>
          </div>
        ))}
      </div>

      {viewerOpen && (
        <StoryViewer
          stories={stories}
          initialIndex={viewerIndex}
          onClose={() => { setViewerOpen(false); fetchStories() }}
        />
      )}
    </>
  )
}