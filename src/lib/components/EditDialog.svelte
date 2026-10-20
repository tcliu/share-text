<script lang="ts">
  import type { ComponentProps, Snippet } from 'svelte'
  import BaseDialog from '$lib/components/BaseDialog.svelte'
  import Button from '$lib/components/Button.svelte'
  import Buttons from '$lib/components/Buttons.svelte'
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte'

  interface Props {
    /** Ignored when `header` is set. */
    title?: string
    /** Custom header content forwarded to BaseDialog; wins over `title`. */
    header?: Snippet
    widthVariant?: ComponentProps<typeof BaseDialog>['widthVariant']
    heightVariant?: ComponentProps<typeof BaseDialog>['heightVariant']
    size?: ComponentProps<typeof BaseDialog>['size']
    closeLabel: string
    saveLabel: string
    resetLabel: string
    discardTitle: string
    discardMessage: string
    discardLabel: string
    /** Caller-owned draft-vs-snapshot compare. Gates the discard prompt and Reset. */
    dirty: boolean
    /** Caller combines validity/domain rules; `pending` is ORed in automatically. */
    saveDisabled?: boolean
    pending?: boolean
    onSave: () => void
    onReset: () => void
    /** Final close: invoked directly when clean, or after discard is confirmed. */
    onClose: () => void
    children?: Snippet
    /** Extra footer buttons rendered before the save button. */
    actions?: Snippet
  }

  let {
    title,
    header,
    widthVariant,
    heightVariant,
    size,
    closeLabel,
    saveLabel,
    resetLabel,
    discardTitle,
    discardMessage,
    discardLabel,
    dirty,
    saveDisabled = false,
    pending = false,
    onSave,
    onReset,
    onClose,
    children,
    actions,
  }: Props = $props()

  // The footer (with the save button) is a sibling of the scrolling body, so the
  // button associates with the form by id and native implicit submission
  // (Enter in a single-line field) keeps working for multi-field drafts.
  const instanceId = $props.id()
  const formId = `edit-dialog-form-${instanceId}`

  let discardOpen = $state(false)

  function handleCancelRequest(): void {
    if (discardOpen) return
    if (dirty) {
      discardOpen = true
      return
    }
    onClose()
  }

  function handleDiscard(): void {
    discardOpen = false
    onClose()
  }

  function requestSave(): void {
    // A clean draft has nothing to persist, so the submit path (the form's
    // `onsubmit`, reached by Enter) must respect the same gate as the button.
    if (pending || saveDisabled || !dirty) return
    onSave()
  }

  function handleSubmit(event: SubmitEvent): void {
    event.preventDefault()
    requestSave()
  }
</script>

{#snippet dialogFooter()}
  <Buttons align="right">
    {@render actions?.()}
    <Button variant="primary" accent="cyan" type="submit" form={formId} disabled={pending || saveDisabled || !dirty} {pending}
      >{saveLabel}</Button>
    <Button variant="outline" type="button" disabled={pending || !dirty} onClick={onReset}>{resetLabel}</Button>
  </Buttons>
{/snippet}

<BaseDialog {title} {header} {widthVariant} {heightVariant} {size} {closeLabel} dismissDisabled={pending || discardOpen} onCancel={handleCancelRequest} footer={dialogFooter}>
  <form id={formId} class="w-full min-w-0" onsubmit={handleSubmit}>
    {@render children?.()}
  </form>
</BaseDialog>

{#if discardOpen}
  <ConfirmDialog
    title={discardTitle}
    message={discardMessage}
    confirmLabel={discardLabel}
    accent="rose"
    {closeLabel}
    onConfirm={handleDiscard}
    onCancel={() => (discardOpen = false)} />
{/if}
