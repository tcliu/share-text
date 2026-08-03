<script module>
  let openDialogCount = 0
</script>

<script lang="ts">
  import { onDestroy, onMount } from 'svelte'

  interface Props {
    badgeColor?: 'rose' | 'emerald' | 'cyan' | 'violet' | 'amber'
    badgeLabel?: string
    title: string
    titleClass?: string
    maxWidth?: 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl'
    pending?: boolean
    allowPendingCancel?: boolean
    dismissKeydownCapture?: boolean
    onCancel: () => void
    children?: import('svelte').Snippet
  }

  let {
    badgeColor = 'rose',
    badgeLabel = '',
    title,
    titleClass = '',
    maxWidth = 'md',
    pending = false,
    allowPendingCancel = false,
    dismissKeydownCapture = true,
    onCancel,
    children,
  }: Props = $props()

  let dialogIndex = 0

  onMount(() => {
    openDialogCount += 1
    dialogIndex = openDialogCount
  })

  onDestroy(() => {
    openDialogCount -= 1
  })

  const cancelDisabled = $derived(pending && !allowPendingCancel)

  function handleCancelRequest() {
    if (!cancelDisabled) {
      onCancel()
    }
  }

  function isTopmostDialog() {
    return dialogIndex === openDialogCount
  }

  function handleWindowKeydown(event: KeyboardEvent) {
    const handledEvent = event as KeyboardEvent & {
      shareTextDialogHandled?: boolean
    }

    if (handledEvent.shareTextDialogHandled) {
      return
    }

    if (event.defaultPrevented) {
      return
    }

    if (event.key === 'Escape' && !cancelDisabled && isTopmostDialog()) {
      const target = event.target
      if (target instanceof Element && target.closest('[data-escape-capture]')) {
        return
      }
      handledEvent.shareTextDialogHandled = true
      event.stopImmediatePropagation()
      event.preventDefault()
      onCancel()
    }
  }

  const colorClasses: Record<string, string> = {
    rose: 'text-rose-300',
    emerald: 'text-emerald-300',
    cyan: 'text-cyan-300',
    violet: 'text-violet-300',
    amber: 'text-amber-300',
  }

  const maxWidthClasses: Record<string, string> = {
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
  }
  $effect(() => {
    if (!dismissKeydownCapture) {
      return
    }

    document.addEventListener('keydown', handleWindowKeydown, true)
    return () => document.removeEventListener('keydown', handleWindowKeydown, true)
  })
</script>

<svelte:window onkeydown={handleWindowKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="fixed inset-0 z-50 bg-slate-950/80 px-4 py-6" onclick={handleCancelRequest}>
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="flex min-h-full items-center justify-center" onclick={e => e.stopPropagation()}>
      <section
        class="relative flex max-h-[calc(100vh-3rem)] w-full flex-col overflow-y-auto rounded-xl border border-slate-800 bg-slate-900/95 p-6 shadow-2xl shadow-slate-950/60 backdrop-blur {maxWidthClasses[
          maxWidth
        ] ?? 'max-w-md'}">
      <button
        type="button"
        aria-label="Close dialog"
        onclick={handleCancelRequest}
        disabled={cancelDisabled}
        class="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-800 hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-40">
        <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"
          ><path
            d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" /></svg>
      </button>
      {#if badgeLabel}
        <p class="text-xs font-semibold uppercase tracking-[0.24em] {colorClasses[badgeColor]}">
          {badgeLabel}
        </p>
      {/if}
      <h2 class="text-2xl font-semibold tracking-tight text-slate-100 {titleClass}">
        {title}
      </h2>
      {@render children?.()}
    </section>
  </div>
</div>
