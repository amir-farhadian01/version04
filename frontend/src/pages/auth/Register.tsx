import { useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore.js'
import { apiErrorMessage } from '../../lib/apiError.js'

export default function Register() {
  const register = useAuthStore((state) => state.register)
  const navigate = useNavigate()
  const pending = useRef(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '', phone: '' })

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (pending.current) return
    pending.current = true
    setLoading(true)
    setError('')
    try {
      await register({
        ...form,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
      })
      navigate('/app/home', { replace: true })
    } catch (err: unknown) {
      setError(apiErrorMessage(err, 'Could not create your account. Please try again.'))
    } finally {
      pending.current = false
      setLoading(false)
    }
  }

  const fields = [
    { key: 'firstName', label: 'First name', type: 'text', autoComplete: 'given-name', required: true },
    { key: 'lastName', label: 'Last name', type: 'text', autoComplete: 'family-name', required: true },
    { key: 'email', label: 'Email', type: 'email', autoComplete: 'email', required: true },
    { key: 'password', label: 'Password', type: 'password', autoComplete: 'new-password', required: true },
    { key: 'phone', label: 'Phone (optional)', type: 'tel', autoComplete: 'tel', required: false },
  ] as const

  return (
    <section className="min-h-screen bg-nh-bg px-5 py-8 text-nh-text">
      <div className="mx-auto w-full max-w-[400px] rounded-2xl bg-nh-surface p-6 shadow-nh-card">
        <h1 className="mb-2 text-2xl font-bold">Create account</h1>
        <p className="mb-6 text-sm text-nh-text-secondary">Create your Neighborly account to get started.</p>
        {error && <p role="alert" className="mb-4 text-sm text-nh-danger">{error}</p>}
        <form onSubmit={submit}>
          <fieldset disabled={loading} className="space-y-4">
            {fields.map((field) => (
              <label key={field.key} className="block text-sm font-medium">
                {field.label}
                <input
                  type={field.type}
                  autoComplete={field.autoComplete}
                  required={field.required}
                  value={form[field.key]}
                  onChange={(event) => setForm({ ...form, [field.key]: event.target.value })}
                  className="mt-1 block w-full min-w-0 rounded-xl border border-nh-border bg-nh-bg px-4 py-3 text-nh-text focus-visible:outline focus-visible:outline-nh-primary"
                />
              </label>
            ))}
            <button
              type="submit"
              disabled={loading || !form.firstName.trim() || !form.lastName.trim() || !form.email.trim() || !form.password}
              className="min-h-11 w-full rounded-xl bg-nh-primary px-4 py-3 font-bold text-white disabled:opacity-50"
            >
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </fieldset>
        </form>
        <p className="mt-5 text-sm">Already have an account? <Link to="/auth/login" className="underline">Sign in</Link></p>
      </div>
    </section>
  )
}
