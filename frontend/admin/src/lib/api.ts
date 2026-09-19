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

// Handle 401 by clearing auth state
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('neighborly-admin-auth')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api
