<script lang="ts">
  import { positionPanel } from '$lib/position-panel.svelte'

  interface Option {
    value: string
    label: string
  }

  interface Props {
    buttonLabel: string
    options: Option[]
    activeValue?: string
    ariaLabel?: string
    align?: 'left' | 'right'
    autoPlace?: boolean
    filterable?: boolean
    size?: 'xs' | 'sm' | 'md' | 'lg'
    onSelect: (value: string) => void
    buttonClass?: string
    controlClass?: string
    optionClass?: string
    panelClass?: string
  }

  const id = Math.random().toString(36).slice(2)
  const panelId = `select-dropdown-panel-${id}`

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
    panelClass = 'w-32 overflow-hidden rounded-lg border border-slate-700 bg-slate-900/95 p-1 shadow-2xl shadow-slate-950/60 backdrop-blur',
  }: Props = $props()

  const SIZE_CLASS = {
    xs: { pad: 'py-1', minW: 'min-w-16' },
    sm: { pad: 'py-2', minW: 'min-w-24' },
    md: { pad: 'py-2.5', minW: 'min-w-24' },
    lg: { pad: 'py-3', minW: 'min-w-28' },
  } as const

  const resolvedButtonClass = $derived(
    buttonClass ??
      `inline-flex ${SIZE_CLASS[size].minW} items-center justify-between gap-2 rounded-md border border-slate-700 bg-slate-950 px-3 text-slate-100 outline-none transition hover:border-cyan-500 ${SIZE_CLASS[size].pad} text-${size}`,
  )

  const resolvedControlClass = $derived(
    controlClass ??
      `${SIZE_CLASS[size].minW} field-sizing-content rounded-md border border-slate-700 bg-slate-950 pl-3 pr-8 text-slate-100 outline-none transition hover:border-cyan-500 focus:border-cyan-500 ${SIZE_CLASS[size].pad} text-${size}`,
  )

  const optionRowClass = $derived(
    optionClass ??
      `flex w-full items-center justify-between rounded-md px-3 text-left transition ${SIZE_CLASS[size].pad} text-${size}`,
  )

  const emptyClass = $derived(`px-3 ${SIZE_CLASS[size].pad} text-${size} text-slate-500`)

  let open = $state(false)
  let containerRef = $state<HTMLDivElement | null>(null)
  let panelRef = $state<HTMLDivElement | null>(null)
  let filterText = $state('')
  let highlightIndex = $state(0)

  const filteredOptions = $derived.by(() => {
    if (!filterable) {
      return options
    }
    const query = filterText.startsWith(buttonLabel) ? filterText.slice(buttonLabel.length) : filterText
    const needle = query.trim().toLowerCase()
    if (needle === '') {
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

  $effect(() => {
    void filteredOptions
    if (open && highlightIndex !== 0) {
      highlightIndex = 0
    }
  })

  function close() {
    open = false
  }

  function toggle() {
    open = !open
  }

  function openPanel() {
    open = true
  }

  function handleControlFocus() {
    openPanel()
  }

  function select(value: string) {
    onSelect(value)
    close()
  }

  function handleControlKeydown(event: KeyboardEvent) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (filteredOptions.length === 0) return
      highlightIndex = (highlightIndex + 1) % filteredOptions.length
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (filteredOptions.length === 0) return
      highlightIndex = (highlightIndex - 1 + filteredOptions.length) % filteredOptions.length
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const option = filteredOptions[highlightIndex] ?? filteredOptions[0]
      if (option) {
        select(option.value)
      }
    }
  }

  $effect(() => {
    if (!open) {
      return
    }
    function handleKeydownCapture(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopImmediatePropagation()
        event.preventDefault()
        if (filterable && filterText && filterText !== buttonLabel) {
          filterText = ''
          return
        }
        close()
      }
    }
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node
      if (containerRef && !containerRef.contains(target) && panelRef && !panelRef.contains(target)) {
        close()
      }
    }
    window.addEventListener('keydown', handleKeydownCapture, true)
    document.addEventListener('mousedown', handlePointerDown)
    return () => {
      window.removeEventListener('keydown', handleKeydownCapture, true)
      document.removeEventListener('mousedown', handlePointerDown)
    }
  })
</script>

<div class="relative" bind:this={containerRef} data-escape-capture={open ? '' : null}>
  {#if filterable}
    <div class="relative">
      <input
        type="text"
        bind:value={filterText}
        role="combobox"
        aria-label={ariaLabel}
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-activedescendant={open && filteredOptions[highlightIndex]
          ? `${panelId}-option-${highlightIndex}`
          : undefined}
        onfocus={handleControlFocus}
        onkeydown={handleControlKeydown}
        class={resolvedControlClass} />
      <svg
        class="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true">
        <path
          fill-rule="evenodd"
          d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.938a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z"
          clip-rule="evenodd" />
      </svg>
    </div>
  {:else}
    <button
      type="button"
      aria-label={ariaLabel}
      aria-haspopup="listbox"
      aria-expanded={open}
      onclick={toggle}
      class={resolvedButtonClass}>
      <span>{buttonLabel}</span>
      <svg class="h-4 w-4 text-slate-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path
          fill-rule="evenodd"
          d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.938a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z"
          clip-rule="evenodd" />
      </svg>
    </button>
  {/if}
  {#if open}
    <div
      bind:this={panelRef}
      id={panelId}
      role="listbox"
      aria-label={ariaLabel}
      use:positionPanel={() => ({ getTrigger: () => containerRef, getOpen: () => open, align, autoPlace })}
      class={`fixed left-0 top-0 z-50 will-change-transform ${panelClass}`}>
      {#if filteredOptions.length === 0}
        <div class={emptyClass}>No options</div>
      {/if}
      {#each filteredOptions as option, index}
        <button
          type="button"
          id={`${panelId}-option-${index}`}
          role="option"
          aria-selected={option.value === activeValue || index === highlightIndex}
          onclick={() => select(option.value)}
          onmouseenter={() => (highlightIndex = index)}
          class={`${optionRowClass} ${
            index === highlightIndex
              ? 'bg-slate-800 text-cyan-200'
              : option.value === activeValue
                ? 'bg-cyan-500/15 text-cyan-200'
                : 'text-slate-300 hover:bg-slate-800 hover:text-cyan-200'
          }`}>
          <span>{option.label}</span>
        </button>
      {/each}
    </div>
  {/if}
</div>
