<script lang="ts">
  import { flushSync, tick } from 'svelte'
  import { useListbox } from '$lib/actions/use-listbox.svelte'
  import { createOptionIndex, matchesOption, matchLabelParts } from '$lib/actions/option-index'
  import { isModifiedNavKey } from '$lib/actions/listbox-keynav'
  import { positionPanel } from '$lib/position-panel.svelte'
  import ChevronDownIcon from '$lib/icons/ChevronDownIcon.svelte'
  import type { DropdownPanelProps } from '$lib/dropdown-chrome'
  import { CHIP_PANEL_BASE, DEFAULT_CHIP_PANEL_CLASS } from '$lib/dropdown-chrome'

  interface Option {
    value: string
    label: string
  }

  interface Props extends DropdownPanelProps {
    label: string
    options: Option[]
    activeValue?: string
    ariaLabel: string
    disabled?: boolean
    variant?: 'sky' | 'violet' | 'amber' | 'fuchsia' | 'emerald'
    buttonClass?: string
    filterable?: boolean
    filterPlaceholder?: string
    emptyText?: string
    onSelect: (value: string) => void
  }

  let {
    label,
    options,
    activeValue = '',
    ariaLabel,
    align = 'left',
    autoPlace = true,
    disabled = false,
    variant = 'violet',
    panelClass = DEFAULT_CHIP_PANEL_CLASS,
    buttonClass,
    filterable = false,
    filterPlaceholder = 'Search…',
    emptyText = 'No results.',
    onSelect,
  }: Props = $props()

  let id = $props.id()
  const panelId = `${id}-panel`

  const VARIANT_ACTIVE: Record<string, string> = {
    sky: 'bg-sky-500/15 text-sky-200',
    violet: 'bg-violet-500/15 text-violet-200',
    amber: 'bg-amber-500/15 text-amber-200',
    fuchsia: 'bg-fuchsia-500/15 text-fuchsia-200',
    emerald: 'bg-emerald-500/15 text-emerald-200',
  }

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

  const resolvedButtonClass = $derived(
    buttonClass ??
      `inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium outline-none transition disabled:cursor-not-allowed disabled:opacity-50 relative before:absolute before:-inset-1.5 before:content-[''] ${VARIANT_CHIP[variant] ?? VARIANT_CHIP.violet}`,
  )

  // Filterable layout is a fixed header + scrolling list contract
  // (`shrink-0` search + `flex-1 overflow-y-auto` options). A custom
  // `panelClass` is intentionally ignored here so an ad-hoc
  // `overflow-y-auto`/`p-1` doesn't create a double-scroll container.
  const resolvedPanelClass = $derived(filterable ? `${CHIP_PANEL_BASE} overflow-hidden flex flex-col` : panelClass)

  let open = $state(false)
  let containerRef = $state<HTMLDivElement | null>(null)
  let buttonRef = $state<HTMLButtonElement | null>(null)
  let panelRef = $state<HTMLDivElement | null>(null)
  let inputRef = $state<HTMLInputElement | null>(null)
  // Option elements by index (bound, never queried) for scrollport reveal.
  let optionEls = $state<(HTMLElement | null)[]>([])
  let filterText = $state('')

  // Lowercased once per options array (shared helper) so filtering does not
  // re-lowercase every label/value on every keystroke.
  const optionIndex = $derived(createOptionIndex(options))

  // The lowercased filter needle, empty when filtering is off or the search is
  // blank. The option list and the match highlight read the same value so they
  // can never disagree.
  const filterQuery = $derived(filterable ? filterText.trim().toLowerCase() : '')

  const filteredOptions = $derived.by(() => {
    if (filterQuery === '') return options
    const matched: Option[] = []
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
  let lastFiltered: Option[] | null = null
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
      class={`flex w-full cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-left text-xs transition-none outline-none ${listbox.highlight.flags[index] ? 'bg-slate-800 text-slate-100' : 'text-slate-300'}`}>
      <span class="min-w-0 truncate">
        {#if parts}
          {parts.before}<span class="font-semibold text-cyan-300">{parts.match}</span>{parts.after}
        {:else}
          {option.label}
        {/if}
      </span>
    </button>
  {:else}
    <div role="presentation" class="px-3 py-6 text-center text-xs text-slate-400">{emptyText}</div>
  {/each}
{/snippet}

<div
  class="relative inline-flex"
  bind:this={containerRef}
  data-escape-capture={open ? '' : null}
  onfocusout={listbox.handleFocusOut}>
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
    <span class="truncate">{label}</span>
    <ChevronDownIcon size="xs" variant="solid" className="shrink-0 opacity-70" />
  </button>

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
            class="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100 outline-none placeholder:text-slate-500 focus-visible:border-sky-500" />
        </div>
        <div
          id={panelId}
          role="listbox"
          aria-label={ariaLabel}
          class="min-h-0 flex-1 overflow-y-auto p-1">
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
