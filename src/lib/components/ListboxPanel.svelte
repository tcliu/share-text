<script lang="ts" generics="T">
  import type { Snippet } from 'svelte'
  import { positionPanel } from '$lib/position-panel.svelte'
  import type { DropdownAlign } from '$lib/dropdown-chrome'
  import type { MatchedLabelParts } from '$lib/actions/option-index'

  // Shared floating listbox panel for the dropdown surfaces: one positioned
  // `role="listbox"` container, the optional empty row, and the option rows
  // (aria-activedescendant pattern — rows keep `tabindex="-1"` and never take
  // focus). The caller owns the trigger, filtering, active value, and commit;
  // it customizes the row content through the `option` snippet (default: the
  // label with its matched span emphasized).
  interface Props {
    id: string
    ariaLabel?: string
    panelClass: string
    optionRowClass: string
    options: T[]
    /** Per-row highlight flags from the owner's listbox core (O(1) updates). */
    highlightFlags: boolean[]
    /** Whether a row is the committed value (`aria-selected`). */
    isActive: (option: T, index: number) => boolean
    onSelect: (option: T, index: number) => void
    /** Hover/focus moved the highlight to this row. */
    onActivate: (index: number) => void
    /** Register a row element so the owner can reveal the active row. */
    setOptionEl: (index: number, el: HTMLElement | null) => void
    getTrigger: () => HTMLElement | null
    getOpen: () => boolean
    panelEl?: HTMLDivElement | null
    align?: DropdownAlign
    autoPlace?: boolean
    emptyLabel?: string
    emptyClass?: string
    activeClass: string
    idleClass: string
    optionKey?: (option: T, index: number) => string | number
    labelOf?: (option: T) => string
    matchParts?: (option: T) => MatchedLabelParts | null
    option?: Snippet<[T]>
  }

  let {
    id,
    ariaLabel,
    panelClass,
    optionRowClass,
    options,
    highlightFlags,
    isActive,
    onSelect,
    onActivate,
    setOptionEl,
    getTrigger,
    getOpen,
    panelEl = $bindable(null),
    align,
    autoPlace,
    emptyLabel,
    emptyClass,
    activeClass,
    idleClass,
    optionKey,
    labelOf,
    matchParts,
    option,
  }: Props = $props()

  // Register each row's element with the owner so its listbox core can scroll
  // the active row into view (the row never receives focus). An action, not a
  // queried lookup, so the panel never traverses the DOM.
  function registerOption(node: HTMLElement, index: number) {
    let current = index
    setOptionEl(current, node)
    return {
      update(next: number) {
        if (next === current) return
        setOptionEl(current, null)
        current = next
        setOptionEl(current, node)
      },
      destroy() {
        setOptionEl(current, null)
      },
    }
  }
</script>

<div
  bind:this={panelEl}
  id={id}
  role="listbox"
  aria-label={ariaLabel}
  use:positionPanel={() => ({ getTrigger, getOpen, align, autoPlace })}
  class={panelClass}>
  {#if emptyLabel && options.length === 0}
    <div role="presentation" class={emptyClass}>{emptyLabel}</div>
  {/if}
  {#each options as entry, index (optionKey ? optionKey(entry, index) : index)}
    {@const parts = matchParts?.(entry) ?? null}
    <button
      type="button"
      id={`${id}-option-${index}`}
      role="option"
      tabindex="-1"
      aria-selected={isActive(entry, index)}
      use:registerOption={index}
      onpointerdown={event => event.preventDefault()}
      onclick={() => onSelect(entry, index)}
      onfocus={() => onActivate(index)}
      onmousemove={() => onActivate(index)}
      class={`${optionRowClass} ${highlightFlags[index] ? activeClass : idleClass}`}>
      {#if option}
        {@render option(entry)}
      {:else}
        <span class="min-w-0 truncate">
          {#if parts}
            {parts.before}<span class="font-semibold text-cyan-300">{parts.match}</span>{parts.after}
          {:else}
            {labelOf?.(entry) ?? ''}
          {/if}
        </span>
      {/if}
    </button>
  {/each}
</div>
