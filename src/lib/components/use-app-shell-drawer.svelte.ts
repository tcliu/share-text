// Per-side drawer controller for AppShell. One pane's geometry, rail
// collapse, persistence, and floating-overlay focus moves live here so the
// component wires the left and right panes through the same implementation
// instead of mirroring the logic twice.
import { tick } from 'svelte'
import { clampPaneWidth, collapsesToRail, loadPaneSize, savePaneSize, type AppShellCollapseMode } from '$lib/app-shell'

export interface AppShellDrawerOptions {
  getOpen: () => boolean
  setOpen: (open: boolean) => void
  getSize: () => number
  setSize: (size: number) => void
  notifyOpenChange: (open: boolean) => void
  notifySizeChange: (size: number) => void
  notifyDragEnd: () => void
  collapseMode: () => AppShellCollapseMode
  railWidth: () => number
  min: () => number
  max: () => number
  defaultSize: () => number
  storageKey: () => string | undefined
  floating: () => boolean
  // Element to focus when this drawer closes; the caller points it at the
  // other open drawer or at the main column.
  focusFallback: () => HTMLElement | null
}

// Focus after Svelte flushes the state change that mounts/unmounts the pane.
function focusAfterTick(target: HTMLElement | null): void {
  if (!target) {
    return
  }
  tick().then(() => target.focus({ preventScroll: true }))
}

export class AppShellDrawer {
  // Bound to the pane element so opening a floating drawer moves focus into it.
  asideEl = $state<HTMLElement | null>(null)
  private readonly options: AppShellDrawerOptions

  constructor(options: AppShellDrawerOptions) {
    this.options = options
  }

  get open(): boolean {
    return this.options.getOpen()
  }

  // Rail collapse only applies to a docked pane; a floating drawer is either
  // open above the content or closed.
  get visible(): boolean {
    return this.open || (this.options.collapseMode() === 'rail' && !this.options.floating())
  }

  get floatingOpen(): boolean {
    return this.options.floating() && this.open
  }

  get effectiveSize(): number {
    return this.open ? this.options.getSize() : this.options.railWidth()
  }

  get splitterMin(): number {
    return this.options.collapseMode() === 'rail' ? this.options.railWidth() : this.options.min()
  }

  restoreSize(): void {
    const loaded = loadPaneSize(
      this.options.storageKey(),
      this.options.defaultSize(),
      this.options.min(),
      this.options.max(),
    )
    if (loaded !== this.options.getSize()) {
      this.options.setSize(loaded)
    }
  }

  setOpen(next: boolean): void {
    this.options.setOpen(next)
    this.options.notifyOpenChange(next)
    if (!this.options.floating()) {
      return
    }
    if (next) {
      focusAfterTick(this.asideEl)
      return
    }
    // Closing: reclaim focus only when it is still inside the pane (or was
    // never placed). A caller that already moved focus — e.g. back to its
    // trigger during notifyOpenChange — keeps it instead of being overridden
    // after the flush.
    const active = document.activeElement
    const callerTookFocus = active !== null && active !== document.body && !(this.asideEl?.contains(active) ?? false)
    if (!callerTookFocus) {
      focusAfterTick(this.options.focusFallback())
    }
  }

  changeSize(next: number): void {
    const { collapseMode, railWidth, min, max, defaultSize } = this.options
    if (collapseMode() === 'rail' && collapsesToRail(next, railWidth())) {
      const size = defaultSize()
      this.options.setSize(size)
      this.options.notifySizeChange(size)
      this.setOpen(false)
      return
    }
    const size = clampPaneWidth(next, min(), max(), defaultSize())
    this.options.setSize(size)
    this.options.notifySizeChange(size)
  }

  save(): void {
    savePaneSize(this.options.storageKey(), this.options.getSize())
    this.options.notifyDragEnd()
  }
}
