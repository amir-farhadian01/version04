import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { PhoneContainer } from '../PhoneContainer'

describe('PhoneContainer', () => {
  it('renders children', () => {
    render(
      <PhoneContainer>
        <div data-testid="child">Content</div>
      </PhoneContainer>
    )

    expect(screen.getByTestId('child')).toHaveTextContent('Content')
  })

  it('applies custom className', () => {
    const { container } = render(
      <PhoneContainer className="custom-class">
        <div />
      </PhoneContainer>
    )

    const phone = container.firstChild as HTMLElement
    expect(phone.className).toContain('custom-class')
  })

  it('has correct dimensions via inline style', () => {
    const { container } = render(
      <PhoneContainer>
        <div />
      </PhoneContainer>
    )

    const phone = container.firstChild as HTMLElement
    expect(phone.style.width).toBe('375px')
    expect(phone.style.height).toBe('812px')
  })

  it('has dark theme styling with NeighborHub tokens', () => {
    const { container } = render(
      <PhoneContainer>
        <div />
      </PhoneContainer>
    )

    const phone = container.firstChild as HTMLElement
    expect(phone.className).toContain('bg-nh-bg')
    expect(phone.className).toContain('border-nh-border')
    expect(phone.className).toContain('rounded-[44px]')
  })

  it('renders scrollable inner container', () => {
    const { container } = render(
      <PhoneContainer>
        <div />
      </PhoneContainer>
    )

    const inner = container.firstChild?.firstChild as HTMLElement
    expect(inner.className).toContain('overflow-y-auto')
    expect(inner.className).toContain('scrollbar-hide')
  })
})
