<script lang="ts">
  import { onMount } from 'svelte'
  import { t } from '$lib/i18n.svelte'

  interface Props {
    open: boolean
    onClose: () => void
    ariaLabel?: string
    children?: import('svelte').Snippet
  }

  let { open, onClose, ariaLabel, children }: Props = $props()

  const resolvedAriaLabel = $derived(ariaLabel ?? t('editor.documentList'))

  let panelRef = $state<HTMLElement | null>(null)
  let previouslyFocused: Element | null = null

  $effect(() => {
    if (open) {
      previouslyFocused = document.activeElement
      panelRef?.focus()
    } else if (previouslyFocused instanceof HTMLElement) {
      previouslyFocused.focus()
      previouslyFocused = null
    }
  })

  function trapFocus(event: KeyboardEvent) {
    if (!panelRef) return
    const focusable = panelRef.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
    )
    if (focusable.length === 0) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    const active = document.activeElement
    if (!panelRef.contains(active)) {
      event.preventDefault()
      first.focus()
    } else if (event.shiftKey && active === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && active === last) {
      event.preventDefault()
      first.focus()
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (!open) return
    if (event.key === 'Escape') {
      if (event.defaultPrevented) return
      const handledEvent = event as KeyboardEvent & { shareTextDialogHandled?: boolean }
      if (handledEvent.shareTextDialogHandled) return
      handledEvent.shareTextDialogHandled = true
      event.preventDefault()
      event.stopImmediatePropagation()
      onClose()
      return
    }
    if (event.key === 'Tab') {
      trapFocus(event)
    }
  }

  onMount(() => {
    document.addEventListener('keydown', handleKeydown)
    return () => document.removeEventListener('keydown', handleKeydown)
  })
</script>

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    data-testid="mobile-drawer-overlay"
    class="fixed inset-0 z-50 flex bg-slate-950/80"
    onclick={onClose}>
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      bind:this={panelRef}
      role="dialog"
      aria-modal="true"
      aria-label={resolvedAriaLabel}
      tabindex="-1"
      class="h-full w-full max-w-sm overflow-hidden border-r border-slate-800 bg-slate-900/95 shadow-2xl shadow-slate-950/60 outline-none"
      onclick={event => event.stopPropagation()}>
      {@render children?.()}
    </div>
  </div>
{/if}
