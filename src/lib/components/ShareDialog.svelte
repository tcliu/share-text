<script lang="ts">
  import { tick } from 'svelte'
  import type { User } from '$lib/documents'
  import { searchUsers, fetchRecentSharees } from '$lib/user-auth'
  import Checkbox from '@codepg/ui-lib/components/Checkbox.svelte'
  import FormDialog from '@codepg/ui-lib/components/FormDialog.svelte'
  import FormField from '@codepg/ui-lib/components/FormField.svelte'
  import ShareeCombobox from './ShareeCombobox.svelte'
  import { caretAtEndOnKeyboardFocus } from '@codepg/ui-lib/actions/caret-at-end-on-keyboard-focus'
  import { arraysEqualUnordered } from '$lib/array-utils'
  import { getI18nContext } from '$lib/i18n.svelte'
  const i18n = getI18nContext()

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
  let shareeRef = $state<ReturnType<typeof ShareeCombobox> | null>(null)
  let recentUsersPromise: Promise<User[]> | null = null

  $effect(() => {
    if (!open) return
    tick().then(() => shareeRef?.focus())
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
</script>

{#if open}
  <FormDialog
    title={i18n.t('share.title')}
    widthVariant="lg"
    closeLabel={i18n.t('common.closeDialog')}
    saveLabel={i18n.t('common.ok')}
    resetLabel={i18n.t('common.reset')}
    discardTitle={i18n.t('share.discardTitle')}
    discardMessage={i18n.t('share.discardMessage')}
    discardLabel={i18n.t('share.discard')}
    {dirty}
    confirmOnDismiss
    {pending}
    onSave={handleApply}
    onReset={handleReset}
    onClose={onClose}>
    <div class="flex flex-col gap-4" use:caretAtEndOnKeyboardFocus>
      <Checkbox bind:checked={draftIsPublic} name="isPublic" label={i18n.t('share.anyoneWithLink')} />

      <FormField label={i18n.t('share.sharedWith')} htmlFor="share-user-input">
        <ShareeCombobox
          bind:this={shareeRef}
          bind:selected={draftSharees}
          search={isAdmin ? searchUsers : recentShareesSearch}
          id="share-user-input"
          placeholder={i18n.t('share.addByUsernameOrEmail')}
          selfUsername={isAdmin ? undefined : currentUser?.username}
          seedOnMount={!isAdmin}
          searchOnEmpty={!isAdmin}
          debounceMs={isAdmin ? 250 : 0} />
      </FormField>
    </div>
  </FormDialog>
{/if}
