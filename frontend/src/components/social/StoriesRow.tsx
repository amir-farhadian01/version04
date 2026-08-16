import { useState } from 'react'
import { useStoriesFeed, type StoryItem } from '../../services/socialFeedApi'
import StoryViewer from './StoryViewer'

interface StoriesRowProps {
  onAddStory?: () => void
}

export default function StoriesRow({ onAddStory }: StoriesRowProps) {
  const { data: storyGroups, isLoading: loading, refetch } = useStoriesFeed()
  const [viewerOpen, setViewerOpen] = useState(false)
  const [viewerIndex, setViewerIndex] = useState(0)

  const allStories: StoryItem[] = (storyGroups ?? []).flatMap((g) => g.stories)

  if (loading) {
    return (
      <div className="flex gap-3 px-[14px] pt-[14px] overflow-x-auto min-h-[90px]">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex flex-col items-center gap-1.5 shrink-0 w-16">
            <div className="w-[58px] h-[58px] rounded-full bg-nh-border-elevated animate-pulse" />
            <div className="w-[50px] h-2.5 rounded bg-nh-border-elevated animate-pulse" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <>
      <div className="flex gap-3 px-[14px] pt-[14px] overflow-x-auto scrollbar-none min-h-[90px]">
        {/* Add Story button */}
        {onAddStory && (
          <div onClick={onAddStory} className="flex flex-col items-center gap-1.5 shrink-0 w-16 cursor-pointer">
            <div className="w-[58px] h-[58px] rounded-full p-0.5 bg-nh-border-elevated flex items-center justify-center">
              <div className="w-full h-full rounded-full bg-nh-surface flex items-center justify-center text-2xl text-nh-primary border-2 border-nh-surface">
                +
              </div>
            </div>
            <span className="text-[10px] text-nh-text-secondary text-center">Your Story</span>
          </div>
        )}

        {/* Story circles from API */}
        {(storyGroups ?? []).map((group, i) => {
          const first = group.stories[0]
          return (
            <div key={group.author.id} onClick={() => { setViewerIndex(i); setViewerOpen(true) }} className="flex flex-col items-center gap-1.5 shrink-0 w-16 cursor-pointer">
              <div
                className="w-[58px] h-[58px] rounded-full p-0.5"
                style={{ background: first?.viewed
                  ? 'var(--nh-border-elevated-color, rgba(255,255,255,0.12))'
                  : 'linear-gradient(135deg, var(--nh-primary), var(--nh-accent))' }}
              >
                <div
                  className="w-full h-full rounded-full border-2 border-nh-surface overflow-hidden flex items-center justify-center text-xl font-bold text-nh-text-secondary font-heading"
                  style={group.author.avatarUrl ? { background: `url(${group.author.avatarUrl}) center/cover` } : undefined}
                >
                  {!group.author.avatarUrl && (group.author.displayName ?? '?').charAt(0).toUpperCase()}
                </div>
              </div>
              <span className="text-[10px] text-nh-text-secondary text-center truncate w-full">{group.author.displayName}</span>
            </div>
          )
        })}
      </div>

      {viewerOpen && (
        <StoryViewer
          stories={allStories}
          initialIndex={viewerIndex}
          onClose={() => { setViewerOpen(false); refetch() }}
        />
      )}
    </>
  )
}