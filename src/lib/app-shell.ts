// Pane geometry and persistence for the shared AppShell layout.
//
// One responsive ruler: the shell measures its own container width and treats
// it as desktop layout at or above APP_SHELL_DESKTOP_BREAKPOINT. Every
// presentation decision in AppShell.svelte derives from that single boolean,
// so container measurement and layout can never disagree the way viewport
// media queries mixed with container observation could.
//
// Persistence is opt-in: without `storageKey` every function degrades to
// session-only defaults and never touches storage.

export const APP_SHELL_MIN_WIDTH = 160
export const APP_SHELL_MAX_WIDTH = 480
export const APP_SHELL_DEFAULT_WIDTH = 288
export const APP_SHELL_RAIL_WIDTH = 64

// Container width (px) at or above which `auto` presentation docks the pane
// beside the content; below it the drawer floats above the content. Matches
// the 48rem desktop breakpoint at the 16px root size, but it is compared
// against the shell's own container width so an embedded shell floats when
// *its* space is narrow, even on a wide screen.
export const APP_SHELL_DESKTOP_BREAKPOINT = 768

export type AppShellCollapseMode = 'hide' | 'rail'

// Drawer presentation. `auto` docks the pane inline beside the content while
// the shell container is wide enough and floats it above the content when
// narrow, so a narrow container never squeezes the pane and the page into
// each other; `docked` and `floating` pin one behavior at every width. Rail
// collapse is a docked-only affordance: below the breakpoint a rail pane
// floats as an open-or-closed overlay instead of a rail strip.
export type AppShellDrawerMode = 'auto' | 'docked' | 'floating'

// Callbacks and state the shell hands to its `header` snippet so callers can
// render their own drawer toggles. The toggle functions route through the
// drawer's setOpen (focus return + change notifications), never a raw prop
// flip, so programmatic toggles behave exactly like the former built-in ones.
export interface AppShellHeaderApi {
  open: boolean
  rightOpen: boolean
  toggleLeft: () => void
  toggleRight: () => void
}

// Nesting contract for stacked shells (e.g. a component demo rendered
// inside another shell's main column): every shell publishes whether an
// overlay is open at or above it, so a nested shell can hide its own
// floating panes while an ancestor overlay is open. The `open` state is
// preserved, so the nested panes restore when the ancestor closes.
export interface AppShellNesting {
  /** True when this shell or any shell above it has a floating pane open. */
  overlayOpenAtOrAbove: () => boolean
}

export const APP_SHELL_NESTING_KEY = Symbol('appShellNesting')

// Nesting: whether a shell hides its own floating panes. Suppression needs
// both conditions — a nested shell suppresses only while it floats and an
// ancestor overlay is open. Docked panes never suppress; a suppressed pane
// stays mounted and is only visibility-hidden, so there is no remount or
// slide-out glitch and the preserved `open` state restores it.
export function shouldSuppressFloatingPane(floating: boolean, ancestorOverlayOpen: boolean): boolean {
  return floating && ancestorOverlayOpen
}

// Nesting: the overlay state a shell publishes to the shells below it — its
// own floating panes plus anything open above — so suppression chains to any
// depth and an outer overlay always covers every inner one.
export function combineNestingOverlay(selfOverlayOpen: boolean, ancestorOverlayOpen: boolean): boolean {
  return selfOverlayOpen || ancestorOverlayOpen
}

export function resolveDrawerFloating(mode: AppShellDrawerMode, desktopLayout: boolean): boolean {
  if (mode === 'floating') {
    return true
  }
  if (mode === 'docked') {
    return false
  }
  return !desktopLayout
}

export function clampPaneWidth(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback
  }
  return Math.min(max, Math.max(min, Math.round(value)))
}

// A rail-mode drag at or below the rail width collapses the pane instead of
// parking it at a narrow width.
export function collapsesToRail(next: number, railWidth: number): boolean {
  return next <= railWidth
}

export function loadPaneSize(storageKey: string | undefined, fallback: number, min: number, max: number): number {
  if (!storageKey || typeof localStorage === 'undefined') {
    return fallback
  }
  try {
    const raw = localStorage.getItem(storageKey)
    if (raw === null) {
      return fallback
    }
    return clampPaneWidth(Number.parseInt(raw, 10), min, max, fallback)
  } catch (error) {
    console.error('Failed to load pane width from localStorage', { error })
    return fallback
  }
}

export function savePaneSize(storageKey: string | undefined, value: number): void {
  if (!storageKey || typeof localStorage === 'undefined') {
    return
  }
  try {
    localStorage.setItem(storageKey, String(Math.round(value)))
  } catch (error) {
    console.error('Failed to save pane width to localStorage', { error })
  }
}
