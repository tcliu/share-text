<script lang="ts">
  import { flushSync, tick, type Snippet } from 'svelte'
  import Chip from '$lib/components/Chip.svelte'
  import ListboxPanel from '$lib/components/ListboxPanel.svelte'
  import { DEFAULT_CHIP_PANEL_CLASS } from '$lib/dropdown-chrome'
  import { useListbox } from '$lib/actions/use-listbox.svelte'
  import { getI18nContext } from '$lib/i18n.svelte'

  interface Props {
    value?: string[]
    availableTags?: string[]
    onChange?: (next: string[]) => void
    // Called with the current draft on every keystroke, so a caller can supply
    // externally filtered (e.g. async) `availableTags`.
    onQueryChange?: (query: string) => void
    placeholder?: string
    disabled?: boolean
    inputId?: string
    chipClass?: string
    chipClassFor?: (tag: string) => string
    // Colour classes per tag when neither `chipClass` nor `chipClassFor` is
    // given; replaces the built-in palette.
    palette?: readonly string[]
    chip?: Snippet<[tag: string, remove: () => void]>
    option?: Snippet<[tag: string]>
  }

  let {
    value = [],
    availableTags = [],
    onChange,
    onQueryChange,
    placeholder = '',
    disabled = false,
    inputId,
    chipClass,
    chipClassFor,
    palette,
    chip,
    option,
  }: Props = $props()
  const i18n = getI18nContext()

  // Built-in per-tag chip colours: a deterministic palette so tags read
  // distinctly with zero config. `chipClass`/`chipClassFor` override it, and
  // `palette` replaces it wholesale.
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
    if (chipClassFor) return chipClassFor(tag)
    if (chipClass) return chipClass
    const colors = palette && palette.length > 0 ? palette : DEFAULT_TAG_COLORS
    return colors[hashTag(tag) % colors.length]
  }

  let id = $props.id()
  const listboxId = `${id}-tag-suggestions`

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
    return availableTags.filter(
      tag => !selected.has(tag.toLowerCase()) && (!query || tag.toLowerCase().includes(query)),
    )
  })

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
      if (event.key === 'Enter' && open && navigated && suggestions.length > 0) {
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

<div
  bind:this={containerRef}
  data-escape-capture={open ? '' : null}
  onfocusout={listbox.handleFocusOut}
  class="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 transition focus-within:border-cyan-500">
  <div class="flex flex-wrap items-center gap-1.5">
    {#each value as tag, index (tag.toLowerCase())}
      {#if chip}
        {@render chip(tag, () => removeAt(index))}
      {:else}
        <Chip
          label={tag}
          chipClass={`rounded-full border px-2 py-0.5 text-xs ${resolveChipClass(tag)}`}
          ariaLabel={i18n.t('tagInput.remove', { name: tag })}
          onRemove={() => removeAt(index)}
          {disabled}
          removeButtonClass="rounded-full p-0.5 opacity-60 transition-opacity outline-none hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-cyan-500 disabled:cursor-not-allowed disabled:opacity-40" />
      {/if}
    {/each}
    <input
      bind:this={inputRef}
      id={inputId}
      class="min-w-24 flex-1 bg-transparent py-0.5 text-sm text-slate-100 outline-none placeholder:text-slate-500"
      bind:value={draft}
      {placeholder}
      {disabled}
      type="text"
      role="combobox"
      aria-label={placeholder}
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
</div>
{#snippet panelOption(tag: string)}
  {#if option}
    {@render option(tag)}
  {:else}
    <Chip
      label={tag}
      chipClass={`rounded-full border px-2 py-0.5 text-xs ${resolveChipClass(tag)}`} />
  {/if}
{/snippet}
{#if open && suggestions.length > 0}
  <ListboxPanel
    bind:panelEl={panelRef}
    id={listboxId}
    ariaLabel={i18n.t('tagInput.suggestions')}
    panelClass={DEFAULT_CHIP_PANEL_CLASS}
    optionRowClass="flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-none outline-none max-[27.999rem]:min-h-11"
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
    option={panelOption} />
{/if}
