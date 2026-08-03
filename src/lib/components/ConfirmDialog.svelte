<script lang="ts">
  import BaseDialog from './BaseDialog.svelte'
  import DialogActions from './DialogActions.svelte'
  import Button from './Button.svelte'

  interface Props {
    title: string
    message: string
    confirmLabel: string
    cancelLabel?: string
    badgeColor?: 'rose' | 'emerald' | 'cyan' | 'violet' | 'amber'
    badgeLabel?: string
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
    badgeColor = 'rose',
    badgeLabel = 'Confirm',
    confirmColor = 'rose',
    dismissKeydownCapture = false,
    onConfirm,
    onCancel,
  }: Props = $props()
</script>

<BaseDialog {badgeColor} {badgeLabel} {title} {onCancel} {dismissKeydownCapture}>
  <p class="mt-3 text-sm leading-6 text-slate-400">{message}</p>
  <DialogActions>
    {#snippet children()}
      <Button variant="primary" accent={confirmColor} onClick={onConfirm}>
        {confirmLabel}
      </Button>
      <Button onClick={onCancel}>{cancelLabel}</Button>
    {/snippet}
  </DialogActions>
</BaseDialog>
