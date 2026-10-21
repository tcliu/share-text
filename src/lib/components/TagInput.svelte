<script lang="ts">
  import { flushSync, tick, type Snippet } from 'svelte'
  import Button from '$lib/components/Button.svelte'
  import Chip from '$lib/components/Chip.svelte'
  import ListboxPanel from '$lib/components/ListboxPanel.svelte'
  import TextInput from '$lib/components/TextInput.svelte'
  import CloseIcon from '$lib/icons/CloseIcon.svelte'
  import { DEFAULT_CHIP_PANEL_CLASS } from '$lib/dropdown-chrome'
  import { useListbox } from '$lib/actions/use-listbox.svelte'
  import { matchLabelParts } from '$lib/actions/option-index'
  import { getI18nContext } from '$lib/i18n.svelte'
  import { FONT_RATIO, type SizeInput } from '$lib/size-scale'
  import { dimensionMetrics, sizeVarStyle } from './size-metrics'
  import type { ClearableProps } from './clearable-props'

  interface Props extends ClearableProps {
    value?: string[]
    // Baseline the clear affordance compares against (element-wise, in
    // order): the cross hides while `value` matches it (empty when unset),
    // and the fallback clear writes it back. A provided `onClear` still owns
    // the clear.
    defaultValue?: string[]
    options?: string[]
    onChange?: (next: string[]) => void
    // Called with the current draft on every keystroke, so a caller can supply
    // externally filtered (e.g. async) `options`.
    onQueryChange?: (query: string) => void
    placeholder?: string
    disabled?: boolean
    id?: string
    size?: SizeInput
    chipClass?: string | ((tag: string) => string)
    // Colour classes per tag when `chipClass` is not given; replaces the
    // built-in palette.
    palette?: readonly string[]
    chip?: Snippet<[tag: string, remove: () => void]>
    option?: Snippet<[tag: string]>
    // The cross belongs with the tags, so `clearPlacement` `auto` overlays
    // the box's own right edge; an explicit `outside` sits after the box as
    // a sibling instead.
  }

  let {
    value = [],
    defaultValue,
    options = [],
    onChange,
    onQueryChange,
    placeholder = '',
    disabled = false,
    id,
    size = 'md',
    chipClass,
    palette,
    chip,
    option,
    clearable = false,
    clearLabel,
    clearPlacement = 'auto',
    onClear,
  }: Props = $props()
  const i18n = getI18nContext()

  // Built-in per-tag chip colours: a deterministic palette so tags read
  // distinctly with zero config. `chipClass` overrides it (a function per tag,
  // a string for all), and `palette` replaces it wholesale.
  const DEFAULT_TAG_COLORS = [
    'border-orange-700 bg-orange-950/50 text-orange-200',
    'border-cyan-700 bg-cyan-950/50 text-cyan-200',
    'border-violet-700 bg-violet-950/50 text-violet-200',
    'border-emerald-700 bg-emerald-950/50 text-emerald-200',
    'border-rose-700 bg-rose-950/50 text-rose-200',
    'border-sky-700 bg-sky-950/50 text-sky-200',
  ]

  // FNV-1a: a well-distributed hash so nearby tags do not collide on a colour.
  function hashTag(tag: string): number {
    let hash = 2166136261
    for (const ch of tag) {
      hash ^= ch.charCodeAt(0)
      hash = Math.imul(hash, 16777619)
    }
    return hash >>> 0
  }

  function resolveChipClass(tag: string): string {
    if (typeof chipClass === 'function') return chipClass(tag)
    if (chipClass) return chipClass
    const colors = palette && palette.length > 0 ? palette : DEFAULT_TAG_COLORS
    return colors[hashTag(tag) % colors.length]
  }

  // Every metric is a fixed ratio of the size dimension, so each keeps a
  // constant metric:dimension ratio across the whole range. The container pads
  // like a text field (padX matches --input-pad-x); the chips size themselves
  // from the same dimension (their metrics live in `Chip`), and the input rides
  // tighter type so mixed content stays compact.
  const TAG_INPUT_RATIOS = {
    font: FONT_RATIO,
    line: 1.25,
    padX: 0.625,
    padY: 0.375,
    gap: 0.375,
    inputPadY: 0.125,
  }

  const metrics = $derived(dimensionMetrics(size, TAG_INPUT_RATIOS))
  const style = $derived(sizeVarStyle('tag', metrics))

  let uid = $props.id()
  const listboxId = `${uid}-tag-suggestions`

  let draft = $state('')
  let open = $state(false)
  let navigated = false
  let inputRef = $state<HTMLInputElement | null>(null)
  let containerRef = $state<HTMLDivElement | null>(null)
  let panelRef = $state<HTMLDivElement | null>(null)
  // Suggestion elements by index, registered by the shared panel so the
  // listbox core can reveal the active row (never queried from the DOM).
  let optionEls = $state<(HTMLElement | null)[]>([])

  function setOptionEl(index: number, el: HTMLElement | null): void {
    optionEls[index] = el
  }

  const query = $derived(draft.trim().toLowerCase())
  const suggestions = $derived.by(() => {
    const selected = new Set(value.map(tag => tag.toLowerCase()))
    return options.filter(
      tag => !selected.has(tag.toLowerCase()) && (!query || tag.toLowerCase().includes(query)),
    )
  })

  // Emphasize the typed part of each label only while the query is ambiguous:
  // with two or more matches the user needs to see which part matched, while a
  // lone match is already the only row and needs no extra emphasis.
  const highlightMatches = $derived(query !== '' && suggestions.length > 1)

  // Split a label around its matched span (shared helper), or return null when
  // highlighting is off for an unambiguous single match.
  function labelParts(tag: string) {
    return highlightMatches ? matchLabelParts(tag, query) : null
  }

  // `listbox` is created below; these effects run after setup, so the forward
  // reference is safe.
  // Reset the highlight whenever the visible suggestion list changes
  // (filter typing, add/remove) so arrows never start from a stale row.
  let lastSuggestions: string[] | null = null
  $effect(() => {
    if (!open) return
    if (lastSuggestions !== suggestions) {
      lastSuggestions = suggestions
      listbox.selection.reset()
    }
  })

  $effect(() => {
    if (!open) return
    listbox.selection.clamp(suggestions.length)
  })

  export function focus(): void {
    inputRef?.focus()
  }

  function emit(): void {
    onChange?.([...value])
  }

  function addName(name: string): void {
    const trimmed = name.trim()
    if (!trimmed) return
    if (value.some(tag => tag.toLowerCase() === trimmed.toLowerCase())) return
    value = [...value, trimmed]
    emit()
  }

  // Every programmatic draft change notifies `onQueryChange` too, so a caller
  // driving externally filtered suggestions resets its query with the field.
  function setDraft(next: string): void {
    draft = next
    onQueryChange?.(next)
  }

  function commitDraft(): void {
    const names = draft
      .split(',')
      .map(part => part.trim())
      .filter(Boolean)
    setDraft('')
    navigated = false
    if (!names.length) return
    const seen = new Set(value.map(tag => tag.toLowerCase()))
    const next = [...value]
    for (const name of names) {
      if (seen.has(name.toLowerCase())) continue
      seen.add(name.toLowerCase())
      next.push(name)
    }
    value = next
    emit()
  }

  function addSuggestion(tag: string): void {
    setDraft('')
    navigated = false
    addName(tag)
    tick().then(() => inputRef?.focus())
  }

  function removeAt(index: number): void {
    value = value.filter((_, i) => i !== index)
    emit()
    tick().then(() => inputRef?.focus())
  }

  // Element-wise, in-order comparison: any addition, removal, reorder, or
  // edit (including case) is something to clear.
  function tagsEqual(a: string[], b: string[]): boolean {
    return a.length === b.length && a.every((tag, index) => tag === b[index])
  }

  // A disabled field offers no clear action, and while `value` matches
  // `defaultValue` (empty when unset) there is nothing to clear, so the cross
  // hides.
  const showClear = $derived(clearable && !tagsEqual(value ?? [], defaultValue ?? []) && !disabled)
  const resolvedClearLabel = $derived(clearLabel ?? i18n.t('common.clear'))
  const placement = $derived(clearPlacement === 'auto' ? 'inside' : clearPlacement)
  // The container that hosts the clear button is chosen from `clearable`, not
  // from whether tags are present, so toggling the value never recreates the
  // box (which would drop focus) — only the button itself toggles.
  const insideField = $derived(clearable && placement === 'inside')
  const outsideField = $derived(clearable && placement === 'outside')
  const clearInside = $derived(showClear && insideField)

  // Inside-clear metrics: the icon is the size dimension itself, the inset
  // matches the box's horizontal padding, and the gutter reserves room for
  // both, so chips never run under the overlay. The gutter is reserved
  // whenever the inside clear is configured, not only while tags show the
  // button, so the content keeps the same width filled and at default.
  const CLEAR_RATIOS = { inset: TAG_INPUT_RATIOS.padX, gutter: 1.875, box: 1 }
  const clearMetrics = $derived(dimensionMetrics(size, CLEAR_RATIOS))
  const clearStyle = $derived(sizeVarStyle('clear', clearMetrics))
  const boxStyle = $derived(
    [style, insideField ? clearStyle : '', insideField ? 'padding-right:var(--clear-gutter)' : '']
      .filter(Boolean)
      .join(';'),
  )

  // A provided handler owns the clear; otherwise the list resets to a copy of
  // the default (never the prop array itself). Focus returns to the field, so
  // the control stays reachable after the cross disappears with it.
  function handleClear(): void {
    if (onClear) {
      onClear()
    } else {
      value = [...(defaultValue ?? [])]
      emit()
    }
    inputRef?.focus()
  }

  function openPanel(): void {
    if (disabled) return
    lastSuggestions = suggestions
    listbox.selection.reset()
    open = true
  }

  function handleInput(): void {
    navigated = false
    onQueryChange?.(draft)
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      if (event.key === 'Enter' && open && suggestions.length > 0 && (navigated || !draft.trim())) {
        addSuggestion(suggestions[listbox.selection.index] ?? suggestions[0])
        return
      }
      commitDraft()
    } else if (event.key === 'Backspace' && !draft && value.length > 0) {
      removeAt(value.length - 1)
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (!open) {
        flushSync(() => {
          openPanel()
        })
        return
      }
      navigated = true
      listbox.moveHighlight('down')
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (!open) {
        flushSync(() => {
          openPanel()
          listbox.selection.move('last', suggestions.length)
        })
        return
      }
      navigated = true
      listbox.moveHighlight('up')
    } else if (event.key === 'Home' || event.key === 'End') {
      if (open && suggestions.length > 0) {
        event.preventDefault()
        navigated = true
        listbox.moveHighlight(event.key === 'Home' ? 'first' : 'last')
      }
    }
  }

  const listbox = useListbox({
    isOpen: () => open,
    onClose: () => {
      commitDraft()
      open = false
    },
    openPanel,
    options: () => suggestions,
    optionLabel: tag => tag,
    getContainer: () => containerRef,
    getPanel: () => panelRef,
    getOptionEl: index => optionEls[index],
    onOutsideClick: () => {
      commitDraft()
      open = false
    },
    onEscape: () => {
      if (draft) {
        setDraft('')
        navigated = false
        return
      }
      open = false
    },
    onScrollClose: () => {
      open = false
    },
  })
