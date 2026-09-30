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
  import { AppShellDrawer } from './use-app-shell-drawer.svelte'

  interface Props {
    className?: string
    mode?: AppShellDrawerMode
    open?: boolean
    paneSize?: number
    collapseMode?: AppShellCollapseMode
    railWidth?: number
    min?: number
    max?: number
    defaultSize?: number
    storageKey?: string
    resizeLabel?: string
    closeLabel?: string
    leftPaneLabel?: string
    rightPaneLabel?: string
    rightOpen?: boolean
    rightPaneSize?: number
    rightCollapseMode?: AppShellCollapseMode
    rightStorageKey?: string
    rightResizeLabel?: string
    headerClassName?: string
    footerClassName?: string
    paneClassName?: string
    rightPaneClassName?: string
    mainClassName?: string
    splitterClassName?: string
    onOpenChange?: (open: boolean) => void
    onPaneChange?: (size: number) => void
    onDragEnd?: () => void
    onLayoutModeChange?: (floating: boolean) => void
    onRightOpenChange?: (open: boolean) => void
    onRightPaneChange?: (size: number) => void
    onRightDragEnd?: () => void
    header?: Snippet<[AppShellHeaderApi]>
    footer?: Snippet
    leftPane?: Snippet
    rightPane?: Snippet
    children?: Snippet
  }

  let {
    className = 'flex h-dvh flex-col overflow-hidden',
    mode = 'auto',
    open = $bindable(true),
    paneSize = $bindable(APP_SHELL_DEFAULT_WIDTH),
    collapseMode = 'hide',
    railWidth = APP_SHELL_RAIL_WIDTH,
    min = APP_SHELL_MIN_WIDTH,
    max = APP_SHELL_MAX_WIDTH,
    defaultSize = APP_SHELL_DEFAULT_WIDTH,
    storageKey = undefined,
    resizeLabel = undefined,
    closeLabel = undefined,
    leftPaneLabel = undefined,
    rightPaneLabel = undefined,
    rightOpen = $bindable(false),
    rightPaneSize = $bindable(APP_SHELL_DEFAULT_WIDTH),
    rightCollapseMode = 'hide',
    rightStorageKey = undefined,
    rightResizeLabel = undefined,
    headerClassName = '',
    footerClassName = '',
    paneClassName = '',
    rightPaneClassName = '',
    mainClassName = '',
    splitterClassName = '',
    onOpenChange = undefined,
    onPaneChange = undefined,
    onDragEnd = undefined,
    onLayoutModeChange = undefined,
    onRightOpenChange = undefined,
    onRightPaneChange = undefined,
    onRightDragEnd = undefined,
    header = undefined,
    footer = undefined,
    leftPane = undefined,
    rightPane = undefined,
    children = undefined,
  }: Props = $props()

  const i18n = getI18nContext()

  const resolvedResizeLabel = $derived(resizeLabel ?? i18n.t('appShell.resize'))
  const resolvedRightResizeLabel = $derived(rightResizeLabel ?? i18n.t('appShell.resizeRight'))
  const resolvedCloseLabel = $derived(closeLabel ?? i18n.t('appShell.closePane'))
  const resolvedLeftPaneLabel = $derived(leftPaneLabel ?? i18n.t('appShell.leftPane'))
  const resolvedRightPaneLabel = $derived(rightPaneLabel ?? i18n.t('appShell.rightPane'))

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
    getOpen: () => open,
    setOpen: value => (open = value),
    getSize: () => paneSize,
    setSize: value => (paneSize = value),
    notifyOpenChange: value => onOpenChange?.(value),
    notifySizeChange: value => onPaneChange?.(value),
    notifyDragEnd: () => onDragEnd?.(),
    collapseMode: () => collapseMode,
    railWidth: () => railWidth,
    min: () => min,
    max: () => max,
    defaultSize: () => defaultSize,
    storageKey: () => storageKey,
    floating: () => floating,
    // Fall back to the other open drawer, then the main column, so closing one
    // pane never drops focus onto an inert element.
    focusFallback: (): HTMLElement | null => (rightDrawer.floatingOpen ? rightDrawer.asideEl : mainEl),
  })
  const rightDrawer: AppShellDrawer = new AppShellDrawer({
    getOpen: () => rightOpen,
    setOpen: value => (rightOpen = value),
    getSize: () => rightPaneSize,
    setSize: value => (rightPaneSize = value),
    notifyOpenChange: value => onRightOpenChange?.(value),
    notifySizeChange: value => onRightPaneChange?.(value),
    notifyDragEnd: () => onRightDragEnd?.(),
    collapseMode: () => rightCollapseMode,
    railWidth: () => railWidth,
    min: () => min,
    max: () => max,
    defaultSize: () => defaultSize,
    storageKey: () => rightStorageKey,
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
    open,
    rightOpen,
    toggleLeft: () => leftDrawer.setOpen(!open),
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
  <!-- One wrapper for both presentations: switching docked <-> floating only
    changes classes, so the pane never remounts (which would leave a stale
    outro copy alongside the new pane during the transition). The opaque
    surface lives on the wrapper, not only the aside, so content never shows
    through the pane body. -->
  <div
    in:slide={slideParams}
    out:slide={slideParams}
    data-drawer-presentation={floating ? 'floating' : 'docked'}
    data-suppressed={suppressed ? '' : null}
    aria-hidden={suppressed ? 'true' : undefined}
    class={floating
      ? `app-shell-pane absolute inset-y-0 z-40 flex min-h-0 w-[var(--pane-w)] max-w-full min-w-0 bg-slate-950 ${side === 'right' ? 'right-0' : 'left-0'}`
      : 'app-shell-pane flex min-h-0 w-[var(--pane-w)] max-w-[calc(100%-3rem)] min-w-0 shrink-0 flex-row'}
    style={`--pane-w: ${drawer.effectiveSize}px;${suppressed ? 'visibility:hidden;' : ''}`}>
    {#if !floating && side === 'right'}
      <Splitter
        orientation="vertical"
        invert
        className={splitterClassName}
        value={drawer.effectiveSize}
        min={drawer.splitterMin}
        {max}
        ariaLabel={label}
        onChange={next => drawer.changeSize(next)}
        onDragEnd={() => drawer.save()} />
    {/if}
    <aside
      bind:this={drawer.asideEl}
      class={floating
        ? `flex min-h-0 w-full min-w-0 flex-col gap-2 border-slate-800 bg-slate-950 ${side === 'right' ? 'border-l' : 'border-r'} ${paneClass}`
        : `flex min-h-0 min-w-0 flex-col gap-2 border-slate-800 ${side === 'right' ? 'border-l' : 'border-r'} ${paneClass}`}
      style="flex-basis: var(--pane-w)"
      aria-label={paneLabel}
      tabindex="-1">
      {@render pane?.()}
    </aside>
    {#if !floating && side === 'left'}
      <Splitter
        orientation="vertical"
        className={splitterClassName}
        value={drawer.effectiveSize}
        min={drawer.splitterMin}
        {max}
        ariaLabel={label}
        onChange={next => drawer.changeSize(next)}
        onDragEnd={() => drawer.save()} />
    {/if}
  </div>
{/snippet}

<svelte:document onkeydown={handleDrawerEscape} />

<div class={className} data-shell-measured={mode === 'auto' ? String(measured) : null}>
  <header
    class={`flex flex-none items-center justify-between gap-4 border-b border-slate-800 px-3 py-3 sm:px-4 ${headerClassName}`}>
    {@render header?.(headerApi)}
  </header>
  <div bind:this={rootEl} class="relative flex min-h-0 flex-1 flex-row" style="min-width: {min}px">
    {#if leftDrawer.visible}
      {@render drawerPane(leftDrawer, leftPane, 'left', resolvedResizeLabel, resolvedLeftPaneLabel, paneClassName)}
    {/if}

    <main
      bind:this={mainEl}
      tabindex="-1"
      inert={overlayOpen}
      class={`min-h-0 min-w-0 flex-1 overflow-y-auto outline-none ${mainClassName}`}>
      {@render children?.()}
    </main>

    {#if rightDrawer.visible}
      {@render drawerPane(
        rightDrawer,
        rightPane,
        'right',
        resolvedRightResizeLabel,
        resolvedRightPaneLabel,
        rightPaneClassName,
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
      class={`flex flex-none items-center justify-between gap-4 border-t border-slate-800 px-3 py-3 sm:px-4 ${footerClassName}`}>
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
