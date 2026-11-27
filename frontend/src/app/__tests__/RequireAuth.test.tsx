import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RequireAuth } from '../RequireAuth.js'

const auth = vi.hoisted(() => ({ token: 'test-token' as string | null, user: { roles: ['provider'] } as { roles?: unknown } | null }))
vi.mock('../../store/authStore.js', () => ({ useAuthStore: () => auth }))

function open(roles: string[] | undefined = ['provider']) {
  render(<MemoryRouter initialEntries={['/private']}><Routes>
    <Route path="/private" element={<RequireAuth roles={roles}>Private content</RequireAuth>} />
    <Route path="/auth/login" element={<>Sign in</>} />
    <Route path="/" element={<>Public home</>} />
  </Routes></MemoryRouter>)
}

beforeEach(() => { auth.token = 'test-token'; auth.user = { roles: ['provider'] } })
describe('RequireAuth', () => {
  it.each([null, {}, { roles: [] }, { roles: ['customer'] }, { roles: 'provider' }, { roles: [null] }])('denies invalid or unrelated user roles: %j', (user) => {
    auth.user = user
    open()
    expect(screen.getByText('Public home')).toBeInTheDocument()
    expect(screen.queryByText('Private content')).not.toBeInTheDocument()
  })
  it.each(['provider', 'PROVIDER', 'PrOvIdEr'])('accepts authorized case variant %s', (role) => {
    auth.user = { roles: [role] }
    open()
    expect(screen.getByText('Private content')).toBeInTheDocument()
  })
  it('redirects anonymous users even if a role remains in memory', () => {
    auth.token = null
    open()
    expect(screen.getByText('Sign in')).toBeInTheDocument()
  })
  it('keeps authentication-only routes available without role requirements', () => {
    auth.user = null
    render(<MemoryRouter><RequireAuth>Authenticated content</RequireAuth></MemoryRouter>)
    expect(screen.getByText('Authenticated content')).toBeInTheDocument()
  })
})
