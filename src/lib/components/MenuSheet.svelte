<script lang="ts">
  import type { Snippet } from 'svelte'
  import { positionPanel } from '$lib/position-panel.svelte'
  import { dragCloseDown } from '$lib/actions/drag-close-down'
  import CloseIcon from '$lib/icons/CloseIcon.svelte'

  interface Props {
    containerRef: HTMLElement | null
    overlayRef: HTMLElement | null
    dialogRef: HTMLElement | null
    menuId: string
    sheetTitleId: string
    ariaLabel: string
    phoneSheetTitle: string | undefined
    sheetCloseLabel: string
    sheetDragOffset: number
    sheetDragging: boolean
    sheetTransition: string | undefined
    onClose: () => void
    onDragUpdate: (offset: number, active: boolean) => void
    onPanelKeydown: (event: KeyboardEvent) => void
    onFocusOut: (event: FocusEvent) => void
    options: Snippet
  }

  let {
    containerRef,
    overlayRef = $bindable(),
    dialogRef = $bindable(),
    menuId,
    sheetTitleId,
    ariaLabel,
    phoneSheetTitle,
    sheetCloseLabel,
    sheetDragOffset,
    sheetDragging,
    sheetTransition,
    onClose,
    onDragUpdate,
    onPanelKeydown,
    onFocusOut,
    options,
  }: Props = $props()
</script>

<div
  bind:this={overlayRef}
  use:positionPanel={() => ({ getTrigger: () => containerRef, getOpen: () => true, presentation: 'sheet' })}
  class="fixed inset-0 z-40 flex items-end justify-center">
  <button
    type="button"
    aria-label={sheetCloseLabel}
    tabindex="-1"
    class="absolute inset-0 bg-slate-950/80 outline-none"
    onclick={onClose}></button>
  <div
    bind:this={dialogRef}
    role="dialog"
    aria-labelledby={sheetTitleId}
    onfocusout={onFocusOut}
    style:transform={sheetDragging || sheetDragOffset !== 0 ? `translateY(${sheetDragOffset}px)` : undefined}
    style:transition={sheetTransition}
    style:animation={sheetDragging ? 'none' : undefined}
    style:will-change={sheetDragging ? 'transform' : undefined}
    class="menu-sheet-enter relative flex max-h-[min(75dvh,32rem)] w-full flex-col overflow-hidden rounded-t-2xl border border-x-0 border-b-0 border-slate-800 bg-slate-900/95 shadow-2xl shadow-slate-950/60 backdrop-blur transition-transform duration-200 ease-out motion-reduce:transition-none">
    <div
      class="relative flex flex-none cursor-grab touch-pan-x items-start justify-between gap-3 border-b border-slate-800 px-4 pt-4 pb-3 active:cursor-grabbing"
      use:dragCloseDown={{
        isEnabled: () => true,
        onDragUpdate,
        onClose,
      }}>
      <div aria-hidden="true" class="absolute top-2 left-1/2 h-1 w-10 -translate-x-1/2 rounded-full bg-slate-700">
      </div>
      <h2 id={sheetTitleId} class="pt-3 text-base font-semibold tracking-tight text-slate-100">
        {phoneSheetTitle}
      </h2>
      <button
        type="button"
        aria-label={sheetCloseLabel}
        data-drag-ignore
        onclick={onClose}
        class="relative shrink-0 rounded-md p-2.5 text-slate-500 transition outline-none before:absolute before:-inset-1.5 before:content-[''] hover:text-slate-100 focus-visible:text-slate-100 motion-reduce:transition-none">
        <CloseIcon size="sm" className="pointer-events-none" />
      </button>
    </div>
    <div
      id={menuId}
      role="menu"
      tabindex="-1"
      aria-label={ariaLabel}
      onkeydown={onPanelKeydown}
      class="min-h-0 overflow-y-auto px-2 py-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] outline-none">
      {@render options()}
    </div>
  </div>
</div>

<style>
  @keyframes menu-sheet-up {
    from {
      transform: translateY(1.5rem);
      opacity: 0;
    }
    to {
      transform: none;
      opacity: 1;
    }
  }
  .menu-sheet-enter {
    animation: menu-sheet-up 180ms ease-out;
  }
  @media (prefers-reduced-motion: reduce) {
    .menu-sheet-enter {
      animation: none;
    }
  }
</style>
