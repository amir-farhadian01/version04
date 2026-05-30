import { useAuthStore } from '../store/authStore'

export function useAuth() {
  const { user, token, logout } = useAuthStore()
  return {
    user,
    isAuthenticated: !!token,
    hasRole: (role: string) => user?.roles.includes(role) ?? false,
    logout,
  }
}
