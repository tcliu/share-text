<script lang="ts">
  import { flushSync, tick } from 'svelte'
  import { useListbox } from '$lib/actions/use-listbox.svelte'
  import { createOptionIndex, matchesOption, matchLabelParts } from '$lib/actions/option-index'
  import { isModifiedNavKey } from '$lib/actions/listbox-keynav'
  import { positionPanel } from '$lib/position-panel.svelte'
  import Button from '$lib/components/Button.svelte'
  import ChevronDownIcon from '$lib/icons/ChevronDownIcon.svelte'
  import CloseIcon from '$lib/icons/CloseIcon.svelte'
  import type { DropdownPanelProps } from '$lib/dropdown-chrome'
  import { CHIP_PANEL_BASE } from '$lib/dropdown-chrome'
  import type { SelectOption } from './SelectDropdown.svelte'
  import type { ClearableProps } from './clearable-props'
  import { getI18nContext } from '$lib/i18n.svelte'
  import type { SizeInput } from '$lib/size-scale'
  import { dimensionMetrics, sizeVarStyle } from './size-metrics'

  const i18n = getI18nContext()

  // Every chip metric is a fixed ratio of the size dimension, calibrated so the
  // default `md` step reproduces the chip's original metrics: a 12px label, 8/2
  // padding, a 4px label→chevron gap, a 4px chip→clear-slot gap, and a 12px
  // clear slot. The chevron instead rides SelectDropdown's 0.625 affordance
  // share (a 10px slot at `md`), so the two dropdown markers read at the same
  // size. Both glyphs render at the shared icon ratio, staying lighter than the
  // label. The 1px border is size-independent.
  const CHIP_RATIOS = {
    font: 0.75,
    line: 1,
    padX: 0.5,
    padY: 0.125,
    gap: 0.25,
    slotGap: 0.25,
    icon: 0.625,
    clear: 0.75,
  }

  // Panel metrics scale with the same dimension so the floating list tracks the
  // chip, mirroring `SelectDropdown`'s panel: the option rows, the empty row,
  // and the search field take the size-scaled font, line, and padding, and a
  // row min-width floors the panel (246px content → the original 256px panel at
  // md once its 4px padding and 1px border are added).
  const CHIP_PANEL_RATIOS = {
    font: 0.75,
    line: 1,
    padX: 0.75,
    padY: 0.5,
    minW: 15.375,
    emptyPadY: 1.5,
    searchPadX: 0.5,
    searchPadY: 0.25,
  }

  // The menu panel fits its content and floors at the trigger width (set by the
  // positioner), like `SelectDropdown`'s panel, instead of a fixed width.
  const CHIP_MENU_PANEL_CLASS = `${CHIP_PANEL_BASE} w-max max-w-xs`

  interface Props extends DropdownPanelProps, Omit<ClearableProps, 'clearPlacement'> {
    label: string
    options: SelectOption[]
    activeValue?: string
    // Baseline the clear affordance compares against: the cross hides while
    // `activeValue` matches it (empty when unset), and the fallback clear
    // writes it back. A provided `onClear` still owns the clear.
    defaultValue?: string
    ariaLabel: string
    disabled?: boolean
    variant?: 'sky' | 'violet' | 'amber' | 'fuchsia' | 'emerald'
    size?: SizeInput
    buttonClass?: string
    filterable?: boolean
    filterPlaceholder?: string
    emptyText?: string
    onSelect: (value: string) => void
    // No `clearPlacement`: the trigger is a chip, not a text field, so the
    // clear sits on its own right edge. `onClear` falls back to selecting the
    // default value.
  }

  let {
    label,
    options,
    activeValue = '',
    defaultValue,
    ariaLabel,
    align = 'left',
    autoPlace = true,
    disabled = false,
    variant = 'violet',
    size = 'md',
    panelClass = `${CHIP_MENU_PANEL_CLASS} overflow-y-auto p-1`,
    buttonClass,
    filterable = false,
    filterPlaceholder = 'Search…',
    emptyText = 'No results.',
    onSelect,
    clearable = false,
    clearLabel,
    onClear,
  }: Props = $props()

  let id = $props.id()
  const panelId = `${id}-panel`

  // Normalize once per options array so every row below reads one shape: a
  // bare string is its own label and a missing label falls back to the value.
  const normalizedOptions = $derived(
    options.map(option =>
      typeof option === 'string'
        ? { value: option, label: option }
        : { value: option.value, label: option.label ?? option.value },
    ),
  )

  const VARIANT_CHIP: Record<string, string> = {
    sky: 'border-sky-500/30 bg-sky-500/10 text-sky-200 hover:border-sky-400 hover:text-sky-100 focus-visible:border-sky-400 focus-visible:text-sky-100',
    violet:
      'border-violet-500/30 bg-violet-500/10 text-violet-200 hover:border-violet-400 hover:text-violet-100 focus-visible:border-violet-400 focus-visible:text-violet-100',
    amber:
      'border-amber-500/30 bg-amber-500/10 text-amber-200 hover:border-amber-400 hover:text-amber-100 focus-visible:border-amber-400 focus-visible:text-amber-100',
    fuchsia:
      'border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-200 hover:border-fuchsia-400 hover:text-fuchsia-100 focus-visible:border-fuchsia-400 focus-visible:text-fuchsia-100',
    emerald:
      'border-emerald-500/30 bg-emerald-500/10 text-emerald-200 hover:border-emerald-400 hover:text-emerald-100 focus-visible:border-emerald-400 focus-visible:text-emerald-100',
  }

  // Every metric is a fixed ratio of the size dimension, emitted as `--chip-*`
  // on the root so the trigger and the clear slot both read them; the chevron
  // and the clear cross take their numeric sizes from the same metrics.
  const metrics = $derived(dimensionMetrics(size, CHIP_RATIOS))
  const chipStyle = $derived(sizeVarStyle('chip', metrics))
  const panelMetrics = $derived(dimensionMetrics(size, CHIP_PANEL_RATIOS))
  const panelStyle = $derived(sizeVarStyle('chip-panel', panelMetrics))

  const resolvedButtonClass = $derived(
    buttonClass ??
      `inline-flex max-w-full items-center gap-[var(--chip-gap)] rounded-full border px-[var(--chip-pad-x)] py-[var(--chip-pad-y)] text-[length:var(--chip-font)] leading-[var(--chip-line)] font-medium outline-none transition disabled:cursor-not-allowed disabled:opacity-50 relative before:absolute before:-inset-1.5 before:content-[''] ${VARIANT_CHIP[variant] ?? VARIANT_CHIP.violet}`,
  )

  const resolvedClearLabel = $derived(clearLabel ?? i18n.t('common.clear'))
  // A disabled chip offers no clear action, and while `activeValue` matches
  // `defaultValue` (empty when unset) there is nothing to clear, so the cross
  // hides.
  const showClear = $derived(clearable && (activeValue ?? '') !== (defaultValue ?? '') && !disabled)

  // Filterable layout is a fixed header + scrolling list contract
  // (`shrink-0` search + `flex-1 overflow-y-auto` options). A custom
  // `panelClass` is intentionally ignored here so an ad-hoc
  // `overflow-y-auto`/`p-1` doesn't create a double-scroll container.
  const resolvedPanelClass = $derived(filterable ? `${CHIP_MENU_PANEL_CLASS} overflow-hidden flex flex-col` : panelClass)

  let open = $state(false)
  let containerRef = $state<HTMLDivElement | null>(null)
  let buttonRef = $state<HTMLButtonElement | null>(null)
  let panelRef = $state<HTMLDivElement | null>(null)
  let inputRef = $state<HTMLInputElement | null>(null)
  // Option elements by index (bound, never queried) for scrollport reveal.
  let optionEls = $state<(HTMLElement | null)[]>([])
  let filterText = $state('')

  // The chip holds the width of its own rendered label across a clear, so an
  // emptied label never collapses the pill. The width is measured from the
  // label, never derived from the options, so a long option never widens a chip
  // that shows a different value. `min-h` floors the label's height the same way.
  let labelEl = $state<HTMLElement | null>(null)
  let heldLabelWidth = $state<number | null>(null)

  // Lowercased once per options array (shared helper) so filtering does not
  // re-lowercase every label/value on every keystroke.
  const optionIndex = $derived(createOptionIndex(normalizedOptions))

  // The lowercased filter needle, empty when filtering is off or the search is
  // blank. The option list and the match highlight read the same value so they
  // can never disagree.
  const filterQuery = $derived(filterable ? filterText.trim().toLowerCase() : '')

  const filteredOptions = $derived.by(() => {
    if (filterQuery === '') return normalizedOptions
    const matched: { value: string; label: string }[] = []
    for (const entry of optionIndex) {
      if (matchesOption(entry, filterQuery)) {
        matched.push(entry.option)
      }
    }
    return matched
  })

  // Emphasize the typed part of each label only while the query is ambiguous:
  // with two or more matches the user needs to see which part matched, while a
  // lone match is already the only row and needs no extra emphasis.
  const highlightMatches = $derived(filterQuery !== '' && filteredOptions.length > 1)

  // Split a label around its matched span (shared helper), or return null when
  // highlighting is off for an unambiguous single match.
  function labelParts(label: string) {
    return highlightMatches ? matchLabelParts(label, filterQuery) : null
  }

  // In filterable mode, keep the highlight anchored on the active value
  // whenever the visible list changes so a typed search that still includes
  // the active value leaves the cursor on it.
  let lastFiltered: { value: string; label: string }[] | null = null
  $effect(() => {
    if (!open || !filterable) return
    if (lastFiltered !== filteredOptions) {
      lastFiltered = filteredOptions
      listbox.selection.syncToActive(filteredOptions, option => option.value === activeValue)
    }
  })

  $effect(() => {
    if (!open) return
    // Clamp when the filtered list shrinks without a syncToActive run (e.g.
    // non-filterable options swap) so aria-activedescendant never dangles.
    listbox.selection.clamp(filteredOptions.length)
  })

  $effect(() => {
    if (!open && filterable) {
      filterText = ''
    }
  })

  $effect(() => {
    if (open && filterable) {
      void tick().then(() => inputRef?.focus())
    }
  })

  // Remember the label's rendered width while one is present; the markup then
  // floors the now-empty label at that width after a clear, so the pill keeps
  // its size without borrowing anything from the option list. Reading `metrics`
  // re-measures when the size (and so the label's rendered width) changes.
  $effect(() => {
    void metrics
    if (label === '' || !labelEl) return
    heldLabelWidth = labelEl.getBoundingClientRect().width
  })

  const chipLabelStyle = $derived(
    label === '' && heldLabelWidth != null ? `min-width:${heldLabelWidth}px` : undefined,
  )

  function close() {
    open = false
  }

  function toggle() {
    if (disabled) return
    if (open) close()
    else openPanel()
  }

  function openPanel() {
    if (disabled) return
    // Highlight the active value when opening so keyboard and mouse share the same start.
    listbox.selection.syncToActive(filteredOptions, option => option.value === activeValue)
    if (filterable) filterText = ''
    open = true
  }

  function select(value: string) {
    onSelect(value)
    close()
    buttonRef?.focus()
  }

  // Clearing hides the cross with the value, so return focus to the trigger
  // instead of dropping it to the body. A provided handler owns the clear;
  // otherwise the default value is selected.
  function handleClear() {
    close()
    if (onClear) {
      onClear()
    } else {
      onSelect(defaultValue ?? '')
    }
    buttonRef?.focus()
  }

  function moveHighlight(direction: 'down' | 'up') {
    if (filteredOptions.length === 0) return
    if (!open) {
      flushSync(() => {
        openPanel()
        if (direction === 'up') listbox.selection.move('last', filteredOptions.length)
      })
      return
    }
    // OS key auto-repeat fires back-to-back keydowns; flush synchronously so
    // each repeat paints the newly active row immediately.
    listbox.moveHighlight(direction)
  }

  function handleButtonKeydown(event: KeyboardEvent) {
    // Non-filterable trigger has no text field: printable keys run type-ahead.
    if (!filterable && listbox.handleTypeahead(event)) {
      event.preventDefault()
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      moveHighlight('down')
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      moveHighlight('up')
    } else if (event.key === 'Home') {
      if (open && filteredOptions.length > 0) {
        event.preventDefault()
        listbox.moveHighlight('first')
      }
    } else if (event.key === 'End') {
      if (open && filteredOptions.length > 0) {
        event.preventDefault()
        listbox.moveHighlight('last')
      }
    } else if (event.key === 'Enter' || event.key === ' ') {
      if (!open) {
        event.preventDefault()
        openPanel()
        return
      }
      event.preventDefault()
      const option = filteredOptions[listbox.selection.index]
      if (option) select(option.value)
    }
  }

  function handleFilterKeydown(event: KeyboardEvent) {
    // Modified navigation keys edit the search text (Shift+Home selects to the
    // start, Shift+Arrow extends the selection); let the browser handle them
    // instead of moving the list highlight. Plain keys still drive the listbox.
    if (isModifiedNavKey(event)) {
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      moveHighlight('down')
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      moveHighlight('up')
    } else if (event.key === 'Home') {
      event.preventDefault()
      listbox.moveHighlight('first')
    } else if (event.key === 'End') {
      event.preventDefault()
      listbox.moveHighlight('last')
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const option = filteredOptions[listbox.selection.index] ?? filteredOptions[0]
      if (option) select(option.value)
    } else if (event.key === 'Tab') {
      // Close on Tab so the listbox does not linger while focus continues
      // through the natural tab order.
      close()
    } else if (event.key === 'Escape') {
      if (filterText) {
        event.preventDefault()
        event.stopPropagation()
        filterText = ''
        return
      }
    }
  }

  const listbox = useListbox({
    isOpen: () => open,
    onClose: close,
    openPanel,
    options: () => filteredOptions,
    optionLabel: option => option.label,
    getContainer: () => containerRef,
    getPanel: () => panelRef,
    getOptionEl: index => optionEls[index],
    typeahead: true,
    onOutsideClick: close,
    onEscape: () => {
      // If the filterable input has text, let its handler clear it first.
      if (filterable && filterText) return true
      close()
      buttonRef?.focus()
      return false
    },
    onScrollClose: close,
  })
