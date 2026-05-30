import { useState, useEffect } from 'react'
import api from '../../lib/api'

interface FollowCountProps {
  userId: string
}

export default function FollowCount({ userId }: FollowCountProps) {
  const [followerCount, setFollowerCount] = useState<number | null>(null)
  const [followingCount, setFollowingCount] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false

    async function fetchCounts() {
      try {
        const [followersRes, followingRes] = await Promise.all([
          api.get(`/follow/${userId}/followers`, { params: { limit: 1 } }),
          api.get(`/follow/${userId}/following`, { params: { limit: 1 } }),
        ])
        if (!cancelled) {
          setFollowerCount(followersRes.data?.total ?? followersRes.data?.length ?? 0)
          setFollowingCount(followingRes.data?.total ?? followingRes.data?.length ?? 0)
        }
      } catch (err) {
        console.error('Failed to fetch follow counts:', err)
      }
    }

    fetchCounts()
    return () => { cancelled = true }
  }, [userId])

  return (
    <div className="flex gap-4">
      <div className="text-center">
        <div className="text-base font-bold text-nh-text font-heading">
          {followerCount ?? '—'}
        </div>
        <div className="text-[11px] text-nh-text-muted">Followers</div>
      </div>
      <div className="text-center">
        <div className="text-base font-bold text-nh-text font-heading">
          {followingCount ?? '—'}
        </div>
        <div className="text-[11px] text-nh-text-muted">Following</div>
      </div>
    </div>
  )
}