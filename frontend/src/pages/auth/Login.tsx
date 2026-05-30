import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore.js'

/** Role-ordered route priority for post-login redirect */
const ROLE_REDIRECTS: Record<string, string> = {
  platform_admin: '/admin',
  admin: '/admin',
  BUSINESS_OWNER: '/business/default',
  SOLO_PROVIDER: '/business/default',
  provider: '/business/default',
  customer: '/app/home',
}

function resolveRedirect(roles: string[]): string {
  for (const [roleKey, path] of Object.entries(ROLE_REDIRECTS)) {
    if (roles.some((r) => r.toUpperCase() === roleKey.toUpperCase())) {
      return path
    }
  }
  return '/app/home'
}

/**
 * Client SPA Login — general email+password login for all user types.
 * Redirects based on user role after successful login.
 */
export default function Login() {
  const navigate = useNavigate()
  const { login } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return
    setLoading(true)
    setError('')
    try {
      await login({ email, password })
      // Read roles from the store after login() updates them
      const currentUser = useAuthStore.getState().user
      const redirectPath = currentUser?.roles ? resolveRedirect(currentUser.roles) : '/app/home'
      navigate(redirectPath)
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (err as { message?: string })?.message ||
        'Login failed'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-nh-bg p-6">
      <div className="w-full max-w-[400px] bg-nh-surface rounded-2xl px-8 py-10 shadow-nh-card">
        {/* Logo */}
        <div className="w-14 h-14 bg-nh-primary-hover rounded-2xl flex items-center justify-center mb-6">
          <svg width="28" height="28" viewBox="0 0 24 24" className="fill-nh-primary">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
          </svg>
        </div>

        <h1 className="font-heading text-2xl font-bold text-nh-text mb-1.5">
          Sign In
        </h1>
        <p className="text-sm text-nh-text-secondary leading-relaxed mb-7">
          Sign in with your email and password to access your account.
        </p>

        {/* Email */}
        <div className="mb-4">
          <div className="text-xs font-semibold text-nh-text-secondary mb-1.5">Email</div>
          <div className={`w-full bg-nh-bg border rounded-xl px-4 py-3 text-[15px] text-nh-text flex items-center gap-2.5 ${email ? 'border-nh-success' : 'border-nh-border-elevated'}`}>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="flex-1 bg-transparent border-0 outline-none text-nh-text text-[15px] font-sans"
            />
          </div>
        </div>

        {/* Password */}
        <div className="mb-4">
          <div className="text-xs font-semibold text-nh-text-secondary mb-1.5">Password</div>
          <div className={`w-full bg-nh-bg border rounded-xl px-4 py-3 text-[15px] text-nh-text flex items-center gap-2.5 ${password ? 'border-nh-success' : 'border-nh-border-elevated'}`}>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="flex-1 bg-transparent border-0 outline-none text-nh-text text-[15px] font-sans"
            />
          </div>
        </div>

        {/* Error */}
        {error && (
          <p className="text-[13px] text-nh-danger text-center mb-2">
            {error}
          </p>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={loading || !email || !password}
          className="w-full rounded-xl py-[14px] text-[15px] font-bold text-white text-center border-0 font-sans mt-2 transition-all duration-200 cursor-pointer disabled:cursor-not-allowed"
          style={{
            background: email && password && !loading ? 'var(--nh-primary)' : 'var(--nh-border-elevated-color, rgba(255,255,255,0.12))',
          }}
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>

      </div>
    </div>
  )
}