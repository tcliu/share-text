<script module lang="ts">
  export type ToastPosition = 'top-right' | 'top-center' | 'bottom-right' | 'bottom-center'
  export type ToastType = 'success' | 'info' | 'warning' | 'error'
</script>

<script lang="ts">
  import Button from '$lib/components/Button.svelte'
  import CloseIcon from '$lib/icons/CloseIcon.svelte'
  import { positionPanel } from '$lib/position-panel.svelte'
  import { FONT_RATIO, type SizeInput } from '$lib/size-scale'
  import { dimensionMetrics, sizeVarStyle } from './size-metrics'

  interface Props {
    message: string
    closeLabel: string
    position?: ToastPosition
    size?: SizeInput
    type?: ToastType
    // The action button renders only when an action is set.
    action?: { label: string; onClick: () => void }
    onClose: () => void
  }

  let {
    message,
    closeLabel,
    action,
    position = 'bottom-right',
    size = 'md',
    type = 'info',
    onClose,
  }: Props = $props()

  // Viewport-edge positions in the ToastifierJS style: corners and top/bottom
  // center. On phone widths the toast spans the viewport with safe margins;
  // from `sm` up it docks to the chosen edge.
  const positionClasses: Record<ToastPosition, string> = {
    'top-right': 'top-4 inset-x-4 sm:inset-x-auto sm:top-4 sm:right-4 sm:w-96',
    'top-center': 'top-4 inset-x-4 sm:inset-x-auto sm:top-4 sm:left-1/2 sm:w-96 sm:-translate-x-1/2',
    'bottom-right': 'bottom-4 inset-x-4 sm:inset-x-auto sm:bottom-4 sm:right-4 sm:w-96',
    'bottom-center': 'bottom-4 inset-x-4 sm:inset-x-auto sm:bottom-4 sm:left-1/2 sm:w-96 sm:-translate-x-1/2',
  }

  // Continuous text metrics: every metric is a fixed ratio of the size
  // dimension, so text scales smoothly with the same font ratio every other
  // sized component uses.
  const TOAST_RATIOS = { font: FONT_RATIO, line: 1.5 }

  const toastMetrics = $derived(dimensionMetrics(size, TOAST_RATIOS))
  const toastStyle = $derived(sizeVarStyle('toast', toastMetrics))

  const typeClasses: Record<ToastType, string> = {
    success:
      'border border-transparent border-l-8 border-l-[var(--toast-success-border)] bg-[var(--toast-success-bg)] text-[var(--toast-success-fg)]',
    info: 'border border-transparent border-l-8 border-l-[var(--toast-info-border)] bg-[var(--toast-info-bg)] text-[var(--toast-info-fg)]',
    warning:
      'border border-transparent border-l-8 border-l-[var(--toast-warning-border)] bg-[var(--toast-warning-bg)] text-[var(--toast-warning-fg)]',
    error:
      'border border-transparent border-l-8 border-l-[var(--toast-error-border)] bg-[var(--toast-error-bg)] text-[var(--toast-error-fg)]',
  }

  // Escape dismisses the toast. Dialogs consume Escape first in the capture
  // phase and stop propagation, so an open dialog keeps precedence.
  $effect(() => {
    function handleKeydown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !event.defaultPrevented) {
        event.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  })
</script>

<!-- Sheet-portal to document.body so the toast is never clipped or trapped
  by an ancestor stacking context (see BaseDialog). -->
<div
  use:positionPanel={() => ({ getTrigger: () => null, getOpen: () => true, presentation: 'sheet' })}
  role="status"
  aria-live="polite"
  style={toastStyle}
  class={`fixed z-40 flex items-start gap-3 rounded-md px-4 py-3 shadow-lg shadow-slate-950/25 backdrop-blur-sm ${typeClasses[type]} ${positionClasses[position]}`}>
  <p class="min-w-0 flex-1 font-medium text-[length:var(--toast-font)] leading-[var(--toast-line)]">{message}</p>
  {#if action}
    <Button variant="ghost" {size} onClick={action.onClick} className="shrink-0 px-2.5 py-1.5 font-semibold">
      {action.label}
    </Button>
  {/if}
  <Button
    variant="ghost"
    {size}
    ariaLabel={closeLabel}
    onClick={onClose}
    className="shrink-0 opacity-75 hover:opacity-100">
    {#snippet icon()}
      <CloseIcon size={size} />
    {/snippet}
  </Button>
</div>
