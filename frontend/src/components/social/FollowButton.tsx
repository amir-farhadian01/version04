import { useState, useEffect, useCallback } from 'react'
import api from '../../lib/api'
import { useAuthStore } from '../../store/authStore'

interface FollowButtonProps {
  userId: string
  onFollowChange?: (isFollowing: boolean) => void
  size?: 'sm' | 'md'
}

export default function FollowButton({ userId, onFollowChange, size = 'md' }: FollowButtonProps) {
  const [isFollowing, setIsFollowing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const { user } = useAuthStore()

  const isSelf = user?.id === userId

  const checkStatus = useCallback(async () => {
    if (!user || isSelf) {
      setChecking(false)
      return
    }
    try {
      const res = await api.get(`/follow/status/${userId}`)
      setIsFollowing(res.data?.isFollowing ?? false)
    } catch (err) {
      console.error('Failed to check follow status:', err)
    } finally {
      setChecking(false)
    }
  }, [userId, user, isSelf])

  useEffect(() => { checkStatus() }, [checkStatus])

  const handleToggle = async () => {
    if (!user || loading) return
    setLoading(true)
    try {
      if (isFollowing) {
        await api.delete(`/follow/${userId}`)
        setIsFollowing(false)
        onFollowChange?.(false)
      } else {
        await api.post(`/follow/${userId}`)
        setIsFollowing(true)
        onFollowChange?.(true)
      }
    } catch (err) {
      console.error('Failed to toggle follow:', err)
    } finally {
      setLoading(false)
    }
  }

  if (isSelf) return null

  const isSmall = size === 'sm'

  if (checking) {
    return (
      <div className={`rounded-lg font-semibold bg-nh-border-elevated text-transparent cursor-default opacity-50 text-center min-w-${isSmall ? '60' : '80'} ${isSmall ? 'text-[11px] px-3 py-1' : 'text-xs px-4 py-1.5'}`}>
        —
      </div>
    )
  }

  return (
    <div
      onClick={handleToggle}
      className={`rounded-lg font-semibold text-center select-none transition-all duration-200 ${
        isSmall ? 'text-[11px] px-3 py-1' : 'text-xs px-4 py-1.5'
      } ${
        isFollowing
          ? 'bg-transparent text-nh-text-secondary border border-nh-border'
          : 'bg-nh-primary text-white border border-nh-primary'
      } ${loading ? 'opacity-60 cursor-wait' : 'cursor-pointer'}`}
    >
      {loading ? '...' : isFollowing ? 'Following' : 'Follow'}
    </div>
  )
}