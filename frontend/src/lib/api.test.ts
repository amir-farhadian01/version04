import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import api, { isAuthEndpoint } from './api'
import { useAuthStore } from '../store/authStore'

// Axios keeps registered interceptors in an internal handlers list.
function responseErrorHandler(): (error: unknown) => Promise<unknown> {
  const handlers = (
    api.interceptors.response as unknown as {
      handlers: Array<{ rejected: (error: unknown) => Promise<unknown> } | undefined>
    }
  ).handlers
  const handler = handlers.find((h) => h !== undefined)
  if (!handler) throw new Error('No response interceptor registered')
  return handler.rejected
}

function authError(url: string) {
  return {
    response: { status: 401 },
    config: { url, headers: {} as Record<string, string> },
  }
}

describe('isAuthEndpoint', () => {
  it('matches auth endpoints', () => {
    expect(isAuthEndpoint('/auth/logout')).toBe(true)
    expect(isAuthEndpoint('/auth/login')).toBe(true)
    expect(isAuthEndpoint('/auth/refresh')).toBe(true)
    expect(isAuthEndpoint('/auth/register')).toBe(true)
  })

  it('does not match business endpoints or missing urls', () => {
    expect(isAuthEndpoint('/workspace/1/finance')).toBe(false)
    expect(isAuthEndpoint('/orders')).toBe(false)
    expect(isAuthEndpoint(undefined)).toBe(false)
  })
})

describe('api response interceptor 401 handling', () => {
  const realRefresh = useAuthStore.getState().refresh
  const realLogout = useAuthStore.getState().logout
  const refresh = vi.fn(async () => false)
  const logout = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({ refresh, logout })
  })

  afterEach(() => {
    useAuthStore.setState({ refresh: realRefresh, logout: realLogout })
  })

  it('does not spawn a logout/refresh cycle when an auth endpoint itself 401s', async () => {
    // A best-effort logout POST fired with an expired token must be rejected
    // as-is — no refresh attempt, no second logout POST (retry-loop fix).
    await expect(responseErrorHandler()(authError('/auth/logout'))).rejects.toMatchObject({
      response: { status: 401 },
    })
    expect(refresh).not.toHaveBeenCalled()
    expect(logout).not.toHaveBeenCalled()
  })

  it('logs out exactly once when a business request 401s and refresh fails', async () => {
    // Stay on an auth page so the redirect (unsupported in jsdom) is skipped.
    window.history.replaceState(null, '', '/auth/login')
    await expect(
      responseErrorHandler()(authError('/workspace/1/overview'))
    ).rejects.toMatchObject({ response: { status: 401 } })
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(logout).toHaveBeenCalledTimes(1)
  })
})
