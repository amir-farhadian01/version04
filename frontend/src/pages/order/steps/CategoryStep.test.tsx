import { render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import CategoryStep from './CategoryStep.js'

const mocks = vi.hoisted(() => ({ get: vi.fn() }))

vi.mock('../../../lib/api.js', () => ({ default: { get: mocks.get } }))

afterEach(() => {
  mocks.get.mockReset()
})

it('renders the empty state when categories returns an unexpected response shape', async () => {
  mocks.get.mockResolvedValue({ data: { data: [] } })

  render(
    <CategoryStep
      draft={{ step: 1, updatedAt: '2026-11-25T00:00:00.000Z' }}
      onUpdate={() => {}}
      onNext={() => {}}
    />,
  )

  expect(await screen.findByText('No categories available')).toBeInTheDocument()
})
