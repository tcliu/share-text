<script lang="ts">
  import type { ComponentProps } from 'svelte'
  import BaseDialog from './BaseDialog.svelte'
  import Button from './Button.svelte'
  import Buttons from './Buttons.svelte'
  import type { SizeInput } from '$lib/size-scale'

  interface Props {
    title: string
    message: string
    confirmLabel: string
    closeLabel?: string
    className?: string
    widthVariant?: ComponentProps<typeof BaseDialog>['widthVariant']
    heightVariant?: ComponentProps<typeof BaseDialog>['heightVariant']
    /** Panel footprint shorthand (`size` on `BaseDialog`). */
    size?: ComponentProps<typeof BaseDialog>['size']
    /** The confirm button's scale, distinct from the panel `size`. */
    buttonSize?: SizeInput
    // The confirm button's accent, derived from `Button` so the union can't drift.
    accent?: ComponentProps<typeof Button>['accent']
    pending?: boolean
    confirmOnDismiss?: boolean
    onConfirm: () => void
    onCancel?: () => void
  }

  let {
    title,
    message,
    confirmLabel,
    closeLabel,
    className = '',
    widthVariant,
    heightVariant,
    size,
    buttonSize = 'md',
    accent = 'rose',
    pending = false,
    confirmOnDismiss = false,
    onConfirm,
    onCancel,
  }: Props = $props()

  const resolvedCancel = $derived(confirmOnDismiss ? onConfirm : (onCancel ?? onConfirm))
</script>

{#snippet confirmFooter()}
  <Buttons align="right">
    <Button variant="primary" {accent} {pending} size={buttonSize} onClick={onConfirm}>
      {confirmLabel}
    </Button>
  </Buttons>
{/snippet}

<BaseDialog {title} {className} {widthVariant} {heightVariant} {size} {closeLabel} dismissDisabled={pending} onCancel={resolvedCancel} footer={confirmFooter}>
  <p class="text-sm leading-6 text-slate-400">{message}</p>
</BaseDialog>
