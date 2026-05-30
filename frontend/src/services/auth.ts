import api from '../lib/api'
import { useAuthStore } from '../store/authStore'

interface LoginPayload { email: string; password: string }
interface RegisterPayload { email: string; password: string; firstName: string; lastName: string; phone: string }

export async function login(payload: LoginPayload) {
  const { data } = await api.post<{ token: string; refreshToken: string; user: ReturnType<typeof useAuthStore.getState>['user'] }>('/auth/login', payload)
  return data
}

export async function register(payload: RegisterPayload) {
  const { data } = await api.post('/auth/register', payload)
  return data
}

export async function logout() {
  await api.post('/auth/logout')
  useAuthStore.getState().logout()
}
