<script lang="ts">
  import { flushSync, tick } from 'svelte'
  import { useListbox } from '$lib/actions/use-listbox.svelte'
  import { createOptionIndex, matchesOption, matchLabelParts } from '$lib/actions/option-index'
  import { isModifiedNavKey } from '$lib/actions/listbox-keynav'
  import Button from '$lib/components/Button.svelte'
  import ListboxPanel from '$lib/components/ListboxPanel.svelte'
  import TextInput from '$lib/components/TextInput.svelte'
  import ChevronDownIcon from '$lib/icons/ChevronDownIcon.svelte'
  import CloseIcon from '$lib/icons/CloseIcon.svelte'
  import type { DropdownPanelProps } from '$lib/dropdown-chrome'
  import type { SizeInput } from '$lib/size-scale'
  import {
    DEFAULT_PANEL_CLASS,
    SELECT_BOX_UTILITIES,
    SELECT_TRIGGER_UTILITIES,
    SELECT_RATIOS,
    SELECT_GUTTER_SHARE,
    TRIGGER_BASE,
    OPTION_BASE,
    EMPTY_BASE,
  } from './select-dropdown-styles'
  import { dimensionMetrics, sizeVarStyle } from './size-metrics'
  import type { ClearableProps } from './clearable-props'
  import { getI18nContext } from '$lib/i18n.svelte'

  const i18n = getI18nContext()

  // Accepted option shape: a bare string is its own label, and a missing
  // label falls back to the value, so `'two'` and `{ value: 'two' }` both
  // display as `two`.
  export type SelectOption = string | { value: string; label?: string }

  interface NormalizedOption {
    value: string
    label: string
  }

  interface Props extends DropdownPanelProps, Omit<ClearableProps, 'clearPlacement'> {
    // Overrides the derived trigger label (the committed option's label, or
    // the raw value when it matches nothing). Omit it and the trigger tracks
    // the value on its own.
    buttonLabel?: string
    // Baseline the clear affordance compares against: the cross hides while
    // `activeValue` matches it (empty when unset), and the fallback clear
    // writes it back. A provided `onClear` still owns the clear.
    defaultValue?: string
    options: SelectOption[]
    activeValue?: string
    ariaLabel?: string
    filterable?: boolean
    // Lets Enter commit the typed text via `onSelect` when it matches no
    // option. Only applies to the filterable input; off by default so
    // existing callers are unchanged.
    allowCustomValue?: boolean
    size?: SizeInput
    onSelect: (value: string) => void
    buttonClass?: string
    controlClass?: string
    optionClass?: string
    emptyLabel?: string
    // No `clearPlacement`: the trigger is a button, not a text field, so the
    // clear sits on its own right edge. `onClear` falls back to selecting the
    // default value.
  }

  let {
    buttonLabel,
    defaultValue,
    options,
    activeValue = '',
    ariaLabel,
    align = 'left',
    autoPlace = true,
    filterable = false,
    allowCustomValue = false,
    onSelect,
    size = 'md',
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

  // Normalize once per options array so every row below reads one shape.
  const normalizedOptions = $derived(
    options.map((option): NormalizedOption =>
      typeof option === 'string'
        ? { value: option, label: option }
        : { value: option.value, label: option.label ?? option.value },
    ),
  )

  // Trigger label: an explicit override wins; otherwise the committed option's
  // label, falling back to the raw value when it matches nothing.
  const resolvedButtonLabel = $derived(
    buttonLabel ?? normalizedOptions.find(option => option.value === activeValue)?.label ?? activeValue,
  )

  // Every metric is a fixed ratio of the size dimension, so each keeps a
  // constant metric:dimension ratio across the range; the icon slot is the
  // dimension itself (ratio 1).
  const metrics = $derived(dimensionMetrics(size, SELECT_RATIOS))
  // The trigger's right gutter is derived from the horizontal padding rather
  // than tuned beside it: `--sel-pad-right` is published as a calc over
  // `--sel-pad-x`, so retuning `padX` (or a caller overriding the var) rescales
  // the chevron's inset with the padding instead of moving it by a constant
  // offset. `Pagination` emits its derived `--pg-btn` the same way.
  const style = $derived(
    `${sizeVarStyle('sel', metrics)};--sel-pad-right:calc(var(--sel-pad-x) * ${SELECT_GUTTER_SHARE})`,
  )
  // The trigger's direction marker and its clear cross ride a trimmed share of
  // that slot: at the full dimension each reads as loud as the label beside it,
  // so they take 0.625 of it — the same share `TextInput`'s clear cross rides —
  // staying lighter affordances that still scale with the control.
  const affordanceSize = $derived(metrics.icon * 0.625)

  const triggerBoxClass = $derived(`${SELECT_TRIGGER_UTILITIES} ${TRIGGER_BASE}`)

  const resolvedButtonClass = $derived(
    buttonClass ??
      `${triggerBoxClass} focus-visible:border-transparent focus-visible:ring-2 focus-visible:ring-cyan-500`,
  )

  const resolvedButtonStyle = $derived(buttonClass ? undefined : style)

  const resolvedControlClass = $derived(controlClass ?? `${triggerBoxClass} focus-within:border-cyan-500`)

  const resolvedControlStyle = $derived(controlClass ? undefined : style)

  const resolvedPanelClass = $derived(panelClass ?? DEFAULT_PANEL_CLASS)

  const resolvedOptionRowClass = $derived(optionClass ?? `${SELECT_BOX_UTILITIES} ${OPTION_BASE}`)

  const resolvedOptionRowStyle = $derived(optionClass ? undefined : style)

  const resolvedEmptyRowClass = $derived(`${SELECT_BOX_UTILITIES} ${EMPTY_BASE}`)

  // No override exists for the empty row (callers only supply its label), so
  // its class is always ours and the geometry style always applies with it —
  // unlike the option rows, where `optionClass` takes over both.
  const resolvedEmptyRowStyle = $derived(style)
  const resolvedClearLabel = $derived(clearLabel ?? i18n.t('common.clear'))
  // While `activeValue` matches `defaultValue` (empty when unset) there is
  // nothing to clear, so the cross hides.
  const showClear = $derived(clearable && (activeValue ?? '') !== (defaultValue ?? ''))
  let open = $state(false)
  let containerRef = $state<HTMLDivElement | null>(null)
  let inputRef = $state<HTMLInputElement | null>(null)
  let controlRef = $state<HTMLButtonElement | null>(null)
  let panelRef = $state<HTMLDivElement | null>(null)
  // Option elements by index, registered by the shared panel so the listbox
  // core can reveal the active row (never queried from the DOM).
  let optionEls = $state<(HTMLElement | null)[]>([])

  function setOptionEl(index: number, el: HTMLElement | null): void {
    optionEls[index] = el
  }
  // Whether the filterable control input holds focus (bound from its events,
  // never read from `document.activeElement`).
  let inputFocused = $state(false)
  let filterText = $state('')
  // Whether the user has edited the filter since it was (pre)filled. While
  // pristine, the text is just the current value echoed back, so the panel
  // shows every option; once edited, the text is a real query — including one
  // that happens to equal the current label.
  let filterDirty = $state(false)
  // The query restored when the panel reopens with focus retained. While the
  // user types it is the typed text; once a value is confirmed it becomes that
  // value's label, so reopening filters by the confirmed value shown in the
  // input instead of reverting it to the raw typed query. While the panel is
  // closed the input shows the selected value.
  let activeQuery = $state('')
  let suppressOpenOnFocus = false

  // Lowercased once per options array (shared helper) so filtering does not
  // re-lowercase every label/value on every keystroke.
  const optionIndex = $derived(createOptionIndex(normalizedOptions))

  // The lowercased filter needle, empty when filtering is off or the text is
  // just the echoed value. The option list and the match highlight read the
  // same value so they can never disagree.
  const filterQuery = $derived.by(() => {
    if (!filterable || !filterDirty) {
      return ''
    }
    // Strip the prefilled label only when text was appended to it; a query
    // that merely equals the label is filtered as-is so an exact match
    // narrows instead of showing everything.
    const query =
      filterText.length > resolvedButtonLabel.length && filterText.startsWith(resolvedButtonLabel)
        ? filterText.slice(resolvedButtonLabel.length)
        : filterText
    return query.trim().toLowerCase()
  })

  const filteredOptions = $derived.by(() => {
    // An empty query shows every option; any other query narrows the list to
    // the options whose label or value contains it, including an exact match.
    // A query that matches nothing falls back to the full list so the panel
    // never goes empty while typing.
    if (filterQuery === '') {
      return normalizedOptions
    }
    const matched: NormalizedOption[] = []
    for (const entry of optionIndex) {
      if (matchesOption(entry, filterQuery)) {
        matched.push(entry.option)
      }
    }
    return matched.length > 0 ? matched : normalizedOptions
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

  $effect(() => {
    if (!open && !filterDirty) {
      filterText = resolvedButtonLabel
    }
  })

  // `listbox` is created below; these effects run after setup, so the forward
  // reference is safe.
  // Reset the highlight to the top of the visible list whenever it changes
  // (filter typing, options prop swap) so the cursor does not stay stranded
  // on a row that has scrolled out of view.
  let lastFilteredOptions: NormalizedOption[] | null = null
  $effect(() => {
    if (!open) return
    if (lastFilteredOptions !== filteredOptions) {
      lastFilteredOptions = filteredOptions
      listbox.selection.reset()
    }
  })

  $effect(() => {
    if (!open) return
    listbox.selection.clamp(filteredOptions.length)
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
    listbox.selection.syncToActive(filteredOptions, option => option.value === activeValue)
    open = true
    // A long list would otherwise open with the highlighted row scrolled out of
    // sight: the option never receives focus (aria-activedescendant pattern), so
    // nothing else brings it into view, and a native select always shows the
    // selected row. Reveal after the flush, once `positionPanel` has portaled
    // and shown the panel — an effect here runs too early to scroll it.
    void tick().then(() => listbox.revealActive())
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

  // Double-clicking the input selects the whole value, so the next keystroke
  // replaces the filter instead of editing one word inside the echoed value.
  // A pending caret fix is dropped first: it would otherwise collapse this
  // selection back to the end.
  function handleControlDblClick() {
    if (!inputRef) {
      return
    }
    if (caretRafId !== null) {
      cancelAnimationFrame(caretRafId)
      caretRafId = null
    }
    inputRef.setSelectionRange(0, inputRef.value.length)
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
      filterText = resolvedButtonLabel
    }
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
    filterDirty = false
    activeQuery = ''
    if (filterable && inputRef) {
      filterText = ''
    }
    void tick().then(() => (inputRef ?? controlRef)?.focus())
  }

  // Shared commit tail: close the panel and hand focus back to the filterable
  // input (the option never receives focus, so the input keeps the caret).
  async function closeAndRestoreFocus(): Promise<void> {
    close()
    // Always restore focus for a filterable control: the option never receives
    // focus (aria-activedescendant), so the input keeps (or regains) the caret.
    if (filterable && inputRef !== null) {
      suppressOpenOnFocus = true
      await tick()
      inputRef?.focus()
      // `focus()` is a no-op when the input already holds focus, so no focus
      // event consumes the guard; clear it either way or the next real focus
      // would be swallowed and the panel would not reopen.
      suppressOpenOnFocus = false
    }
  }

  async function select(value: string) {
    const selectedOption = normalizedOptions.find(option => option.value === value)
    onSelect(value)
    if (filterable && selectedOption) {
      // A confirmed value spends the typed query: store the confirmed label as
      // the query so reopening filters by the value shown in the input rather
      // than reverting it to what was typed.
      filterText = selectedOption.label
      activeQuery = selectedOption.label
    }
    await closeAndRestoreFocus()
  }

  // Free entry: commit the typed text as the value even though it matches no
  // option. The input keeps showing the committed text (as `select` does with
  // a confirmed label), so reopening filters by it instead of reverting.
  async function commitCustomValue(text: string): Promise<void> {
    onSelect(text)
    if (filterable) {
      filterText = text
      activeQuery = text
    }
    await closeAndRestoreFocus()
  }

  function handleControlKeydown(event: KeyboardEvent) {
    // The non-filterable trigger has no text field: a printable key runs
    // type-ahead (commit the first label match) and consuming it here keeps
    // the rest of the navigation below untouched.
    if (!filterable && listbox.handleTypeahead(event)) {
      event.preventDefault()
      return
    }
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
    if (isModifiedNavKey(event)) {
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
      listbox.moveHighlight('down')
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (!open) {
        flushSync(() => {
          openPanel()
          listbox.selection.move('last', filteredOptions.length)
        })
        return
      }
      listbox.moveHighlight('up')
    } else if (event.key === 'Home' || event.key === 'End') {
      if (open && filteredOptions.length > 0) {
        event.preventDefault()
        listbox.moveHighlight(event.key === 'Home' ? 'first' : 'last')
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
      // Free entry: typed text that matches no option commits as a custom
      // value instead of falling back to the highlighted row. The match is
      // case-insensitive like filtering, so `TWO` still selects `Two`
      // instead of committing a duplicate. Pristine text (the echoed value,
      // never edited) never commits — without this, Enter on a freshly
      // opened panel would commit the current label as new.
      const customText = filterText.trim()
      const customLower = customText.toLowerCase()
      const exactMatch = normalizedOptions.some(
        option => option.label.toLowerCase() === customLower || option.value.toLowerCase() === customLower,
      )
      if (allowCustomValue && filterable && filterDirty && customText !== '' && !exactMatch) {
        void commitCustomValue(customText)
        return
      }
      const option = filteredOptions[listbox.selection.index] ?? filteredOptions[0]
      if (option) {
        void select(option.value)
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
      // Blurring fires the focusout path, which closes the panel and resets
      // a dirty filter through the `!open` effect, so Escape both reverts
      // and drops focus in one step.
      close()
      blurControl()
    },
    onScrollClose: close,
  })
</script>

<div
  class="relative"
  bind:this={containerRef}
  data-escape-capture={open ? '' : null}
  onfocusout={listbox.handleFocusOut}>
  {#snippet triggerChevron()}
    <ChevronDownIcon size={affordanceSize} className="shrink-0 text-slate-400" />
  {/snippet}
  {#snippet triggerControl()}
    {#if filterable}
      <label class={resolvedControlClass} style={resolvedControlStyle}>
        <TextInput
          bind:inputRef
          bind:value={filterText}
          {size}
          role="combobox"
          {ariaLabel}
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          aria-activedescendant={open && filteredOptions[listbox.selection.index]
            ? `${panelId}-option-${listbox.selection.index}`
            : undefined}
          onfocus={handleControlFocus}
          onblur={handleControlBlur}
          onclick={handleControlClick}
          ondblclick={handleControlDblClick}
          oninput={handleControlInput}
          onkeydown={handleControlKeydown}
          inputClass="field-sizing-content min-w-0 bg-transparent text-left outline-none" />
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
        aria-activedescendant={open && filteredOptions[listbox.selection.index]
          ? `${panelId}-option-${listbox.selection.index}`
          : undefined}
        onclick={toggle}
        onkeydown={handleControlKeydown}
        class={resolvedButtonClass}
        style={resolvedButtonStyle}>
        <!-- The label row keeps the line height even with an empty label (a
             cleared value), so clearing the selection never trims the trigger. -->
        <span class="min-h-[var(--sel-line)] min-w-0 flex-1 truncate">{resolvedButtonLabel}</span>
        {@render triggerChevron()}
      </button>
    {/if}
  {/snippet}
  {#snippet closeIcon()}
    <CloseIcon size="sm" />
  {/snippet}
  {#if showClear}
    <!-- The clear affordance scales with the control: its gap is a ratio of the
      size and its icon box rides the trimmed affordance size. -->
    <span class="inline-flex items-center" style={`gap:${metrics.gap}px`}>
      {@render triggerControl()}
      <Button
        variant="ghost"
        size={affordanceSize}
        icon={closeIcon}
        ariaLabel={resolvedClearLabel}
        onClick={handleClear} />
    </span>
  {:else}
    {@render triggerControl()}
  {/if}
  {#if open}
    <ListboxPanel
      bind:panelEl={panelRef}
      id={panelId}
      {ariaLabel}
      panelClass={`fixed top-0 left-0 z-40 will-change-transform ${resolvedPanelClass}`}
      optionRowClass={resolvedOptionRowClass}
      optionRowStyle={resolvedOptionRowStyle}
      options={filteredOptions}
      highlightFlags={listbox.highlight.flags}
      isActive={option => option.value === activeValue}
      onSelect={option => void select(option.value)}
      onActivate={index => {
        if (listbox.selection.peek() !== index) listbox.selection.set(index)
      }}
      {setOptionEl}
      getTrigger={() => containerRef}
      getOpen={() => open}
      {align}
      {autoPlace}
      {emptyLabel}
      emptyRowClass={resolvedEmptyRowClass}
      emptyRowStyle={resolvedEmptyRowStyle}
      activeClass="bg-slate-800 text-cyan-200"
      idleClass="text-slate-300"
      labelOf={option => option.label}
      matchParts={option => labelParts(option.label)} />
  {/if}
</div>
