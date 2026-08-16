<script lang="ts">
  import { positionPanel } from '$lib/position-panel.svelte'
  import { LOCALES, getLocale, setLocale, t, type Locale } from '$lib/i18n.svelte'
  import GlobeIcon from '$lib/icons/GlobeIcon.svelte'

  interface Props {
    align?: 'left' | 'right'
    autoPlace?: boolean
  }

  let { align = 'left', autoPlace = true }: Props = $props()

  const id = Math.random().toString(36).slice(2)
  const menuId = `language-menu-${id}`

  let open = $state(false)
  let containerRef = $state<HTMLDivElement | null>(null)
  let triggerRef = $state<HTMLButtonElement | null>(null)
  let panelRef = $state<HTMLDivElement | null>(null)

  function close(returnFocus = true) {
    open = false
    if (returnFocus) {
      triggerRef?.focus()
    }
  }

  function toggle() {
    open = !open
  }

  function select(locale: Locale) {
    close()
    setLocale(locale)
  }

  $effect(() => {
    if (!open) return
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
        close(false)
      }
    }
    const handleScroll = () => close(false)
    window.addEventListener('keydown', handleKeydownCapture, true)
    document.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('scroll', handleScroll, { capture: true, passive: true })
    return () => {
      window.removeEventListener('keydown', handleKeydownCapture, true)
      document.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('scroll', handleScroll, { capture: true })
    }
  })
</script>

<div class="relative inline-flex" bind:this={containerRef} data-escape-capture={open ? '' : null}>
  <button
    type="button"
    bind:this={triggerRef}
    aria-label={t('language.label')}
    aria-haspopup="menu"
    aria-expanded={open}
    aria-controls={open ? menuId : undefined}
    onclick={toggle}
    class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-700 bg-slate-950 text-slate-200 transition hover:border-cyan-500 hover:text-cyan-300">
    <GlobeIcon className="h-4 w-4" />
  </button>
  {#if open}
    <div
      bind:this={panelRef}
      id={menuId}
      role="menu"
      tabindex="-1"
      aria-label={t('language.label')}
      use:positionPanel={() => ({ getTrigger: () => containerRef, getOpen: () => open, align, autoPlace })}
      class="fixed left-0 top-0 z-50 will-change-transform w-40 overflow-hidden rounded-lg border border-slate-700 bg-slate-900/95 p-1 shadow-2xl shadow-slate-950/60 backdrop-blur">
      {#each LOCALES as option (option.code)}
        <button
          type="button"
          role="menuitemradio"
          aria-checked={getLocale() === option.code}
          onclick={() => select(option.code)}
          class={`flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm transition ${
            getLocale() === option.code
              ? 'bg-cyan-500/15 text-cyan-200'
              : 'text-slate-300 hover:bg-slate-800 hover:text-cyan-200'
          }`}>
          <span>{option.label}</span>
          {#if getLocale() === option.code}
            <span class="h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400"></span>
          {/if}
        </button>
      {/each}
    </div>
  {/if}
</div>
