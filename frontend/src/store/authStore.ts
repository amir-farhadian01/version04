import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import api from '../lib/api'

export interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  displayName?: string | null
  roles: string[]
  avatarUrl?: string | null
  phone?: string | null
  companyId?: string | null
}

interface LoginPayload {
  email: string
  password: string
}

interface RegisterPayload {
  email: string
  password: string
  firstName: string
  lastName: string
  phone: string
}

interface AuthState {
  token: string | null
  refreshToken: string | null
  user: User | null
  isLoading: boolean
  error: string | null
  setAuth: (token: string, refreshToken: string, user: User) => void
  login: (payload: LoginPayload) => Promise<void>
  register: (payload: RegisterPayload) => Promise<void>
  refresh: () => Promise<boolean>
  refreshUser: () => Promise<void>
  logout: () => void
  clearError: () => void
}

/** Map backend user shape (displayName, role string) to our User interface (firstName, lastName, roles array) */
function mapBackendUser(backendUser: {
  id: string
  email: string
  displayName?: string | null
  firstName?: string | null
  lastName?: string | null
  role?: string
  roles?: string[]
  avatarUrl?: string | null
  phone?: string | null
  companyId?: string | null
}): User {
  // Split displayName into firstName/lastName if firstName/lastName not provided
  const firstName = backendUser.firstName || backendUser.displayName?.split(' ')[0] || ''
  const lastName = backendUser.lastName || backendUser.displayName?.split(' ').slice(1).join(' ') || ''
  const roles = backendUser.roles ?? (backendUser.role ? [backendUser.role] : ['CUSTOMER'])

  return {
    id: backendUser.id,
    email: backendUser.email,
    firstName,
    lastName,
    displayName: backendUser.displayName,
    roles,
    avatarUrl: backendUser.avatarUrl ?? null,
    phone: backendUser.phone ?? null,
    companyId: backendUser.companyId ?? null,
  }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      refreshToken: null,
      user: null,
      isLoading: false,
      error: null,

      setAuth: (token, refreshToken, user) => set({ token, refreshToken, user, error: null }),

      login: async (payload: LoginPayload) => {
        set({ isLoading: true, error: null })
        try {
          const { data } = await api.post<{
            accessToken: string
            user: {
              id: string
              email: string
              displayName: string
              role: string
              companyId?: string | null
              avatarUrl?: string | null
            }
          }>('/auth/login', { login: payload.email, password: payload.password })

          const user = mapBackendUser(data.user)
          set({
            token: data.accessToken,
            // refreshToken comes from httpOnly cookie — we keep existing or null
            user,
            isLoading: false,
          })
        } catch (err: unknown) {
          const message =
            err && typeof err === 'object' && 'response' in err
              ? (err as any).response?.data?.error ?? 'Login failed'
              : 'Login failed'
          set({ isLoading: false, error: message })
          throw err
        }
      },

      register: async (payload: RegisterPayload) => {
        set({ isLoading: true, error: null })
        try {
          // Backend expects displayName (combined from firstName + lastName)
          const { data } = await api.post<{
            accessToken: string
            user: {
              id: string
              email: string
              displayName: string
              role: string
              companyId?: string | null
              avatarUrl?: string | null
            }
          }>('/auth/register', {
            email: payload.email,
            password: payload.password,
            displayName: `${payload.firstName} ${payload.lastName}`.trim(),
            phone: payload.phone || undefined,
          })

          const user = mapBackendUser(data.user)
          set({
            token: data.accessToken,
            user,
            isLoading: false,
          })
        } catch (err: unknown) {
          const message =
            err && typeof err === 'object' && 'response' in err
              ? (err as any).response?.data?.error ?? 'Registration failed'
              : 'Registration failed'
          set({ isLoading: false, error: message })
          throw err
        }
      },

      refresh: async () => {
        const { refreshToken } = get()
        if (!refreshToken) return false
        try {
          const res = await fetch(
            `${import.meta.env.VITE_API_URL ?? '/api'}/auth/refresh`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ refreshToken }),
            }
          )
          if (!res.ok) return false
          const data = (await res.json()) as { accessToken: string; refreshToken: string }
          set({ token: data.accessToken, refreshToken: data.refreshToken })
          return true
        } catch {
          return false
        }
      },

      refreshUser: async () => {
        try {
          const { data } = await api.get<{
            id: string
            email: string
            firstName: string | null
            lastName: string | null
            displayName: string | null
            role: string
            avatarUrl?: string | null
            phone?: string | null
          }>('/auth/me')
          set({ user: mapBackendUser(data) })
        } catch {
          // silently fail — token might be expired
        }
      },

      logout: () => {
        set({ token: null, refreshToken: null, user: null, error: null })
        try {
          api.post('/auth/logout').catch(() => {})
        } catch {
          // best-effort server-side logout
        }
      },

      clearError: () => set({ error: null }),
    }),
    { name: 'neighborly-auth' }
  )
)
