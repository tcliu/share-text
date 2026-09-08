<script module>
  let openDialogCount = 0
</script>

<script lang="ts">
  import { onDestroy, onMount } from 'svelte'
  import CloseIcon from '$lib/icons/CloseIcon.svelte'
  import { getI18nContext } from '$lib/i18n.svelte'
  const i18n = getI18nContext()

  interface Props {
    title?: string
    titleClass?: string
    className?: string
    maxWidth?: 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | 'fit'
    pending?: boolean
    allowPendingCancel?: boolean
    dismissKeydownCapture?: boolean
    fullscreen?: boolean
    onCancel: () => void
    header?: import('svelte').Snippet
    children?: import('svelte').Snippet
  }

  let {
    title,
    titleClass = '',
    className = '',
    maxWidth = 'md',
    pending = false,
    allowPendingCancel = false,
    dismissKeydownCapture = true,
    fullscreen = false,
    onCancel,
    header,
    children,
  }: Props = $props()

  let dialogIndex = 0
  let dialogRef = $state<HTMLElement | null>(null)
  let titleId = $state('')
  let previouslyFocused: Element | null = null

  onMount(() => {
    openDialogCount += 1
    dialogIndex = openDialogCount
    titleId = `share-text-dialog-title-${dialogIndex}`

    previouslyFocused = document.activeElement
    requestAnimationFrame(() => {
      if (dialogRef && !dialogRef.contains(document.activeElement)) {
        dialogRef.focus()
      }
    })
  })

  onDestroy(() => {
    openDialogCount -= 1
    if (previouslyFocused instanceof HTMLElement && previouslyFocused.isConnected) {
      previouslyFocused.focus()
    }
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

  function trapFocus(event: KeyboardEvent) {
    if (!dialogRef) return
    const focusable = dialogRef.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
    )
    if (focusable.length === 0) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    const active = document.activeElement
    if (!dialogRef.contains(active)) {
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

    if (!isTopmostDialog()) {
      return
    }

    if (event.key === 'Escape' && !cancelDisabled) {
      const target = event.target
      if (target instanceof Element && target.closest('[data-escape-capture]')) {
        return
      }
      handledEvent.shareTextDialogHandled = true
      event.stopImmediatePropagation()
      event.preventDefault()
      onCancel()
    } else if (event.key === 'Tab') {
      trapFocus(event)
    }
  }

  const maxWidthClasses: Record<string, string> = {
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
  }

  const sizeClass = $derived(
    maxWidth === 'fit' ? 'w-fit max-w-[90vw]' : `w-full max-w-[90vw] ${maxWidthClasses[maxWidth] ?? 'max-w-md'}`,
  )
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
<div
  data-testid="dialog-overlay"
  class="fixed inset-0 z-40 {fullscreen ? 'bg-slate-950' : 'bg-slate-950/80 px-4 py-6'}"
  onclick={handleCancelRequest}>
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class={fullscreen ? 'h-full' : 'flex min-h-full items-center justify-center'} onclick={e => e.stopPropagation()}>
    <div
      bind:this={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={!header && title ? titleId : undefined}
      tabindex="-1"
      class="relative flex flex-col overflow-y-auto outline-none {fullscreen
        ? 'h-full w-full bg-slate-900 p-5.5'
        : `max-h-[90vh] rounded-xl border border-slate-800 bg-slate-900/95 p-5.5 shadow-2xl shadow-slate-950/60 backdrop-blur ${sizeClass}`} {className}">
      <button
        type="button"
        aria-label={i18n.t('common.closeDialog')}
        onclick={handleCancelRequest}
        disabled={cancelDisabled}
        class="absolute right-4 top-4 flex items-center justify-center p-1.5 text-slate-500 transition outline-none hover:text-slate-200 focus:text-slate-200 before:absolute before:-inset-1.5 before:content-[''] disabled:cursor-not-allowed disabled:opacity-40">
        <CloseIcon className="h-4 w-4" />
      </button>
      {#if header}
        {@render header()}
      {:else if title}
        <h2 id={titleId} class="text-2xl font-semibold tracking-tight text-slate-100 {titleClass}">
          {title}
        </h2>
      {/if}
      <div class="mt-4 flex min-h-0 flex-1 flex-col overflow-y-auto">
        {@render children?.()}
      </div>
    </div>
  </div>
</div>