</script>

{#snippet optionList()}
  {#each filteredOptions as option, index}
    {@const parts = labelParts(option.label)}
    <button
      type="button"
      bind:this={optionEls[index]}
      id={`${panelId}-option-${index}`}
      role="option"
      tabindex="-1"
      aria-selected={option.value === activeValue}
      onpointerdown={event => event.preventDefault()}
      onclick={() => select(option.value)}
      onfocus={() => listbox.selection.set(index)}
      onmousemove={() => {
        if (listbox.selection.peek() !== index) listbox.selection.set(index)
      }}
      class={`flex w-full min-w-[var(--chip-panel-min-w)] cursor-pointer items-center justify-between rounded-lg px-[var(--chip-panel-pad-x)] py-[var(--chip-panel-pad-y)] text-left text-[length:var(--chip-panel-font)] leading-[var(--chip-panel-line)] transition-none outline-none ${listbox.highlight.flags[index] ? 'bg-slate-800 text-slate-100' : 'text-slate-300'}`}
      style={panelStyle}>
      <span class="min-w-0 truncate">
        {#if parts}
          {parts.before}<span class="font-semibold text-cyan-300">{parts.match}</span>{parts.after}
        {:else}
          {option.label}
        {/if}
      </span>
    </button>
  {:else}
    <div role="presentation" class="min-w-[var(--chip-panel-min-w)] px-[var(--chip-panel-pad-x)] py-[var(--chip-panel-empty-pad-y)] text-center text-[length:var(--chip-panel-font)] text-slate-400" style={panelStyle}>{emptyText}</div>
  {/each}
{/snippet}

<div
  class="relative inline-flex"
  style={chipStyle}
  bind:this={containerRef}
  data-escape-capture={open ? '' : null}
  onfocusout={listbox.handleFocusOut}>
  {#snippet triggerButton()}
    <button
      type="button"
      bind:this={buttonRef}
      role={filterable ? undefined : 'combobox'}
      aria-label={ariaLabel}
      aria-haspopup={filterable ? undefined : 'listbox'}
      aria-expanded={filterable ? undefined : open}
      aria-controls={!filterable && open ? panelId : undefined}
      aria-activedescendant={!filterable && open && filteredOptions[listbox.selection.index]
        ? `${panelId}-option-${listbox.selection.index}`
        : undefined}
      {disabled}
      onclick={toggle}
      onkeydown={handleButtonKeydown}
      class={resolvedButtonClass}>
      <span bind:this={labelEl} class="min-h-[var(--chip-line)] truncate" style={chipLabelStyle}>{label}</span>
      <ChevronDownIcon size={metrics.icon} className="shrink-0 text-slate-400" />
    </button>
  {/snippet}
  {#snippet closeIcon()}
    <CloseIcon size={metrics.clear} />
  {/snippet}
  {#if clearable}
    <span class="inline-flex items-center gap-[var(--chip-slot-gap)]">
      {@render triggerButton()}
      <!-- The clear slot is reserved whenever `clearable`: the cross toggles
        with the value, but its box stays, so clearing never shifts the chip. -->
      <span data-clear-slot class="inline-flex items-center" class:invisible={!showClear}>
        <Button
          variant="ghost"
          size={metrics.clear}
          icon={closeIcon}
          ariaLabel={showClear ? resolvedClearLabel : undefined}
          onClick={handleClear} />
      </span>
    </span>
  {:else}
    {@render triggerButton()}
  {/if}

  {#if open}
    {#if filterable}
      <div
        bind:this={panelRef}
        use:positionPanel={() => ({ getTrigger: () => containerRef, getOpen: () => open, align, autoPlace })}
        class={resolvedPanelClass}>
        <div class="shrink-0 bg-slate-900/95 p-1">
          <input
            bind:this={inputRef}
            type="text"
            bind:value={filterText}
            placeholder={filterPlaceholder}
            aria-label={filterPlaceholder || ariaLabel}
            role="combobox"
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-controls={open ? panelId : undefined}
            aria-activedescendant={open && filteredOptions[listbox.selection.index]
              ? `${panelId}-option-${listbox.selection.index}`
              : undefined}
            onkeydown={handleFilterKeydown}
            style={panelStyle}
            class="w-full rounded-md border border-slate-700 bg-slate-950 px-[var(--chip-panel-search-pad-x)] py-[var(--chip-panel-search-pad-y)] text-[length:var(--chip-panel-font)] leading-[var(--chip-panel-line)] text-slate-100 outline-none placeholder:text-slate-500 focus-visible:border-sky-500" />
        </div>
        <div id={panelId} role="listbox" aria-label={ariaLabel} class="min-h-0 flex-1 overflow-y-auto p-1">
          {@render optionList()}
        </div>
      </div>
    {:else}
      <div
        bind:this={panelRef}
        id={panelId}
        role="listbox"
        aria-label={ariaLabel}
        use:positionPanel={() => ({ getTrigger: () => containerRef, getOpen: () => open, align, autoPlace })}
        class={resolvedPanelClass}>
        {@render optionList()}
      </div>
    {/if}
  {/if}
</div>
