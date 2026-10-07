<script module lang="ts">
  import type { Snippet } from 'svelte'

  export interface MenuItemState {
    index: number
    active: boolean
    disabled: boolean
  }
</script>

<script lang="ts" generics="T">
  // Menu owns the icon-trigger dropdown (desktop popover, phone bottom sheet).
  import { flushSync, onMount, tick, untrack } from 'svelte'
  import { positionPanel } from '$lib/position-panel.svelte'
  import { useListbox } from '$lib/actions/use-listbox.svelte'
  import { PHONE_SHEET_QUERY, type DropdownPanelProps } from '$lib/dropdown-chrome'
  import Tooltip from './Tooltip.svelte'
  import MenuSheet from './MenuSheet.svelte'

  interface MenuBaseProps extends DropdownPanelProps {
    items: T[]
    itemKey: (item: T) => string
    onSelect: (index: number) => void
    icon: Snippet
    item: Snippet<[T, MenuItemState]>
    ariaLabel: string
    id?: string
    triggerClass?: string
    triggerTooltip?: string
    triggerTooltipAlign?: 'center' | 'left' | 'right'
    itemClass?: (item: T, state: MenuItemState) => string
    itemRole?: 'menuitem' | 'menuitemradio'
    itemChecked?: (item: T) => boolean
    itemDisabled?: (item: T) => boolean
    // Searchable text for type-ahead; when omitted, typing does nothing.
    itemLabel?: (item: T) => string
  }

  // A sheet title opts into the phone bottom-sheet presentation and must
  // carry its own close label so the dismiss button is never announced with
  // the menu's name by accident.
  type Props = MenuBaseProps &
    ({ phoneSheetTitle?: undefined; closeLabel?: string } | { phoneSheetTitle: string; closeLabel: string })

  let {
    items,
    itemKey,
    onSelect,
    icon,
    item,
    ariaLabel,
    id,
    align = 'right',
    autoPlace = true,
    triggerClass = '',
    triggerTooltip,
    triggerTooltipAlign = 'center',
    panelClass = '',
    itemClass,
    itemRole = 'menuitem',
    itemChecked,
    itemDisabled = () => false,
    itemLabel,
    phoneSheetTitle,
    closeLabel,
  }: Props = $props()

  const fallbackId = $props.id()
  const menuId = $derived(`menu-${id ?? fallbackId}`)
  const sheetTitleId = $derived(`${menuId}-title`)
  // closeLabel is required alongside phoneSheetTitle (see Props); the
  // fallback only serves plain menus, which never render the sheet branch.
  // Derived (not a plain const) so locale switches re-resolve the label.
  const sheetCloseLabel = $derived(closeLabel ?? ariaLabel)

  let open = $state(false)
  let containerRef = $state<HTMLDivElement | null>(null)
  let triggerRef = $state<HTMLButtonElement | null>(null)
  let tooltipTriggerEl = $state<HTMLElement | null>(null)
  let overlayRef = $state<HTMLDivElement | null>(null)
  let panelRef = $state<HTMLDivElement | null>(null)
  let dialogRef = $state<HTMLDivElement | null>(null)
  let itemRefs = $state<HTMLButtonElement[]>([])
  let isPhoneViewport = $state(false)
  let sheetDragOffset = $state(0)
  let sheetDragging = $state(false)
  let reduceMotion = $state(false)
  const usePhoneSheet = $derived(phoneSheetTitle !== undefined && isPhoneViewport)

  // isPhoneViewport only resolves via matchMedia after mount, so phones first
  // paint the popover branch before swapping to the sheet — accepted flash,
  // the cheapest stable option (no SSR viewport guess, no forced sheet).

  onMount(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const viewportQuery = window.matchMedia(PHONE_SHEET_QUERY)
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const syncViewport = () => {
      isPhoneViewport = viewportQuery.matches
    }
    const syncMotion = () => {
      reduceMotion = motionQuery.matches
    }
    syncViewport()
    syncMotion()
    viewportQuery.addEventListener('change', syncViewport)
    motionQuery.addEventListener('change', syncMotion)
    return () => {
      viewportQuery.removeEventListener('change', syncViewport)
      motionQuery.removeEventListener('change', syncMotion)
    }
  })

  function isDisabled(item: T): boolean {
    return itemDisabled(item)
  }

  function close(returnFocus = true) {
    open = false
    sheetDragOffset = 0
    sheetDragging = false
    if (returnFocus) {
      triggerRef?.focus()
    }
  }

  function openWithSelection(index: number) {
    listbox.selection.set(index >= 0 ? index : 0)
    open = true
  }

  function toggle() {
    if (open) {
      close(false)
      return
    }
    openWithSelection(initialActiveIndex())
  }

  function openFromTrigger(direction: 'down' | 'up') {
    if (open) {
      listbox.moveHighlight(direction)
      return
    }
    flushSync(() => {
      openWithSelection(direction === 'up' ? listbox.lastEnabled() : initialActiveIndex())
    })
  }

  function initialActiveIndex(): number {
    if (itemRole === 'menuitemradio' && itemChecked) {
      const checkedIndex = items.findIndex(item => itemChecked(item) && !isDisabled(item))
      if (checkedIndex >= 0) return checkedIndex
    }
    const fallback = listbox.firstEnabled()
    return fallback >= 0 ? fallback : 0
  }

  function itemButtonClass(itemValue: T, state: MenuItemState): string | undefined {
    const classes = itemClass ? itemClass(itemValue, state) : ''
    return usePhoneSheet ? `${classes} min-h-11`.trim() : classes || undefined
  }

  function handleTriggerKeydown(event: KeyboardEvent) {
    if (listbox.handleTypeahead(event)) {
      event.preventDefault()
      return
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      openFromTrigger(event.key === 'ArrowDown' ? 'down' : 'up')
    }
  }

  function handlePanelKeydown(event: KeyboardEvent) {
    if (listbox.handleTypeahead(event)) {
      event.preventDefault()
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      listbox.moveHighlight('down')
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      listbox.moveHighlight('up')
    } else if (event.key === 'Home') {
      event.preventDefault()
      listbox.moveHighlight('first')
    } else if (event.key === 'End') {
      event.preventDefault()
      listbox.moveHighlight('last')
    }
  }

  function handleItemClick(index: number) {
    if (isDisabled(items[index])) return
    close()
    onSelect(index)
  }

  const sheetTransition = $derived(sheetDragging || reduceMotion ? 'none' : undefined)

  $effect(() => {
    if (!open) return
    // Track the presentation so a viewport switch while open remounts the
    // branch and moves focus onto the new branch's active item.
    const sheet = usePhoneSheet
    void sheet
    tick().then(() => {
      itemRefs[listbox.selection.index]?.focus()
    })
  })

  $effect(() => {
    // bind:this grows itemRefs but never shrinks it; drop stale tail refs
    // so a shrinking item list can't focus a detached button.
    if (itemRefs.length > items.length) itemRefs = itemRefs.slice(0, items.length)
    if (!open) return
    listbox.selection.clamp(items.length)
  })

  const listbox = useListbox({
    isOpen: () => open,
    onClose: () => close(false),
    openPanel: () => openWithSelection(initialActiveIndex()),
    options: () => items,
    optionLabel: entry => (isDisabled(entry) ? '' : (itemLabel?.(entry) ?? '')),
    isDisabled: index => isDisabled(items[index]),
    // Menu items take focus (role="menu"), unlike the never-focused listbox
    // rows, so reflect the active row by focusing it and skip the scroll reveal.
    onActiveChange: index => itemRefs[index]?.focus(),
    revealOnActive: false,
    getContainer: () => containerRef,
    getPanel: () => (usePhoneSheet ? overlayRef : panelRef),
    getFocusOutPanel: () => (usePhoneSheet ? dialogRef : panelRef),
    getOptionEl: index => itemRefs[index],
    // Read untracked: the type-ahead handle is created once at setup, and
    // `itemLabel` is a stable prop, so no reactive re-read is needed.
    typeahead: untrack(() => itemLabel !== undefined),
    onEscape: () => {
      close()
    },
    onOutsideClick: () => close(false),
    onScrollClose: () => {
      // The phone sheet has no scroll-close (it is an overlay, not an
      // anchored panel); keep it open until an explicit dismissal.
      if (!usePhoneSheet) close(false)
    },
  })
