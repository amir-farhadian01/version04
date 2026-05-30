import { Moon, Sun, Monitor } from 'lucide-react'
import { useUiStore, type Theme } from '../../store/uiStore.js'

const THEME_CYCLE: Theme[] = ['dark', 'light', 'system']

const THEME_ICONS: Record<Theme, typeof Sun> = {
  dark: Moon,
  light: Sun,
  system: Monitor,
}

const THEME_LABELS: Record<Theme, string> = {
  dark: 'Dark mode',
  light: 'Light mode',
  system: 'System theme',
}

export function ThemeToggle() {
  const theme = useUiStore((s) => s.theme)
  const setTheme = useUiStore((s) => s.setTheme)

  function cycleTheme() {
    const idx = THEME_CYCLE.indexOf(theme)
    const next = THEME_CYCLE[(idx + 1) % THEME_CYCLE.length]
    setTheme(next)
  }

  const Icon = THEME_ICONS[theme]

  return (
    <button
      type="button"
      onClick={cycleTheme}
      className="relative flex items-center justify-center w-9 h-9 rounded-lg
        bg-[var(--bg2)] hover:bg-[var(--bg3)]
        text-[var(--text2)] hover:text-[var(--text)]
        transition-colors duration-200
        focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
      aria-label={`Switch theme (current: ${THEME_LABELS[theme]})`}
      title={THEME_LABELS[theme]}
    >
      <Icon className="w-4 h-4" aria-hidden="true" />
    </button>
  )
}
