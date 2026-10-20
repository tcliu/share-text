<script lang="ts">
  import { slide } from 'svelte/transition'
  import Splitter from './Splitter.svelte'
  import type { AppShellDrawer } from './use-app-shell-drawer.svelte'
  import type { Snippet } from 'svelte'

  interface Props {
    drawer: AppShellDrawer
    pane: Snippet | undefined
    side: 'left' | 'right'
    label: string
    paneLabel: string
    paneClass: string
    floating: boolean
    suppressed: boolean
    max: number
    splitterClassName: string
    slideParams: { axis: 'x'; duration: number }
  }

  let {
    drawer,
    pane,
    side,
    label,
    paneLabel,
    paneClass,
    floating,
    suppressed,
    max,
    splitterClassName,
    slideParams,
  }: Props = $props()
</script>

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
    ? `app-shell-pane absolute inset-y-0 z-20 flex min-h-0 w-[var(--pane-w)] max-w-full min-w-0 bg-slate-950 ${side === 'right' ? 'right-0' : 'left-0'}`
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
      ? `@container flex min-h-0 w-full min-w-0 flex-col gap-2 overflow-hidden border-slate-800 bg-slate-950 ${side === 'right' ? 'border-l' : 'border-r'} ${paneClass}`
      : `@container flex min-h-0 min-w-0 flex-col gap-2 overflow-hidden border-slate-800 ${side === 'right' ? 'border-l' : 'border-r'} ${paneClass}`}
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