</script>

{#snippet triggerButton()}
  <button
    type="button"
    bind:this={triggerRef}
    aria-label={ariaLabel}
    aria-haspopup="menu"
    aria-expanded={open}
    aria-controls={open ? menuId : undefined}
    onclick={toggle}
    onkeydown={handleTriggerKeydown}
    class={`inline-flex items-center justify-center rounded-md border border-slate-700 bg-slate-950 text-slate-200 transition outline-none hover:border-cyan-500 hover:text-cyan-300 focus-visible:border-transparent focus-visible:ring-2 focus-visible:ring-cyan-500 motion-reduce:transition-none ${triggerClass}`}>
    {@render icon()}
  </button>
{/snippet}

{#snippet menuOptions()}
  {#each items as itemValue, index (itemKey(itemValue))}
    {@const state = { index, active: index === listbox.selection.index, disabled: isDisabled(itemValue) }}
    <button
      type="button"
      role={itemRole}
      aria-checked={itemRole === 'menuitemradio' && itemChecked ? itemChecked(itemValue) : undefined}
      bind:this={itemRefs[index]}
      tabindex={index === listbox.selection.index ? 0 : -1}
      onclick={() => handleItemClick(index)}
      onfocus={() => listbox.selection.set(index)}
      onmousemove={() => {
        if (listbox.selection.peek() !== index) listbox.setActive(index)
      }}
      disabled={state.disabled}
      class={itemButtonClass(itemValue, state)}>
      {@render item(itemValue, state)}
    </button>
  {/each}
{/snippet}

<div
  class="relative inline-flex"
  bind:this={containerRef}
  data-escape-capture={open ? '' : null}
  onfocusout={listbox.handleFocusOut}>
  {#if triggerTooltip}
    <span bind:this={tooltipTriggerEl} class="group relative inline-flex">
      {@render triggerButton()}
      <Tooltip align={triggerTooltipAlign} trigger={tooltipTriggerEl}>{triggerTooltip}</Tooltip>
    </span>
  {:else}
    {@render triggerButton()}
  {/if}
  {#if open}
    {#if usePhoneSheet}
      <MenuSheet
        {containerRef}
        bind:overlayRef
        bind:dialogRef
        {menuId}
        {sheetTitleId}
        {ariaLabel}
        {phoneSheetTitle}
        {sheetCloseLabel}
        {sheetDragOffset}
        {sheetDragging}
        {sheetTransition}
        onClose={() => close()}
        onDragUpdate={(offset, active) => {
          sheetDragOffset = offset
          sheetDragging = active
        }}
        onPanelKeydown={handlePanelKeydown}
        onFocusOut={listbox.handleFocusOut}
        options={menuOptions} />
    {:else}
      <div
        bind:this={panelRef}
        id={menuId}
        role="menu"
        tabindex="-1"
        aria-label={ariaLabel}
        onfocusout={listbox.handleFocusOut}
        onkeydown={handlePanelKeydown}
        use:positionPanel={() => ({ getTrigger: () => containerRef, getOpen: () => open, align, autoPlace })}
        class={`fixed top-0 left-0 z-40 overflow-hidden rounded-lg border border-slate-700 bg-slate-900/95 p-1 shadow-2xl shadow-slate-950/60 backdrop-blur will-change-transform ${panelClass}`}>
        {@render menuOptions()}
      </div>
    {/if}
  {/if}
</div>
