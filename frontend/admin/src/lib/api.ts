import axios from 'axios'

export function getApiError(error: unknown, fallback: string): string {
  if (axios.isAxiosError<{ error?: string; message?: string }>(error)) {
    return error.response?.data?.error ?? error.response?.data?.message ?? error.message ?? fallback
  }
  return error instanceof Error ? error.message : fallback
}

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
})

// Inject token into request headers
api.interceptors.request.use((config) => {
  try {
    const raw = localStorage.getItem('neighborly-admin-auth')
    if (raw) {
      const parsed = JSON.parse(raw)
      const token = parsed?.state?.token
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }
    }
  } catch {
    // ignore parse errors
  }
  return config
})

// Handle 401 by clearing auth state — but never for auth endpoints themselves:
// a best-effort `POST /auth/logout` with an expired token 401s, and reacting
// to that with a redirect would reload the login page in a loop.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url: unknown = error.config?.url
    const isAuthCall =
      typeof url === 'string' && /\/auth\/(login|register|refresh|logout)\/?$/.test(url)
    if (error.response?.status === 401 && !isAuthCall) {
      localStorage.removeItem('neighborly-admin-auth')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api
