<script module>
  // Ids of the dialogs currently mounted. The topmost dialog is the most
  // recently mounted one still mounted; a live id set (rather than a mount-time
  // counter) stays correct when a base dialog unmounts while a stacked confirm
  // is still open, so the confirm keeps handling Escape and the focus trap
  // instead of wedging behind a stale index.
  const liveDialogIds = new Set<number>()
  // Monotonic id sequence: title ids must never be reused across mounts, or a
  // lingering title element from a previous dialog can hijack the new dialog's
  // accessible name (the first matching id wins).
  let dialogIdSeq = 0

  // Panel footprint steps, exported so the showcase dropdowns can't drift from
  // the values the component accepts.
  export const DIALOG_SIZE_VARIANTS = [
    'xs',
    'sm',
    'md',
    'lg',
    'xl',
    '2xl',
    '3xl',
    '4xl',
    '5xl',
    '6xl',
    '7xl',
  ] as const
</script>

<script lang="ts">
  import { browser } from '$app/environment'
  import { onDestroy, onMount, tick } from 'svelte'
  import CloseIcon from '$lib/icons/CloseIcon.svelte'
  import { positionPanel } from '$lib/position-panel.svelte'
  import { getI18nContext } from '$lib/i18n.svelte'
  const i18n = getI18nContext()

  // Panel footprint steps. `xs`–`7xl` are the shared container scale (the same
  // names Tailwind's `max-w-*` uses); `fit`/`wide` are width-only extras.
  export type DialogSizeVariant = (typeof DIALOG_SIZE_VARIANTS)[number]

  export type DialogWidthVariant = DialogSizeVariant | 'fit' | 'wide'
  // `auto` hugs the content; a size step pins the panel height.
  export type DialogHeightVariant = 'auto' | DialogSizeVariant

  interface Props {
    /** Ignored when `header` is set. */
    title?: string
    /** Custom header content; wins over `title` and still labels the dialog. */
    header?: import('svelte').Snippet
    /** Fixed footer content below the body scroll container. */
    footer?: import('svelte').Snippet
    className?: string
    widthVariant?: DialogWidthVariant
    heightVariant?: DialogHeightVariant
    // Shorthand that sets both variants to one step; an explicit
    // `widthVariant`/`heightVariant` wins over it.
    size?: DialogSizeVariant
    // Overrides the i18n close-dialog label (callers that pass their own
    // strings keep working); defaults to the shared locale label.
    closeLabel?: string
    // Accessible name used only when neither `title` nor `header` labels the
    // dialog; defaults to a generic locale label so no dialog is unnamed.
    ariaLabel?: string
    // Blocks Escape, overlay, and close-icon dismissal (e.g. while an async
    // confirm is pending) without disabling the footer buttons.
    dismissDisabled?: boolean
    onCancel: () => void
    children?: import('svelte').Snippet
  }

  let {
    title,
    header,
    footer,
    className = '',
    widthVariant,
    heightVariant,
    size,
    closeLabel,
    ariaLabel,
    dismissDisabled = false,
    onCancel,
    children,
  }: Props = $props()

  // Derived (not a plain const) so locale switches re-resolve the label.
  const resolvedCloseLabel = $derived(closeLabel ?? i18n.t('common.closeDialog'))

  let dialogId = 0
  let dialogRef = $state<HTMLElement | null>(null)
  let titleId = $state('')
  let previouslyFocused: Element | null = null

  const widthVariantClasses: Record<DialogWidthVariant, string> = {
    xs: 'max-w-xs',
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
    '5xl': 'max-w-5xl',
    '6xl': 'max-w-6xl',
    '7xl': 'max-w-7xl',
    fit: 'w-fit max-w-[90vw]',
    wide: 'w-[min(96vw,96rem)] max-w-[96rem]',
  }

  // Tailwind has no named `max-h` container scale, so the height steps mirror
  // the width steps in rem through the dynamic spacing scale. The panel's own
  // `max-h-[90vh]` caps them, so a tall step still fits a short viewport.
  const heightVariantClasses: Record<DialogHeightVariant, string> = {
    auto: '',
    xs: 'h-80',
    sm: 'h-96',
    md: 'h-112',
    lg: 'h-128',
    xl: 'h-144',
    '2xl': 'h-168',
    '3xl': 'h-192',
    '4xl': 'h-224',
    '5xl': 'h-256',
    '6xl': 'h-288',
    '7xl': 'h-320',
  }

  // `size` is the shared shorthand: an explicit variant wins, then `size`,
  // then the historical defaults (width md, content-hugging height).
  const resolvedWidthVariant = $derived(widthVariant ?? size ?? 'md')
  const resolvedHeightVariant = $derived(heightVariant ?? size ?? 'auto')

  const sizeClass = $derived.by(() => {
    const widthClass =
      resolvedWidthVariant === 'fit' || resolvedWidthVariant === 'wide'
        ? widthVariantClasses[resolvedWidthVariant]
        : `w-full ${widthVariantClasses[resolvedWidthVariant] ?? widthVariantClasses.md}`
    const hClass = heightVariantClasses[resolvedHeightVariant]
    return [widthClass, hClass].filter(Boolean).join(' ')
  })

  onMount(() => {
    dialogId = ++dialogIdSeq
    liveDialogIds.add(dialogId)
    titleId = `dialog-title-${dialogId}`
    previouslyFocused = document.activeElement
    void tick().then(() => {
      const firstInput = dialogRef?.querySelector<HTMLElement>(
        'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [autofocus]',
      )
      ;(firstInput ?? dialogRef)?.focus()
    })
  })

  onDestroy(() => {
    liveDialogIds.delete(dialogId)
    if (browser && previouslyFocused instanceof HTMLElement && previouslyFocused.isConnected) {
      previouslyFocused.focus()
    }
  })

  function isTopmostDialog() {
    if (liveDialogIds.size === 0) return true
    let highest = 0
    for (const id of liveDialogIds) {
      if (id > highest) highest = id
    }
    return dialogId === highest
  }

  function handleCancelRequest() {
    if (dismissDisabled) return
    onCancel()
  }

  function trapFocus(event: KeyboardEvent) {
    if (!dialogRef) return
    const focusable = dialogRef.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
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
    // Cooperates with sibling overlays (drawers, nested dialogs): whoever
    // handles the key first marks it so the other listeners stand down.
    const handledEvent = event as KeyboardEvent & {
      dialogHandled?: boolean
    }

    if (handledEvent.dialogHandled) {
      return
    }

    if (event.defaultPrevented) {
      return
    }

    if (!isTopmostDialog()) {
      return
    }

    if (event.key === 'Escape') {
      const target = event.target
      if (target instanceof Element && target.closest('[data-escape-capture]')) {
        return
      }
      handledEvent.dialogHandled = true
      event.stopImmediatePropagation()
      event.preventDefault()
      if (!dismissDisabled) onCancel()
    } else if (event.key === 'Tab') {
      trapFocus(event)
    }
  }

  $effect(() => {
    document.addEventListener('keydown', handleWindowKeydown, true)
    return () => document.removeEventListener('keydown', handleWindowKeydown, true)
  })
