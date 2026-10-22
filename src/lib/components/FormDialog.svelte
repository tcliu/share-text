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
    // Omit to hide the Reset button (a create-mode form has nothing to reset
    // to).
    resetLabel?: string
    discardTitle: string
    discardMessage: string
    discardLabel: string
    // The discard confirm's own dismiss affordances: `true` performs the
    // discard (the confirm cannot be cancelled), `false` (the default) returns
    // to the form. A form that must never lose a draft silently opts in.
    confirmOnDismiss?: boolean
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
    /**
     * Replaces the built-in save/reset row with the caller's own action row.
     * The row renders inside the form, so a `type="submit"` button in it
     * submits the form like the built-in save button does.
     */
    footer?: Snippet
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
    confirmOnDismiss = false,
    dirty,
    saveDisabled = false,
    pending = false,
    onSave,
    onReset,
    onClose,
    children,
    actions,
    footer,
  }: Props = $props()

  // The footer (with the save button) is a sibling of the scrolling body, so the
  // button associates with the form by id and native implicit submission
  // (Enter in a single-line field) keeps working for multi-field drafts.
  const instanceId = $props.id()
  const formId = `form-dialog-form-${instanceId}`

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

  // The confirm's dismissal returns to the form, leaving the draft intact;
  // with `confirmOnDismiss` the dismissal performs the discard instead.
  function handleCancelDiscard(): void {
    discardOpen = false
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

{#snippet defaultFooter()}
  <Buttons align="right">
    {@render actions?.()}
    <Button variant="primary" accent="cyan" type="submit" form={formId} disabled={pending || saveDisabled || !dirty} {pending}
      >{saveLabel}</Button>
    {#if resetLabel}
      <Button variant="outline" type="button" disabled={pending || !dirty} onClick={onReset}>{resetLabel}</Button>
    {/if}
  </Buttons>
{/snippet}

<BaseDialog {title} {header} {widthVariant} {heightVariant} {size} {closeLabel} dismissDisabled={pending || discardOpen} onCancel={handleCancelRequest}>
  <!-- The action row is part of the content: the form body scrolls in its own
       area, so the row stays pinned below it. -->
  <form id={formId} class="flex min-h-0 min-w-0 flex-1 flex-col" onsubmit={handleSubmit}>
    <div class="min-h-0 flex-1 overflow-y-auto">
      {@render children?.()}
    </div>
    <div class="flex-none">
      {#if footer}
        {@render footer()}
      {:else}
        {@render defaultFooter()}
      {/if}
    </div>
  </form>
</BaseDialog>

{#if discardOpen}
  <!-- `confirmOnDismiss` makes the confirm's own dismissal perform the
       discard; without it the dismissal returns to the form with the draft
       intact. Either way the base dialog stays put until the discard is
       confirmed, so a dismissal never silently closes a dirty draft. -->
  <ConfirmDialog
    title={discardTitle}
    message={discardMessage}
    confirmLabel={discardLabel}
    accent="rose"
    {closeLabel}
    onConfirm={handleDiscard}
    onCancel={handleCancelDiscard}
    {confirmOnDismiss} />
{/if}
