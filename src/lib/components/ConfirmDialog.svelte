<script lang="ts">
  import BaseDialog from './BaseDialog.svelte'
  import Buttons from './Buttons.svelte'
  import Button from './Button.svelte'

  interface Props {
    title: string
    message: string
    confirmLabel: string
    cancelLabel?: string
    className?: string
    maxWidth?: 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | 'fit'
    confirmColor?: 'rose' | 'amber' | 'emerald' | 'cyan'
    dismissKeydownCapture?: boolean
    onConfirm: () => void
    onCancel: () => void
  }

  let {
    title,
    message,
    confirmLabel,
    cancelLabel = 'Cancel',
    className = '',
    maxWidth = 'md',
    confirmColor = 'rose',
    dismissKeydownCapture = false,
    onConfirm,
    onCancel,
  }: Props = $props()
</script>

<BaseDialog {title} {className} {maxWidth} {onCancel} {dismissKeydownCapture}>
  <div class="flex flex-col gap-4">
    <p class="text-sm leading-6 text-slate-400">{message}</p>
    <Buttons>
      {#snippet children()}
        <Button variant="primary" accent={confirmColor} onClick={onConfirm}>
          {confirmLabel}
        </Button>
        <Button onClick={onCancel}>{cancelLabel}</Button>
      {/snippet}
    </Buttons>
  </div>
</BaseDialog>