</script>

{#snippet closeIcon()}
  <CloseIcon />
{/snippet}
{#snippet clearControl()}
  <!-- Ghost keeps the tiny cross unobtrusive; the cross is one fixed step
      rather than the field's own size. -->
  <Button
    variant="ghost"
    icon={closeIcon}
    ariaLabel={resolvedClearLabel}
    onClick={handleClear} />
{/snippet}
{#snippet fieldBox()}
  <div
    bind:this={containerRef}
    data-escape-capture={open ? '' : null}
    onfocusout={listbox.handleFocusOut}
    style={boxStyle}
    class={`rounded-lg border border-slate-700 bg-slate-950 px-[var(--tag-pad-x)] py-[var(--tag-pad-y)] transition focus-within:border-cyan-500${insideField ? ' relative' : ''}`}>
    <div class="flex flex-wrap items-center gap-[var(--tag-gap)]">
      {#each value as tag, index (tag.toLowerCase())}
        {#if chip}
          {@render chip(tag, () => removeAt(index))}
        {:else}
          <Chip
            label={tag}
            chipClass={`rounded-full border ${resolveChipClass(tag)}`}
            size={size}
            removable
            removeLabel={i18n.t('tagInput.remove', { name: tag })}
            onRemove={() => removeAt(index)}
            {disabled}
            removeButtonClass="rounded-full p-0.5 opacity-60 transition-opacity outline-none hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-cyan-500 disabled:cursor-not-allowed disabled:opacity-40" />
        {/if}
      {/each}
      <TextInput
        bind:inputRef
        bind:value={draft}
        id={id}
        {size}
        variant="embedded"
        className="min-w-24 flex-1 py-[var(--tag-input-pad-y)] text-[length:var(--tag-font)] leading-[var(--tag-line)] text-slate-100 placeholder:text-slate-500"
        {placeholder}
        {disabled}
        role="combobox"
        ariaLabel={placeholder}
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={open && suggestions.length > 0
          ? `${listboxId}-option-${listbox.selection.index}`
          : undefined}
        autocomplete="off"
        onfocus={() => {
          if (!open) openPanel()
        }}
        oninput={handleInput}
        onkeydown={handleKeydown} />
    </div>
    {#if clearInside}
      <!-- Overlays the box's own right edge, vertically centered; the flex
        centers the button exactly (no inline strut offset), and the
        reserved gutter keeps chips clear of it on every row. -->
      <span class="absolute top-1/2 right-[var(--clear-inset)] flex -translate-y-1/2 items-center">
        {@render clearControl()}
      </span>
    {/if}
  </div>
{/snippet}
{#if outsideField}
  <!-- The chips own the box content, so the clear sits after it as a sibling
    (like the dropdown surfaces), vertically centered against the box. Only the
    button toggles with the value, but its slot is reserved even while empty (an
    inert spacer the size of the cross) so the input keeps the same width empty
    and filled. -->
  <div class="flex items-center" style={`gap:${metrics.gap}px`}>
    <div class="min-w-0 flex-1">{@render fieldBox()}</div>
    {#if showClear}
      {@render clearControl()}
    {:else}
      <span
        aria-hidden="true"
        class="shrink-0"
        style={`width:${clearMetrics.box}px;height:${clearMetrics.box}px`}></span>
    {/if}
  </div>
{:else}
  {@render fieldBox()}
{/if}
{#snippet panelOption(tag: string)}
  {#if option}
    {@render option(tag)}
  {/if}
{/snippet}
{#if open && suggestions.length > 0}
  <ListboxPanel
    bind:panelEl={panelRef}
    id={listboxId}
    ariaLabel={i18n.t('tagInput.suggestions')}
    panelClass={DEFAULT_CHIP_PANEL_CLASS}
    optionRowClass="flex w-full cursor-pointer items-center gap-2 rounded-md px-[var(--tag-pad-x)] py-[var(--tag-pad-y)] text-left text-[length:var(--tag-font)] leading-[var(--tag-line)] transition-none outline-none max-phone:min-h-11"
    optionRowStyle={style}
    options={suggestions}
    highlightFlags={listbox.highlight.flags}
    isActive={(_tag, index) => index === listbox.selection.index}
    onSelect={tag => addSuggestion(tag)}
    onActivate={index => {
      navigated = true
      listbox.selection.set(index)
    }}
    setOptionEl={setOptionEl}
    getTrigger={() => containerRef}
    getOpen={() => open}
    activeClass="bg-slate-800 text-cyan-200"
    idleClass="text-slate-300 hover:bg-slate-800 hover:text-cyan-200 focus:bg-slate-800 focus:text-cyan-200"
    optionKey={tag => tag.toLowerCase()}
    labelOf={tag => tag}
    matchParts={tag => labelParts(tag)}
    option={option ? panelOption : undefined} />
{/if}
