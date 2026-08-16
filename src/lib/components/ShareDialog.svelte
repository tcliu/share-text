<script lang="ts">
  import { tick } from 'svelte'
  import type { User } from '$lib/documents'
  import { searchUsers, fetchRecentSharees } from '$lib/user-auth'
  import BaseDialog from './BaseDialog.svelte'
  import Buttons from './Buttons.svelte'
  import Button from './Button.svelte'
  import Checkbox from './Checkbox.svelte'
  import ConfirmDialog from './ConfirmDialog.svelte'
  import FormField from './FormField.svelte'
  import ShareeCombobox from './ShareeCombobox.svelte'
  import { useCaretAtEndOnKeyboardFocus } from './use-caret-at-end-on-keyboard-focus.svelte'
  import { arraysEqualUnordered } from '$lib/array-utils'
  import { t } from '$lib/i18n.svelte'

  interface Props {
    open: boolean
    isPublic: boolean
    sharedWith: User[]
    currentUser?: User
    isAdmin?: boolean
    pending?: boolean
    onClose: () => void
    onApply: (input: { isPublic: boolean; sharedWith: string[] }) => void
  }

  let { open, isPublic, sharedWith, currentUser, isAdmin = false, pending = false, onClose, onApply }: Props = $props()

  let draftIsPublic = $state(false)
  let draftSharees = $state<string[]>([])
  let comboboxRef = $state<ReturnType<typeof ShareeCombobox> | null>(null)
  let discardPromptOpen = $state(false)
  let recentUsersPromise: Promise<User[]> | null = null

  $effect(() => {
    if (!open) return
    tick().then(() => comboboxRef?.focus())
  })

  $effect(() => {
    if (open) {
      draftIsPublic = isPublic
      draftSharees = sharedWith.map(user => user.username)
    }
  })

  // Normal users get suggestions from their previously-shared active users;
  // the fetch is cached per dialog open so the component's seed-on-mount
  // search('') and subsequent query searches share one load.
  function recentShareesSearch(query: string): Promise<User[]> {
    const normalized = query.trim().toLowerCase()
    recentUsersPromise ??= fetchRecentSharees()
    return recentUsersPromise.then(users =>
      users.filter(user => {
        if (user.username === currentUser?.username) {
          return false
        }
        if (!normalized) {
          return true
        }
        return user.username.toLowerCase().startsWith(normalized) || user.email.toLowerCase().includes(normalized)
      }),
    )
  }

  const dirty = $derived(
    draftIsPublic !== isPublic ||
      !arraysEqualUnordered(
        draftSharees,
        sharedWith.map(user => user.username),
      ),
  )

  function handleReset() {
    draftIsPublic = isPublic
    draftSharees = sharedWith.map(user => user.username)
  }

  function handleApply() {
    onApply({ isPublic: draftIsPublic, sharedWith: draftSharees })
  }

  function handleCancelRequest() {
    if (discardPromptOpen) {
      return
    }
    if (dirty) {
      discardPromptOpen = true
      return
    }
    onClose()
  }

  function handleDiscard() {
    discardPromptOpen = false
    onClose()
  }
</script>

{#if open}
  <BaseDialog
    title={t('share.title')}
    maxWidth="lg"
    onCancel={handleCancelRequest}
    dismissKeydownCapture={!discardPromptOpen}
    {pending}>
    <div class="flex flex-col gap-4" use:useCaretAtEndOnKeyboardFocus>
      <Checkbox bind:checked={draftIsPublic} name="isPublic" label={t('share.anyoneWithLink')} />

      <FormField label={t('share.sharedWith')} htmlFor="share-user-input">
        <ShareeCombobox
          bind:this={comboboxRef}
          bind:selected={draftSharees}
          search={isAdmin ? searchUsers : recentShareesSearch}
          id="share-user-input"
          placeholder={t('share.addByUsernameOrEmail')}
          selfUsername={isAdmin ? undefined : currentUser?.username}
          seedOnMount={!isAdmin}
          searchOnEmpty={!isAdmin}
          debounceMs={isAdmin ? 250 : 0} />
      </FormField>

      <Buttons>
        {#snippet children()}
          <Button variant="primary" accent="cyan" onClick={handleApply} disabled={!dirty} {pending}>{t('common.ok')}</Button>
          <Button variant="outline" onClick={handleReset} disabled={!dirty}>{t('common.reset')}</Button>
        {/snippet}
      </Buttons>
    </div>
  </BaseDialog>
{/if}

{#if discardPromptOpen}
  <ConfirmDialog
    title={t('share.discardTitle')}
    message={t('share.discardMessage')}
    confirmLabel={t('share.discard')}
    onConfirm={handleDiscard}
    onCancel={() => (discardPromptOpen = false)} />
{/if}
