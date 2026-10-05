import axios from 'axios'
import { useAuthStore } from '../store/authStore'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

let isRefreshing = false
let failedQueue: Array<{
  resolve: (token: string) => void
  reject: (err: unknown) => void
}> = []

/**
 * Auth endpoints must never re-enter the refresh→logout cycle. A best-effort
 * `POST /auth/logout` fired with an expired token gets a 401; if the
 * interceptor treated it like any other request it would call `logout()`
 * again, which fires another logout POST — an unbounded self-DoS loop that
 * exhausted the 10/min auth rate limiter (observed ~50 POSTs per expiry).
 */
export function isAuthEndpoint(url?: string): boolean {
  return typeof url === 'string' && /\/auth\/(login|register|refresh|logout)\/?$/.test(url)
}

function processQueue(error: unknown, token: string | null = null) {
  failedQueue.forEach((p) => {
    if (error) p.reject(error)
    else p.resolve(token!)
  })
  failedQueue = []
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const originalRequest = error.config

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !isAuthEndpoint(originalRequest.url)
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`
            return api(originalRequest)
          })
          .catch((err) => Promise.reject(err))
      }

      originalRequest._retry = true
      isRefreshing = true

      const refreshed = await useAuthStore.getState().refresh()
      isRefreshing = false

      if (refreshed) {
        const newToken = useAuthStore.getState().token!
        processQueue(null, newToken)
        originalRequest.headers.Authorization = `Bearer ${newToken}`
        return api(originalRequest)
      }

      processQueue(error, null)
      useAuthStore.getState().logout()
      // Never redirect when already on an auth page — otherwise a failed
      // refresh while on /auth/login would reload the page forever.
      if (!window.location.pathname.startsWith('/auth/')) {
        window.location.href = '/auth/login'
      }
    }

    return Promise.reject(error)
  }
)

export default api
