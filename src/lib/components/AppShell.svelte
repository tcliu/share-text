<script lang="ts">
  import type { Snippet } from 'svelte'
  import { getContext, onMount, setContext } from 'svelte'
  import { slide } from 'svelte/transition'
  import { getI18nContext } from '$lib/i18n.svelte'
  import {
    APP_SHELL_DEFAULT_WIDTH,
    APP_SHELL_DESKTOP_BREAKPOINT,
    APP_SHELL_MAX_WIDTH,
    APP_SHELL_MIN_WIDTH,
    APP_SHELL_RAIL_WIDTH,
    resolveDrawerFloating,
    shouldSuppressFloatingPane,
    combineNestingOverlay,
    type AppShellCollapseMode,
    type AppShellDrawerMode,
    type AppShellHeaderApi,
    type AppShellNesting,
    APP_SHELL_NESTING_KEY,
  } from '$lib/app-shell'
  import Splitter from '$lib/components/Splitter.svelte'
  import AppShellPane from './AppShellPane.svelte'
  import { AppShellDrawer } from './use-app-shell-drawer.svelte'

  // One drawer side's config. The component keeps its own open/size state so it
  // works standalone; a caller that owns those values passes them here and
  // observes every change through the `on*` callbacks. Each field falls back to
  // the shared default, so the right side inherits the same geometry as the
  // left.
  export interface AppShellPaneConfig {
    open?: boolean
    size?: number
    defaultSize?: number
    collapseMode?: AppShellCollapseMode
    railWidth?: number
    min?: number
    max?: number
    storageKey?: string
    resizeLabel?: string
    paneLabel?: string
    onOpenChange?: (open: boolean) => void
    onSizeChange?: (size: number) => void
    onDragEnd?: () => void
  }

  export interface AppShellClassNames {
    header?: string
    footer?: string
    pane?: string
    rightPane?: string
    main?: string
    splitter?: string
  }

  interface Props {
    className?: string
    mode?: AppShellDrawerMode
    closeLabel?: string
    classNames?: AppShellClassNames
    left?: AppShellPaneConfig
    right?: AppShellPaneConfig
    onLayoutModeChange?: (floating: boolean) => void
    header?: Snippet<[AppShellHeaderApi]>
    footer?: Snippet
    leftPane?: Snippet
    rightPane?: Snippet
    children?: Snippet
  }

  let {
    className = 'flex h-full min-h-0 flex-col bg-slate-950 text-slate-100',
    mode = 'auto',
    closeLabel = undefined,
    classNames = {},
    left = {},
    right = {},
    onLayoutModeChange = undefined,
    header = undefined,
    footer = undefined,
    leftPane = undefined,
    rightPane = undefined,
    children = undefined,
  }: Props = $props()

  const i18n = getI18nContext()

  // Open and size are caller-controlled but must also work standalone: a local
  // toggle or drag writes an override the derived value prefers, and an effect
  // drops that override the moment the caller's own value changes, so an
  // external update always wins. Clearing only on an actual value change (not
  // on every config re-render) keeps an unrelated field edit from clobbering
  // the local override.
  let leftOpenOverride = $state<boolean | null>(null)
  let leftSizeOverride = $state<number | null>(null)
  let rightOpenOverride = $state<boolean | null>(null)
  let rightSizeOverride = $state<number | null>(null)
  let seenLeftOpen: boolean | undefined = undefined
  let seenLeftSize: number | undefined = undefined
  let seenRightOpen: boolean | undefined = undefined
  let seenRightSize: number | undefined = undefined

  const leftOpen = $derived(leftOpenOverride ?? left.open ?? true)
  const leftSize = $derived(leftSizeOverride ?? left.size ?? APP_SHELL_DEFAULT_WIDTH)
  const rightOpen = $derived(rightOpenOverride ?? right.open ?? false)
  const rightSize = $derived(rightSizeOverride ?? right.size ?? APP_SHELL_DEFAULT_WIDTH)

  $effect(() => {
    if (left.open !== seenLeftOpen) {
      seenLeftOpen = left.open
      leftOpenOverride = null
    }
    if (left.size !== seenLeftSize) {
      seenLeftSize = left.size
      leftSizeOverride = null
    }
    if (right.open !== seenRightOpen) {
      seenRightOpen = right.open
      rightOpenOverride = null
    }
    if (right.size !== seenRightSize) {
      seenRightSize = right.size
      rightSizeOverride = null
    }
  })

  const resolvedResizeLabel = $derived(left.resizeLabel ?? i18n.t('appShell.resize'))
  const resolvedRightResizeLabel = $derived(right.resizeLabel ?? i18n.t('appShell.resizeRight'))
  const resolvedCloseLabel = $derived(closeLabel ?? i18n.t('appShell.closePane'))
  const resolvedPaneLabel = $derived(left.paneLabel ?? i18n.t('appShell.leftPane'))
  const resolvedRightPaneLabel = $derived(right.paneLabel ?? i18n.t('appShell.rightPane'))
  const leftMin = $derived(left.min ?? APP_SHELL_MIN_WIDTH)
  const leftMax = $derived(left.max ?? APP_SHELL_MAX_WIDTH)
  const rightMax = $derived(right.max ?? APP_SHELL_MAX_WIDTH)
  const headerClass = $derived(classNames.header ?? '')
  const footerClass = $derived(classNames.footer ?? '')
  const paneClass = $derived(classNames.pane ?? '')
  const rightPaneClass = $derived(classNames.rightPane ?? '')
  const mainClass = $derived(classNames.main ?? '')
  const splitterClass = $derived(classNames.splitter ?? '')

  // One responsive ruler: desktop vs narrow is measured from the shell's own
  // container (via ResizeObserver below), never from the viewport, so an
  // embedded shell floats its drawers when its space is narrow even on a wide
  // screen. The default keeps the server/first paint docked; the observer
  // corrects it after mount. Every presentation decision below derives from
  // `floating`, so measurement and layout can never disagree. Until the
  // measurement lands, a viewport-width CSS guard (below) hides the pane on
  // narrow screens so the first paint never shows the squeezed docked pane.
  let reduceMotion = $state(false)
  // Flips on the first pointer/key interaction. Transition params gate on it
  // so the initial paint never slides a pane in (see `slideParams`).
  let userInteracted = $state(false)
  let measured = $state(false)
  let containerWidth = $state(APP_SHELL_DESKTOP_BREAKPOINT)
  let rootEl = $state<HTMLElement | null>(null)
  let mainEl = $state<HTMLElement | null>(null)
  const desktopLayout = $derived(containerWidth >= APP_SHELL_DESKTOP_BREAKPOINT)

  // Floating is global: both drawers share the presentation mode so the
  // overlay, backdrop, and dismissal behavior stay consistent. Below the
  // desktop breakpoint every `auto` pane floats — rail panes included, as an
  // open-or-closed overlay (the rail strip is a docked-only affordance).
  const floating = $derived(resolveDrawerFloating(mode, desktopLayout))
  // Panes only ever slide sideways: docked panes sit in a row and floating
  // panes overlay it, so there is no stacked state needing a vertical axis.
  // The slide responds to a user toggle (the header menu), never the initial
  // paint: until the first interaction the duration is zero, so a pane that
  // mounts while the page settles (the docked pane once the container measures
  // desktop) appears in place instead of sweeping across on load.
  const slideParams = $derived({
    axis: 'x',
    duration: userInteracted && !reduceMotion ? 200 : 0,
  } as const)

  const leftDrawer: AppShellDrawer = new AppShellDrawer({
    getOpen: () => leftOpen,
    setOpen: value => (leftOpenOverride = value),
    getSize: () => leftSize,
    setSize: value => (leftSizeOverride = value),
    notifyOpenChange: value => left.onOpenChange?.(value),
    notifySizeChange: value => left.onSizeChange?.(value),
    notifyDragEnd: () => left.onDragEnd?.(),
    collapseMode: () => left.collapseMode ?? 'hide',
    railWidth: () => left.railWidth ?? APP_SHELL_RAIL_WIDTH,
    min: () => left.min ?? APP_SHELL_MIN_WIDTH,
    max: () => left.max ?? APP_SHELL_MAX_WIDTH,
    defaultSize: () => left.defaultSize ?? APP_SHELL_DEFAULT_WIDTH,
    storageKey: () => left.storageKey,
    floating: () => floating,
    // Fall back to the other open drawer, then the main column, so closing one
    // pane never drops focus onto an inert element.
    focusFallback: (): HTMLElement | null => (rightDrawer.floatingOpen ? rightDrawer.asideEl : mainEl),
  })
  const rightDrawer: AppShellDrawer = new AppShellDrawer({
    getOpen: () => rightOpen,
    setOpen: value => (rightOpenOverride = value),
    getSize: () => rightSize,
    setSize: value => (rightSizeOverride = value),
    notifyOpenChange: value => right.onOpenChange?.(value),
    notifySizeChange: value => right.onSizeChange?.(value),
    notifyDragEnd: () => right.onDragEnd?.(),
    collapseMode: () => right.collapseMode ?? 'hide',
    railWidth: () => right.railWidth ?? APP_SHELL_RAIL_WIDTH,
    min: () => right.min ?? APP_SHELL_MIN_WIDTH,
    max: () => right.max ?? APP_SHELL_MAX_WIDTH,
    defaultSize: () => right.defaultSize ?? APP_SHELL_DEFAULT_WIDTH,
    storageKey: () => right.storageKey,
    floating: () => floating,
    focusFallback: (): HTMLElement | null => (leftDrawer.floatingOpen ? leftDrawer.asideEl : mainEl),
  })

  const overlayOpen = $derived(leftDrawer.floatingOpen || rightDrawer.floatingOpen)

  // Nested shells hide their own floating panes while an ancestor overlay
  // is open, so an outer overlay always covers an inner one instead of
  // stacking under it. Only floating panes suppress; docked panes stay put.
  // Suppression is visibility-only: the panes stay mounted (no remount or
  // slide-out glitch) and the preserved `open` state restores them.
  const parentNesting = getContext<AppShellNesting | undefined>(APP_SHELL_NESTING_KEY)
  const ancestorOverlayOpen = $derived(parentNesting?.overlayOpenAtOrAbove() ?? false)
  const suppressed = $derived(shouldSuppressFloatingPane(floating, ancestorOverlayOpen))
  setContext<AppShellNesting>(APP_SHELL_NESTING_KEY, {
    overlayOpenAtOrAbove: () => combineNestingOverlay(overlayOpen, ancestorOverlayOpen),
  })

  // Programmatic drawer API handed to the `header` snippet so callers can
  // render their own toggles. Routing through the drawers keeps focus return
  // and change notifications identical to the former built-in buttons.
  const headerApi = $derived<AppShellHeaderApi>({
    open: leftOpen,
    rightOpen,
    toggleLeft: () => leftDrawer.setOpen(!leftOpen),
    toggleRight: () => rightDrawer.setOpen(!rightOpen),
  })

  // Report the resolved presentation so a caller can keep app-level behavior
  // (e.g. a route-driven overlay sync or a close affordance) on the same ruler
  // the shell lays the pane out with, instead of a second viewport breakpoint.
  $effect(() => {
    onLayoutModeChange?.(floating)
  })

  onMount(() => {
    leftDrawer.restoreSize()
    rightDrawer.restoreSize()
    // Arm the slide transition only after the user does anything; a bare page
    // load must not animate a pane in. Capture phase so the flag is set before
    // the same gesture's click toggles the drawer.
    const markUserInteraction = () => {
      userInteracted = true
      window.removeEventListener('pointerdown', markUserInteraction, true)
      window.removeEventListener('keydown', markUserInteraction, true)
    }
    window.addEventListener('pointerdown', markUserInteraction, true)
    window.addEventListener('keydown', markUserInteraction, true)
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const syncMotion = () => {
      reduceMotion = motionQuery.matches
    }
    syncMotion()
    motionQuery.addEventListener('change', syncMotion)
    // Measure once synchronously so the first hydrated frame already matches
    // the container, then track later resizes.
    if (rootEl) {
      containerWidth = rootEl.clientWidth > 0 ? rootEl.clientWidth : APP_SHELL_DESKTOP_BREAKPOINT
    }
    const resizeObserver = new ResizeObserver(entries => {
      const width = entries[0]?.contentRect.width ?? 0
      containerWidth = width > 0 ? width : APP_SHELL_DESKTOP_BREAKPOINT
    })
    if (rootEl) {
      resizeObserver.observe(rootEl)
    }
    measured = true
    return () => {
      motionQuery.removeEventListener('change', syncMotion)
      resizeObserver.disconnect()
      window.removeEventListener('pointerdown', markUserInteraction, true)
      window.removeEventListener('keydown', markUserInteraction, true)
    }
  })

  function handleBackdropClick(): void {
    if (rightDrawer.floatingOpen) {
      rightDrawer.setOpen(false)
    }
    if (leftDrawer.floatingOpen) {
      leftDrawer.setOpen(false)
    }
  }

  function handleDrawerEscape(event: KeyboardEvent): void {
    if (event.key !== 'Escape' || event.defaultPrevented || !overlayOpen || suppressed) {
      return
    }
    // Cooperative dismissal: BaseDialog handles Escape in the capture phase
    // and stops propagation, so this bubble listener runs only when no dialog
    // consumed the key. Mark it consumed with preventDefault so the toast
    // listener on window does not also dismiss, then close the drawer the user
    // is interacting with, else the right one.
    event.preventDefault()
    const target = event.target
    const inRight = target instanceof Element && (rightDrawer.asideEl?.contains(target) ?? false)
    const inLeft = target instanceof Element && (leftDrawer.asideEl?.contains(target) ?? false)
    if (inRight && rightDrawer.floatingOpen) {
      rightDrawer.setOpen(false)
    } else if (inLeft && leftDrawer.floatingOpen) {
      leftDrawer.setOpen(false)
    } else if (rightDrawer.floatingOpen) {
      rightDrawer.setOpen(false)
    } else {
      leftDrawer.setOpen(false)
    }
  }
