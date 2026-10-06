<script lang="ts">
  import { flushSync, tick } from 'svelte'
  import { createFocusoutClose } from '$lib/actions/use-focusout-close'
  import { useDropdown } from '$lib/actions/use-dropdown.svelte'
  import { useListSelection, revealInScrollport } from '$lib/actions/use-list-selection.svelte'
  import { positionPanel } from '$lib/position-panel.svelte'
  import Button from '$lib/components/Button.svelte'
  import ChevronDownIcon from '$lib/icons/ChevronDownIcon.svelte'
  import CloseIcon from '$lib/icons/CloseIcon.svelte'
  import type { DropdownPanelProps } from '$lib/dropdown-chrome'
  import type { TextSize } from '$lib/text-size'
  import { SIZE_CLASS, DEFAULT_PANEL_CLASS, boxClass, optionRowClass, emptyClass } from './select-dropdown-styles'

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

  const resolvedButtonClass = $derived(
    buttonClass ?? `${boxClass(size)} focus-visible:border-transparent focus-visible:ring-2 focus-visible:ring-cyan-500`,
  )

  const resolvedControlClass = $derived(
    controlClass ?? `${boxClass(size)} focus-within:border-transparent focus-within:ring-2 focus-within:ring-cyan-500`,
  )

  const resolvedPanelClass = $derived(panelClass ?? DEFAULT_PANEL_CLASS)

  const resolvedOptionRowClass = $derived(optionClass ?? optionRowClass(size))

  const resolvedEmptyClass = $derived(emptyClass(size))
  const resolvedClearLabel = $derived(clearLabel ?? 'Clear selection')
  let open = $state(false)
  const selection = useListSelection()
  let containerRef = $state<HTMLDivElement | null>(null)
  let inputRef = $state<HTMLInputElement | null>(null)
  let controlRef = $state<HTMLButtonElement | null>(null)
  let panelRef = $state<HTMLDivElement | null>(null)
  // Option elements by index (bound, never queried) for scrollport reveal.
  let optionEls = $state<(HTMLElement | null)[]>([])
  // Whether the filterable control input holds focus (bound from its events,
  // never read from `document.activeElement`).
  let inputFocused = $state(false)
  let filterText = $state('')
  // Whether the user has edited the filter since it was (pre)filled. While
  // pristine, the text is just the current value echoed back, so the panel
  // shows every option; once edited, the text is a real query — including one
  // that happens to equal the current label.
  let filterDirty = $state(false)
  // The query the user typed, kept across select-and-close so reopening the
  // panel restores the filtered list. While the panel is closed the input
  // shows the selected value; `activeQuery` is what filters again on reopen.
  let activeQuery = $state('')
  let suppressOpenOnFocus = false

  // Lowercased once per options array so typing does not re-lowercase every
  // label/value on every keystroke (a full extra pass plus per-option garbage
  // that shows up as GC pauses while filtering large lists).
  const optionIndex = $derived(
    options.map(option => ({
      option,
      label: option.label.toLowerCase(),
      value: option.value.toLowerCase(),
    })),
  )

  const filteredOptions = $derived.by(() => {
    if (!filterable) {
      return options
    }
    if (!filterDirty) {
      return options
    }
    // Strip the prefilled label only when text was appended to it; a query
    // that merely equals the label is filtered as-is so an exact match
    // narrows instead of showing everything.
    const query =
      filterText.length > buttonLabel.length && filterText.startsWith(buttonLabel)
        ? filterText.slice(buttonLabel.length)
        : filterText
    const needle = query.trim().toLowerCase()
    // An empty query shows every option; any other query narrows the list to
    // the options whose label or value contains it, including an exact match.
    // A query that matches nothing falls back to the full list so the panel
    // never goes empty while typing.
    if (needle === '') {
      return options
    }
    const matched: Option[] = []
    for (const entry of optionIndex) {
      if (entry.label.includes(needle) || entry.value.includes(needle)) {
        matched.push(entry.option)
      }
    }
    return matched.length > 0 ? matched : options
  })

  $effect(() => {
    if (!open && !filterDirty) {
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

  // Per-row highlight flags, updated incrementally: moving the highlight then
  // touches only the row leaving and the row entering, instead of re-running
  // every row's class effect. Keeps held-key navigation O(1) in the number of
  // rendered options rather than O(rows).
  let activeFlags = $state<boolean[]>([])
  let lastActiveIndex = -1
  $effect(() => {
    const count = filteredOptions.length
    const active = selection.index
    if (activeFlags.length !== count) {
      activeFlags = new Array(count).fill(false)
      lastActiveIndex = -1
    }
    if (lastActiveIndex >= 0 && lastActiveIndex < activeFlags.length && lastActiveIndex !== active) {
      activeFlags[lastActiveIndex] = false
    }
    if (active >= 0 && active < activeFlags.length) {
      activeFlags[active] = true
    }
    lastActiveIndex = active
  })

  function close() {
    open = false
  }

  // Escape drops focus the way moving away does: blur the trigger and let
  // the existing focusout path close the panel, so focus never lingers on a
  // dismissed control.
  function blurControl() {
    const control = inputRef ?? controlRef
    control?.blur()
  }

  // Keep the highlighted option visible while arrowing through a scrollable
  // panel: the option never receives focus (aria-activedescendant pattern),
  // so the browser would otherwise let it drift out of the scrollport.
  function revealActive() {
    revealInScrollport(optionEls[selection.peek()])
  }

  function toggle() {
    if (open) {
      close()
    } else {
      openPanel()
    }
  }

  function openPanel() {
    // Restore the query the user typed before selecting so reopening shows the
    // same filtered list; a pristine open (no query) shows every option.
    if (filterable && filterDirty) {
      filterText = activeQuery
    }
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

  // Tabbing (or clicking) into the prefilled combobox lands the caret after
  // the current value rather than leaving the whole label selected (a browser
  // may select all when the input gains focus), so the next keystroke
  // appends to the filter instead of replacing it. A non-collapsed selection
  // that is not the whole value is a deliberate drag-select and is left
  // alone; defer a frame so it wins over the browser's own selection. If the
  // selection changed between scheduling and the frame (the user pressed
  // Shift+Home / Ctrl+A in the meantime), the deferred fix backs off rather
  // than collapsing the selection the user just made.
  let caretRafId: number | null = null
  function placeCaretAtEnd() {
    if (!inputRef) {
      return
    }
    if (caretRafId !== null) cancelAnimationFrame(caretRafId)
    const scheduledStart = inputRef.selectionStart
    const scheduledEnd = inputRef.selectionEnd
    caretRafId = requestAnimationFrame(() => {
      caretRafId = null
      const input = inputRef
      if (!input || !inputFocused) return
      const { selectionStart, selectionEnd, value } = input
      if (value.length === 0) return
      if (selectionStart !== scheduledStart || selectionEnd !== scheduledEnd) return
      const collapsed = selectionStart === selectionEnd
      const wholeValue = selectionStart === 0 && selectionEnd === value.length
      if (!collapsed && !wholeValue) return
      const end = value.length
      input.setSelectionRange(end, end)
    })
  }

  function handleControlFocus() {
    inputFocused = true
    placeCaretAtEnd()
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
    if (event.detail !== 1) {
      return
    }
    placeCaretAtEnd()
  }

  // Typing into the closed combobox reopens the panel so the edited query
  // filters live. After Enter confirms a value the input keeps focus, so no
  // focus (or click) event fires to open it again.
  function handleControlInput() {
    filterDirty = true
    activeQuery = inputRef?.value ?? filterText
    if (!open) {
      openPanel()
    }
  }

  // Leaving the control drops the typed query: the input falls back to showing
  // the committed value and the next open starts from the full list. Only the
  // Enter-select-and-reopen path (focus retained) keeps the query active.
  function handleControlBlur() {
    inputFocused = false
    filterDirty = false
    activeQuery = ''
    if (filterable) {
      filterText = buttonLabel
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
    filterDirty = false
    activeQuery = ''
    if (filterable && inputRef) {
      filterText = ''
    }
    void tick().then(() => (inputRef ?? controlRef)?.focus())
  }

  async function select(value: string) {
    const selectedOption = options.find(option => option.value === value)
    // Always restore focus for a filterable control: the option never receives
    // focus (aria-activedescendant), so the input keeps (or regains) the caret.
    const needsFocusRestore = filterable && inputRef !== null
    onSelect(value)
    if (filterable && selectedOption) {
      filterText = selectedOption.label
    }
    close()
    if (needsFocusRestore) {
      suppressOpenOnFocus = true
      await tick()
      inputRef?.focus()
      // `focus()` is a no-op when the input already holds focus, so no focus
      // event consumes the guard; clear it either way or the next real focus
      // would be swallowed and the panel would not reopen.
      suppressOpenOnFocus = false
    }
  }

  function handleControlKeydown(event: KeyboardEvent) {
    // A text-editing combo is starting: drop any pending caret fix so it
    // cannot collapse the selection the user is about to make.
    if (event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) {
      if (caretRafId !== null) {
        cancelAnimationFrame(caretRafId)
        caretRafId = null
      }
    }
    // Shift+Home / Shift+End select text. Drive the range explicitly rather
    // than relying on the browser default: a browser that select-alls on focus
    // leaves the anchor at the start, so a native Shift+Home would collapse the
    // selection instead of extending it. The control keeps the caret at the
    // end, so Shift+Home selects the whole value and Shift+End collapses it.
    if (inputRef && event.shiftKey && event.key === 'Home') {
      event.preventDefault()
      inputRef.setSelectionRange(0, inputRef.value.length, 'backward')
      return
    }
    if (inputRef && event.shiftKey && event.key === 'End') {
      event.preventDefault()
      const end = inputRef.value.length
      inputRef.setSelectionRange(end, end)
      return
    }
    // Other modified navigation keys (Shift+Arrow, Ctrl/Meta+Arrow/Home/End)
    // belong to the text field; let the browser handle them. Plain keys still
    // drive the listbox.
    const navKey =
      event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Home' || event.key === 'End'
    if (navKey && (event.shiftKey || event.ctrlKey || event.metaKey || event.altKey)) {
      return
    }
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
    } else if (event.key === 'Escape') {
      // A focused but closed control owns no window-level Escape listener
      // (`useDropdown` only listens while open), so drop focus here directly.
      // In a dialog the dialog's own capture handler runs first and still
      // cancels, exactly as before.
      blurControl()
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
      // Blurring fires the focusout path, which closes the panel and resets
      // a dirty filter through the `!open` effect, so Escape both reverts
      // and drops focus in one step.
      close()
      blurControl()
    },
    onScrollClose: () => close(),
    panel: () => panelRef,
  }))
</script>

<div class="relative" bind:this={containerRef} data-escape-capture={open ? '' : null} onfocusout={handleFocusOut}>
  {#snippet triggerChevron()}
    <ChevronDownIcon size={SIZE_CLASS[size].icon} variant="solid" className="-mr-1.5 shrink-0 text-slate-400" />
  {/snippet}
  {#snippet triggerControl()}
    {#if filterable}
      <label class={resolvedControlClass}>
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
          onblur={handleControlBlur}
          onclick={handleControlClick}
          oninput={handleControlInput}
          onkeydown={handleControlKeydown}
          class="field-sizing-content min-w-0 bg-transparent text-left outline-none" />
        {@render triggerChevron()}
      </label>
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
        {@render triggerChevron()}
      </button>
    {/if}
  {/snippet}
  {#snippet closeIcon()}
    <CloseIcon size="sm" />
  {/snippet}
  {#if clearable && activeValue !== ''}
    <span class="inline-flex items-center gap-1">
      {@render triggerControl()}
      <!-- Tab focus tints the icon exactly like hover, with no ring. -->
      <Button
        variant="ghost"
        size="xs"
        icon={closeIcon}
        ariaLabel={resolvedClearLabel}
        onClick={handleClear}
        focusRing={false} />
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
        <div role="presentation" class={resolvedEmptyClass}>{emptyLabel}</div>
      {/if}
      {#each filteredOptions as option, index}
        <button
          type="button"
          bind:this={optionEls[index]}
          id={`${panelId}-option-${index}`}
          role="option"
          tabindex="-1"
          aria-selected={option.value === activeValue}
          onpointerdown={event => event.preventDefault()}
          onclick={() => void select(option.value)}
          onfocus={() => selection.set(index)}
          onmouseenter={() => selection.set(index)}
          class={`${resolvedOptionRowClass} ${
            activeFlags[index]
              ? 'bg-slate-800 text-cyan-200'
              : 'text-slate-300 hover:bg-slate-800 hover:text-cyan-200'
          }`}>
          <span class="min-w-0 truncate">{option.label}</span>
        </button>
      {/each}
    </div>
  {/if}
</div>
