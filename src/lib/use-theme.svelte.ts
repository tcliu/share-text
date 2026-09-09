import { browser } from '$app/environment'

export type UiTheme =
  | 'dark'
  | 'light'
  | 'ember'
  | 'sepia'
  | 'nebula'
  | 'sky'
  | 'forest'
  | 'midnight'
  | 'mint'
  | 'lavender'

const STORAGE_KEY = 'share-text:theme'

const THEMES: readonly UiTheme[] = [
  'dark',
  'light',
  'ember',
  'sepia',
  'nebula',
  'sky',
  'forest',
  'midnight',
  'mint',
  'lavender',
]

function isTheme(value: unknown): value is UiTheme {
  return typeof value === 'string' && (THEMES as readonly string[]).includes(value)
}

function readStoredTheme(): UiTheme | null {
  if (!browser) return null
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored !== null && isTheme(stored)) return stored
  } catch {
    // Unreadable storage falls back to the default dark palette.
  }
  return null
}

// Module-shared state: every header menu reads the same selection, and the
// value only ever touches browser APIs (localStorage, documentElement), so
// SSR always renders the dark default.
let theme = $state<UiTheme>('dark')
let hydrated = false

function applyTheme(value: UiTheme) {
  if (!browser) return
  // Dark is the default palette and needs no attribute; every other theme
  // opts in via data-theme, matching the pre-paint script in app.html.
  if (value === 'dark') {
    delete document.documentElement.dataset.theme
  } else {
    document.documentElement.dataset.theme = value
  }
}

export interface ThemeHandle {
  readonly theme: UiTheme
  setTheme: (value: UiTheme) => void
  hydrate: () => void
}

export function useTheme(): ThemeHandle {
  return {
    get theme() {
      return theme
    },
    setTheme(value: UiTheme) {
      theme = value
      applyTheme(value)
      if (!browser) return
      try {
        localStorage.setItem(STORAGE_KEY, value)
      } catch {
        // Private-mode writes must not break the menu interaction.
      }
    },
    hydrate() {
      if (hydrated) return
      hydrated = true
      const stored = readStoredTheme()
      if (stored !== null) {
        theme = stored
        applyTheme(stored)
      }
    },
  }
}