</script>

<!-- Sheet-portal to document.body so the dialog is never clipped or trapped
  by an ancestor stacking context (e.g. the showcase's paint-contained demo
  row); the dialog stays mounted here for focus and teardown bookkeeping. -->
<div
  use:positionPanel={() => ({ getTrigger: () => null, getOpen: () => true, presentation: 'sheet' })}
  class="dialog @container fixed inset-0 z-40">
  <button
    type="button"
    data-testid="dialog-overlay"
    aria-label={resolvedCloseLabel}
    aria-disabled={dismissDisabled || undefined}
    tabindex="-1"
    class="absolute inset-0 bg-slate-950/80 outline-none"
    onclick={handleCancelRequest}></button>
  <div class="relative flex min-h-full items-center justify-center px-4 py-6 @max-md:p-0">
    <div
      bind:this={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={header || title ? titleId : undefined}
      aria-label={header || title ? undefined : (ariaLabel ?? i18n.t('common.dialog'))}
      tabindex="-1"
      class={`relative flex max-h-[90vh] flex-col overflow-y-auto rounded-xl border border-slate-800 bg-slate-900/95 shadow-2xl shadow-slate-950/60 backdrop-blur outline-none @max-md:h-dvh @max-md:max-h-full @max-md:w-full @max-md:max-w-none @max-md:rounded-none @max-md:border-x-0 ${sizeClass} ${className}`}>
      <button
        type="button"
        aria-label={resolvedCloseLabel}
        aria-disabled={dismissDisabled || undefined}
        onclick={handleCancelRequest}
        class={`absolute top-4 right-4 flex items-center justify-center p-1.5 text-slate-500 transition outline-none before:absolute before:-inset-1.5 before:content-[''] focus:text-slate-200 motion-reduce:transition-none ${dismissDisabled
          ? 'cursor-not-allowed opacity-40'
          : 'hover:text-slate-200'}`}>
        <CloseIcon />
      </button>
      {#if header || title}
        <div id={titleId} class="pt-5.5 pr-12 pl-5.5 text-2xl font-semibold tracking-tight text-slate-100">
          {#if header}
            {@render header()}
          {:else}
            <h2>{title}</h2>
          {/if}
        </div>
      {/if}
      <div tabindex="-1" class="flex min-h-0 flex-1 flex-col overflow-y-auto px-5.5 pt-4 pb-5.5 outline-none">
        {@render children?.()}
      </div>
      {#if footer}
        <div class="flex-none px-5.5 pb-5.5">
          {@render footer()}
        </div>
      {/if}
    </div>
  </div>
</div>