</script>

{#snippet drawerPane(
  drawer: AppShellDrawer,
  pane: Snippet | undefined,
  side: 'left' | 'right',
  label: string,
  paneLabel: string,
  paneClass: string,
)}
  <AppShellPane
    {drawer}
    {pane}
    {side}
    {label}
    {paneLabel}
    {paneClass}
    {floating}
    {suppressed}
    max={side === 'right' ? rightMax : leftMax}
    splitterClassName={splitterClass}
    {slideParams} />
{/snippet}

<svelte:document onkeydown={handleDrawerEscape} />

<div class={className} data-shell-measured={mode === 'auto' ? String(measured) : null}>
  {#if header}
    <header
      class={`flex flex-none items-center justify-between gap-4 border-b border-slate-800 px-3 py-3 sm:px-4 ${headerClass}`}>
      {@render header(headerApi)}
    </header>
  {/if}
  <div bind:this={rootEl} class="relative flex min-h-0 flex-1 flex-row" style="min-width: {leftMin}px">
    {#if leftDrawer.visible}
      {@render drawerPane(leftDrawer, leftPane, 'left', resolvedResizeLabel, resolvedPaneLabel, paneClass)}
    {/if}

    <main
      bind:this={mainEl}
      tabindex="-1"
      inert={overlayOpen}
      class={`min-h-0 min-w-0 flex-1 overflow-y-auto outline-none ${mainClass}`}>
      {@render children?.()}
    </main>

    {#if rightDrawer.visible}
      {@render drawerPane(
        rightDrawer,
        rightPane,
        'right',
        resolvedRightResizeLabel,
        resolvedRightPaneLabel,
        rightPaneClass,
      )}
    {/if}

    {#if overlayOpen}
      <!-- tabindex="-1" keeps the backdrop out of the tab order; prevent
        pointerdown focus too, so closing by tapping the backdrop never parks
        focus on the unmounting button and drops it to <body>. -->
      <button
        type="button"
        tabindex="-1"
        aria-label={resolvedCloseLabel}
        class={`absolute inset-0 z-30 bg-slate-950/60 ${suppressed ? 'invisible' : ''}`}
        onpointerdown={event => event.preventDefault()}
        onclick={handleBackdropClick}></button>
    {/if}
  </div>
  {#if footer}
    <footer
      class={`flex flex-none items-center justify-between gap-4 border-t border-slate-800 px-3 py-3 sm:px-4 ${footerClass}`}>
      {@render footer?.()}
    </footer>
  {/if}
</div>

<style>
  /* Until the shell has measured its container, hide the pane on a narrow
     viewport so the server/first paint never shows the squeezed docked pane;
     the measured floating presentation replaces it. The viewport query matches
     the shell's own container breakpoint for a top-level shell. */
  @media (max-width: 767px) {
    :global([data-shell-measured='false']) :global(.app-shell-pane) {
      display: none;
    }
  }
</style>
