<script lang="ts">
  import { flushSync, tick } from 'svelte'
  import { createFocusoutClose } from '$lib/actions/use-focusout-close'
  import { useDropdown } from '$lib/actions/use-dropdown.svelte'
  import { useListSelection, revealInScrollport } from '$lib/actions/use-list-selection.svelte'
  import { positionPanel } from '$lib/position-panel.svelte'
  import { TEXT_SIZE, type TextSize } from '$lib/text-size'
  import Button from '$lib/components/Button.svelte'
  import ChevronDownIcon from '$lib/icons/ChevronDownIcon.svelte'
  import CloseIcon from '$lib/icons/CloseIcon.svelte'
  import type { DropdownPanelProps } from '$lib/dropdown-chrome'

  interface Option {
    value: string
    label: string
  }

  interface Props extends DropdownPanelProps {
    buttonLabel: string
    options: Option[]
    activeValue?: string
    ariaLabel?: string
    filterable?: boolean
    size?: TextSize
    onSelect: (value: string) => void
    buttonClass?: string
    controlClass?: string
    optionClass?: string
    emptyLabel?: string
    // Appends a cross button that clears the value while one is set. Off by
    // default so existing callers are unchanged.
    clearable?: boolean
    // Accessible name for the clear button.
    clearLabel?: string
    // Clear handler; falls back to onSelect('') when omitted.
    onClear?: () => void
  }

  let {
    buttonLabel,
    options,
    activeValue = '',
    ariaLabel,
    align = 'left',
    autoPlace = true,
    filterable = false,
    onSelect,
    size = 'sm',
    buttonClass,
    controlClass,
    optionClass,
    emptyLabel,
    clearable = false,
    clearLabel,
    onClear,
    panelClass,
  }: Props = $props()

  let id = $props.id()
  const panelId = `${id}-panel`

  const SIZE_CLASS = {
    xs: { pad: 'py-1', minW: 'min-w-24' },
    sm: { pad: 'py-2', minW: 'min-w-32' },
    md: { pad: 'py-2.5', minW: 'min-w-40' },
    lg: { pad: 'py-3', minW: 'min-w-48' },
  } as const

  // Default floating panel chrome; a `panelClass` override replaces it. The
  // per-size min-width lives on the option rows (see optionRowClass), because
  // the positioner floors the panel root to the trigger width via inline style.
  const DEFAULT_PANEL_CLASS =
    'w-max max-w-xs max-h-[min(50vh,20rem)] overflow-y-auto rounded-lg border border-slate-700 bg-slate-900/95 p-1 shadow-2xl shadow-slate-950/60 backdrop-blur'

  const resolvedButtonClass = $derived(
    buttonClass ??
      `inline-flex cursor-pointer items-center justify-between gap-2 rounded-md border border-slate-700 bg-slate-950 pl-3 pr-2 text-slate-100 outline-none transition motion-reduce:transition-none hover:border-cyan-500 focus-visible:border-cyan-500 ${SIZE_CLASS[size].pad} ${TEXT_SIZE[size]}`,
  )

  const resolvedControlClass = $derived(
    controlClass ??
      `field-sizing-content cursor-pointer rounded-md border border-slate-700 bg-slate-950 pl-3 pr-7 text-slate-100 outline-none transition motion-reduce:transition-none hover:border-cyan-500 focus-visible:border-cyan-500 ${SIZE_CLASS[size].pad} ${TEXT_SIZE[size]}`,
  )

  const resolvedPanelClass = $derived(panelClass ?? DEFAULT_PANEL_CLASS)

  // Phone viewports get a 44px minimum row height via pure CSS so in-dialog
  // dropdowns stay thumb-friendly without switching to a bottom sheet,
  // which must never stack inside a dialog.
  // Cutoff mirrors PHONE_SHEET_MAX in dropdown-chrome (single shared value);
  // the literal stays inline so Tailwind can see the class — keep them in sync.
  const optionRowClass = $derived(
    optionClass ??
      `${SIZE_CLASS[size].minW} flex w-full cursor-pointer items-center justify-between gap-2 rounded-md px-3 text-left outline-none transition motion-reduce:transition-none max-[27.999rem]:min-h-11 ${SIZE_CLASS[size].pad} ${TEXT_SIZE[size]}`,
  )

  const emptyClass = $derived(`${SIZE_CLASS[size].minW} px-3 ${SIZE_CLASS[size].pad} ${TEXT_SIZE[size]} text-slate-400`)
  const resolvedClearLabel = $derived(clearLabel ?? 'Clear selection')
  let open = $state(false)
  const selection = useListSelection()
  let containerRef = $state<HTMLDivElement | null>(null)
  let inputRef = $state<HTMLInputElement | null>(null)
  let controlRef = $state<HTMLInputElement | HTMLButtonElement | HTMLDivElement | null>(null)
  let panelRef = $state<HTMLDivElement | null>(null)
  let filterText = $state('')
  let suppressOpenOnFocus = false

  const filteredOptions = $derived.by(() => {
    if (!filterable) {
      return options
    }
    const query = filterText.startsWith(buttonLabel) ? filterText.slice(buttonLabel.length) : filterText
    const needle = query.trim().toLowerCase()
    // An empty query shows every option. A query that exactly matches an
    // option's value or label is treated the same way: the user typed a whole
    // value rather than a partial search, so the full list stays available
    // instead of the panel narrowing to a single row.
    const fullMatch =
      needle !== '' &&
      options.some(option => option.label.toLowerCase() === needle || option.value.toLowerCase() === needle)
    if (needle === '' || fullMatch) {
      return options
    }
    return options.filter(
      option => option.label.toLowerCase().includes(needle) || option.value.toLowerCase().includes(needle),
    )
  })

  $effect(() => {
    if (!open) {
      filterText = buttonLabel
    }
  })

  // Reset the highlight to the top of the visible list whenever it changes
  // (filter typing, options prop swap) so the cursor does not stay stranded
  // on a row that has scrolled out of view.
  let lastFilteredOptions: Option[] | null = null
  $effect(() => {
    if (!open) return
    if (lastFilteredOptions !== filteredOptions) {
      lastFilteredOptions = filteredOptions
      selection.reset()
    }
  })

  $effect(() => {
    if (!open) return
    selection.clamp(filteredOptions.length)
  })

  function close() {
    open = false
  }

  // Keep the highlighted option visible while arrowing through a scrollable
  // panel: the option never receives focus (aria-activedescendant pattern),
  // so the browser would otherwise let it drift out of the scrollport.
  function revealActive() {
    revealInScrollport(panelRef?.querySelector<HTMLButtonElement>(`[id="${panelId}-option-${selection.peek()}"]`))
  }

  function toggle() {
    if (open) {
      close()
    } else {
      openPanel()
    }
  }

  function openPanel() {
    lastFilteredOptions = filteredOptions
    // Highlight the committed value on open; hover/arrows move from there.
    selection.syncToActive(filteredOptions, option => option.value === activeValue)
    open = true
    // A long list would otherwise open with the highlighted row scrolled out of
    // sight: the option never receives focus (aria-activedescendant pattern), so
    // nothing else brings it into view, and a native select always shows the
    // selected row. Reveal after the flush, once `positionPanel` has portaled
    // and shown the panel — an effect here runs too early to scroll it.
    void tick().then(() => revealActive())
  }

  function handleControlFocus() {
    if (suppressOpenOnFocus) {
      suppressOpenOnFocus = false
      return
    }
    openPanel()
  }

  function handleControlClick(event: MouseEvent) {
    if (!open) {
      openPanel()
    }
    // A single click into the prefilled combobox should land the caret after
    // the current value rather than with the whole label selected (a browser
    // may select all when the input gains focus), so the next keystroke
    // appends to the filter instead of replacing it. A non-collapsed selection
    // that is not the whole value is a deliberate drag-select and is left
    // alone; defer a frame so it wins over the browser's own selection.
    if (event.detail !== 1 || !inputRef) {
      return
    }
    requestAnimationFrame(() => {
      const input = inputRef
      if (!input || document.activeElement !== input) return
      const { selectionStart, selectionEnd, value } = input
      if (value.length === 0) return
      const collapsed = selectionStart === selectionEnd
      const wholeValue = selectionStart === 0 && selectionEnd === value.length
      if (!collapsed && !wholeValue) return
      const end = value.length
      input.setSelectionRange(end, end)
    })
  }

  // Typing into the closed combobox reopens the panel so the edited query
  // filters live. After Enter confirms a value the input keeps focus, so no
  // focus (or click) event fires to open it again.
  function handleControlInput() {
    if (!open) {
      openPanel()
    }
  }

  // Clearing hides the cross with the value, so return focus to the trigger
  // instead of dropping it to the body.
  function handleClear() {
    close()
    if (onClear) {
      onClear()
    } else {
      onSelect('')
    }
    if (filterable && inputRef) {
      filterText = ''
    }
    void tick().then(() => controlRef?.focus())
  }

  async function select(value: string) {
    const selectedOption = options.find(option => option.value === value)
    const needsFocusRestore = filterable && inputRef !== null && document.activeElement !== inputRef
    onSelect(value)
    if (filterable && selectedOption) {
      filterText = selectedOption.label
    }
    close()
    if (needsFocusRestore) {
      suppressOpenOnFocus = true
      await tick()
      inputRef?.focus()
    }
  }

  function handleControlKeydown(event: KeyboardEvent) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (!open) {
        flushSync(() => {
          openPanel()
        })
        return
      }
      flushSync(() => {
        selection.move('down', filteredOptions.length)
        revealActive()
      })
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (!open) {
        flushSync(() => {
          openPanel()
          selection.move('last', filteredOptions.length)
        })
        return
      }
      flushSync(() => {
        selection.move('up', filteredOptions.length)
        revealActive()
      })
    } else if (event.key === 'Home' || event.key === 'End') {
      if (open && filteredOptions.length > 0) {
        event.preventDefault()
        flushSync(() => {
          selection.move(event.key === 'Home' ? 'first' : 'last', filteredOptions.length)
          revealActive()
        })
      }
    } else if (event.key === 'Enter') {
      if (!open) {
        // Enter on the closed control reopens the panel, so a value that was
        // just confirmed can be changed again without reaching for the mouse.
        event.preventDefault()
        flushSync(() => {
          openPanel()
        })
        return
      }
      event.preventDefault()
      const option = filteredOptions[selection.index] ?? filteredOptions[0]
      if (option) {
        void select(option.value)
      }
    }
  }
  const handleFocusOut = createFocusoutClose(
    () => open,
    () => ({ container: containerRef, panel: panelRef }),
    () => close(),
  )

  useDropdown(() => ({
    isOpen: () => open,
    container: () => containerRef,
    onOutsideClick: () => close(),
    onEscape: () => {
      if (filterable && filterText && filterText !== buttonLabel) {
        filterText = ''
        return true
      }
      close()
    },
    onScrollClose: () => close(),
    panel: () => panelRef,
  }))
