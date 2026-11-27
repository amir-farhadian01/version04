import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import Register from './Register.js'

const register = vi.hoisted(() => vi.fn())
vi.mock('../../store/authStore.js', () => ({ useAuthStore: (select: (state: { register: typeof register }) => unknown) => select({ register }) }))

afterEach(() => { cleanup(); vi.resetAllMocks() })

function setup() {
  render(<MemoryRouter initialEntries={['/auth/register']}><Routes>
    <Route path="/auth/register" element={<Register />} />
    <Route path="/app/home" element={<h1>Customer home</h1>} />
  </Routes></MemoryRouter>)
  for (const [label, value] of [['First name', ' New '], ['Last name', ' Customer '], ['Email', 'fixture@example.invalid'], ['Password', 'fixture-password']]) {
    fireEvent.change(screen.getByLabelText(label), { target: { value } })
  }
}

it('registers a fixture customer and opens the customer home', async () => {
  register.mockResolvedValue(undefined); setup()
  fireEvent.click(screen.getByRole('button', { name: 'Create account' }))
  expect(await screen.findByRole('heading', { name: 'Customer home' })).toBeTruthy()
  expect(register).toHaveBeenCalledWith({ firstName: 'New', lastName: 'Customer', email: 'fixture@example.invalid', password: 'fixture-password', phone: '' })
})

it('preserves input and displays a fixture registration conflict', async () => {
  register.mockRejectedValue({ response: { data: { error: 'Email already registered' } } }); setup()
  fireEvent.click(screen.getByRole('button', { name: 'Create account' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Email already registered')
  expect(screen.getByLabelText('Email')).toHaveValue('fixture@example.invalid')
})

it('blocks duplicate fixture registration while pending', async () => {
  let resolve!: () => void
  register.mockReturnValue(new Promise<void>((done) => { resolve = done })); setup()
  const button = screen.getByRole('button', { name: 'Create account' })
  fireEvent.click(button)
  fireEvent.submit(button.closest('form')!)
  expect(register).toHaveBeenCalledTimes(1)
  expect(screen.getByLabelText('Password')).toBeDisabled()
  resolve()
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Customer home' })).toBeTruthy())
})
