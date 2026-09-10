<script lang="ts">
  import BaseDialog from './BaseDialog.svelte'
  import Buttons from './Buttons.svelte'
  import Button from './Button.svelte'

  interface Props {
    title: string
    message: string
    confirmLabel: string
    className?: string
    maxWidth?: 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | 'fit'
    confirmColor?: 'rose' | 'amber' | 'emerald' | 'cyan'
    pending?: boolean
    dismissKeydownCapture?: boolean
    onConfirm: () => void
    onCancel: () => void
  }

  let {
    title,
    message,
    confirmLabel,
    className = '',
    maxWidth = 'md',
    confirmColor = 'rose',
    pending = false,
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
        <Button variant="primary" accent={confirmColor} {pending} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      {/snippet}
    </Buttons>
  </div>
</BaseDialog>