</script>

<div class="relative" bind:this={containerRef} data-escape-capture={open ? '' : null} onfocusout={handleFocusOut}>
  {#snippet triggerControl()}
    {#if filterable}
      <div class="relative w-fit" bind:this={controlRef}>
        <input
          bind:this={inputRef}
          type="text"
          bind:value={filterText}
          role="combobox"
          aria-label={ariaLabel}
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          aria-activedescendant={open && filteredOptions[selection.index]
            ? `${panelId}-option-${selection.index}`
            : undefined}
          onfocus={handleControlFocus}
          onclick={handleControlClick}
          oninput={handleControlInput}
          onkeydown={handleControlKeydown}
          class={resolvedControlClass} />
        <ChevronDownIcon
          size="sm"
          className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400" />
      </div>
    {:else}
      <button
        type="button"
        bind:this={controlRef}
        role="combobox"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-activedescendant={open && filteredOptions[selection.index]
          ? `${panelId}-option-${selection.index}`
          : undefined}
        onclick={toggle}
        onkeydown={handleControlKeydown}
        class={resolvedButtonClass}>
        <span class="min-w-0 flex-1 truncate">{buttonLabel}</span>
        <ChevronDownIcon size="sm" className="ml-auto shrink-0 text-slate-500" />
      </button>
    {/if}
  {/snippet}
  {#snippet closeIcon()}
    <CloseIcon size="sm" />
  {/snippet}
  {#if clearable && activeValue !== ''}
    <span class="inline-flex items-center gap-1">
      {@render triggerControl()}
      <Button variant="ghost" size="xs" icon={closeIcon} ariaLabel={resolvedClearLabel} onClick={handleClear} />
    </span>
  {:else}
    {@render triggerControl()}
  {/if}
  {#if open}
    <div
      bind:this={panelRef}
      id={panelId}
      role="listbox"
      aria-label={ariaLabel}
      use:positionPanel={() => ({ getTrigger: () => containerRef, getOpen: () => open, align, autoPlace })}
      class={`fixed top-0 left-0 z-40 will-change-transform ${resolvedPanelClass}`}>
      {#if emptyLabel && filteredOptions.length === 0}
        <div role="presentation" class={emptyClass}>{emptyLabel}</div>
      {/if}
      {#each filteredOptions as option, index}
        <button
          type="button"
          id={`${panelId}-option-${index}`}
          role="option"
          tabindex="-1"
          aria-selected={option.value === activeValue}
          onpointerdown={event => event.preventDefault()}
          onclick={() => void select(option.value)}
          onfocus={() => selection.set(index)}
          onmouseenter={() => selection.set(index)}
          class={`${optionRowClass} ${
            index === selection.index
              ? 'bg-slate-800 text-cyan-200'
              : option.value === activeValue
                ? 'bg-cyan-500/15 text-cyan-200'
                : 'text-slate-300 hover:bg-slate-800 hover:text-cyan-200'
          }`}>
          <span class="min-w-0 truncate">{option.label}</span>
        </button>
      {/each}
    </div>
  {/if}
</div>
