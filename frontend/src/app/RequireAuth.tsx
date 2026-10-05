import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore.js'

export function RequireAuth({ children, roles }: { children: ReactNode; roles?: string[] }) {
  const { token, user } = useAuthStore()
  if (!token) return <Navigate to="/auth/login" replace />
  if (roles) {
    const userRoles = Array.isArray(user?.roles)
      ? user.roles.filter((role): role is string => typeof role === 'string').map((role) => role.toLowerCase())
      : []
    if (!roles.some((role) => userRoles.includes(role.toLowerCase()))) {
      return <Navigate to="/" replace />
    }
  }
  return <>{children}</>
}
