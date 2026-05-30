import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { StatusBar } from '../StatusBar'

describe('StatusBar', () => {
  it('renders default title "9:41" when no title provided', () => {
    render(<StatusBar />)
    expect(screen.getByText('9:41')).toBeInTheDocument()
  })

  it('renders custom title', () => {
    render(<StatusBar title="Home" />)
    expect(screen.getByText('Home')).toBeInTheDocument()
  })

  it('renders wifi and battery icons', () => {
    const { container } = render(<StatusBar />)
    const svgs = container.querySelectorAll('svg')
    // wifi + battery = 2 svgs
    expect(svgs.length).toBeGreaterThanOrEqual(2)
  })

  it('does not render notification bell when onNotifClick is not provided', () => {
    const { container } = render(<StatusBar />)
    const notifBell = container.querySelector('.notif-bell')
    expect(notifBell).not.toBeInTheDocument()
  })

  it('renders notification bell when onNotifClick is provided', () => {
    const { container } = render(<StatusBar onNotifClick={() => {}} />)
    const notifBell = container.querySelector('.notif-bell')
    expect(notifBell).toBeInTheDocument()
  })

  it('calls onNotifClick when notification bell is clicked', () => {
    const handleClick = vi.fn()
    render(<StatusBar onNotifClick={handleClick} />)
    const notifBell = screen.getByText('9:41').parentElement?.querySelector('.notif-bell')
    expect(notifBell).toBeInTheDocument()
    fireEvent.click(notifBell!)
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('shows notification dot when showNotifDot is true', () => {
    const { container } = render(<StatusBar onNotifClick={() => {}} showNotifDot />)
    const dot = container.querySelector('.notif-bell > div')
    expect(dot).toBeInTheDocument()
  })

  it('has dark background with NeighborHub tokens and border', () => {
    const { container } = render(<StatusBar />)
    const bar = container.firstChild as HTMLElement
    expect(bar.className).toContain('bg-nh-bg')
    expect(bar.className).toContain('border-nh-border')
    expect(bar.className).toContain('border-b')
  })
})
