<script lang="ts">
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
    onSelect: (value: string) => void
    buttonClass?: string
    panelClass?: string
  }

  let {
    buttonLabel,
    options,
    activeValue = '',
    ariaLabel,
    align = 'left',
    autoPlace = true,
    onSelect,
    buttonClass = 'inline-flex min-w-24 items-center justify-between gap-2 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition hover:border-cyan-500',
    panelClass = 'w-32 overflow-hidden rounded-lg border border-slate-700 bg-slate-900/95 p-1 shadow-2xl shadow-slate-950/60 backdrop-blur',
  }: Props = $props()

  let open = $state(false)
  let containerRef = $state<HTMLDivElement | null>(null)
  let panelRef = $state<HTMLDivElement | null>(null)
  let panelStyle = $state({ left: 0, top: 0 })
  let panelReady = $state(false)
  let panelOriginalParent = $state<ParentNode | null>(null)
  let panelNextSibling = $state<Node | null>(null)

  function close() {
    open = false
  }

  function toggle() {
    open = !open
  }

  function select(value: string) {
    onSelect(value)
    close()
  }

  function attachPanelToBody() {
    if (!panelRef || !panelRef.parentNode || panelRef.parentNode === document.body) {
      return
    }
    panelOriginalParent = panelRef.parentNode
    panelNextSibling = panelRef.nextSibling
    document.body.appendChild(panelRef)
  }

  function restorePanelParent() {
    if (!panelRef || !panelOriginalParent) {
      return
    }
    if (panelNextSibling && panelNextSibling.parentNode === panelOriginalParent) {
      panelOriginalParent.insertBefore(panelRef, panelNextSibling)
    } else {
      panelOriginalParent.appendChild(panelRef)
    }
    panelOriginalParent = null
    panelNextSibling = null
  }

  function updatePanelPosition() {
    if (!open || !containerRef || !panelRef) {
      return
    }
    const rect = containerRef.getBoundingClientRect()
    const panelWidth = panelRef.offsetWidth
    const panelHeight = panelRef.offsetHeight
    let left = align === 'right' ? rect.right - panelWidth : rect.left
    left = Math.max(8, Math.min(left, window.innerWidth - panelWidth - 8))
    const spaceBelow = window.innerHeight - rect.bottom
    const spaceAbove = rect.top
    let top = rect.bottom + 8
    if (autoPlace && spaceBelow < panelHeight && spaceAbove > spaceBelow) {
      top = rect.top - 8 - panelHeight
    }
    top = Math.max(8, Math.min(top, window.innerHeight - panelHeight - 8))
    panelStyle = { left, top }
    panelReady = true
  }

  $effect(() => {
    if (!open) {
      panelReady = false
      restorePanelParent()
      return
    }
    function handleKeydownCapture(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopImmediatePropagation()
        event.preventDefault()
        close()
      }
    }
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node
      if (containerRef && !containerRef.contains(target) && panelRef && !panelRef.contains(target)) {
        close()
      }
    }
    attachPanelToBody()
    updatePanelPosition()
    window.addEventListener('resize', updatePanelPosition)
    window.addEventListener('keydown', handleKeydownCapture, true)
    document.addEventListener('mousedown', handlePointerDown)
    return () => {
      restorePanelParent()
      window.removeEventListener('resize', updatePanelPosition)
      window.removeEventListener('keydown', handleKeydownCapture, true)
      document.removeEventListener('mousedown', handlePointerDown)
    }
  })
</script>

<div class="relative" bind:this={containerRef} data-escape-capture={open ? '' : null}>
  <button
    type="button"
    aria-label={ariaLabel}
    aria-haspopup="listbox"
    aria-expanded={open}
    onclick={toggle}
    class={buttonClass}>
    <span>{buttonLabel}</span>
    <svg class="h-4 w-4 text-slate-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path
        fill-rule="evenodd"
        d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.938a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z"
        clip-rule="evenodd" />
    </svg>
  </button>
  {#if open}
    <div
      bind:this={panelRef}
      role="listbox"
      class:invisible={!panelReady}
      class={`fixed left-0 top-0 z-50 will-change-transform ${panelClass}`}
      style={`transform: translate(${panelStyle.left}px, ${panelStyle.top}px);`}>
      {#each options as option}
        <button
          type="button"
          role="option"
          aria-selected={option.value === activeValue}
          onclick={() => select(option.value)}
          class={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition ${option.value === activeValue ? 'bg-cyan-500/15 text-cyan-200' : 'text-slate-300 hover:bg-slate-800 hover:text-cyan-200'}`}>
          <span>{option.label}</span>
          {#if option.value === activeValue}
            <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path
                fill-rule="evenodd"
                d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
                clip-rule="evenodd" />
            </svg>
          {/if}
        </button>
      {/each}
    </div>
  {/if}
</div>
