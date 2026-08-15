<script lang="ts">
  import { tick } from 'svelte'
  import type { User } from '$lib/documents'
  import { searchUsers } from '$lib/user-auth'
  import BaseDialog from './BaseDialog.svelte'
  import Buttons from './Buttons.svelte'
  import Button from './Button.svelte'
  import Checkbox from './Checkbox.svelte'
  import Chip from './Chip.svelte'
  import Combobox, { type ComboboxOption } from './Combobox.svelte'
  import FormField from './FormField.svelte'
  import { tagChipClass, tagChipStyle } from '$lib/tag-colors'

  interface Props {
    open: boolean
    isPublic: boolean
    sharedWith: User[]
    currentUser?: User
    pending?: boolean
    onClose: () => void
    onApply: (input: { isPublic: boolean; sharedWith: string[] }) => void
  }

  let { open, isPublic, sharedWith, currentUser, pending = false, onClose, onApply }: Props = $props()

  let draftIsPublic = $state(false)
  let draftSharees = $state<string[]>([])
  let userSuggestions = $state<ComboboxOption[]>([])
  let searchTimer: ReturnType<typeof setTimeout> | null = null
  let comboboxRef = $state<ReturnType<typeof Combobox> | null>(null)

  $effect(() => {
    if (!open) return
    tick().then(() => comboboxRef?.focus())
  })

  const shareeOptions = $derived(draftSharees.map(username => ({ value: username, label: username })))

  $effect(() => {
    if (open) {
      draftIsPublic = isPublic
      draftSharees = sharedWith.map(user => user.username)
    }
  })

  function shareesEqual(a: string[], b: string[]) {
    if (a.length !== b.length) return false
    const sortedA = [...a].sort()
    const sortedB = [...b].sort()
    return sortedA.every((value, i) => value === sortedB[i])
  }

  const dirty = $derived(
    draftIsPublic !== isPublic || !shareesEqual(draftSharees, sharedWith.map(user => user.username)),
  )

  function handleReset() {
    draftIsPublic = isPublic
    draftSharees = sharedWith.map(user => user.username)
  }

  function handleApply() {
    onApply({ isPublic: draftIsPublic, sharedWith: draftSharees })
  }

  function handleQueryChange(query: string) {
    if (searchTimer) {
      clearTimeout(searchTimer)
    }
    if (!query.trim()) {
      userSuggestions = []
      searchTimer = null
      return
    }
    searchTimer = setTimeout(() => {
      searchTimer = null
      void searchUsers(query.trim())
        .then(users => {
          userSuggestions = users
            .filter(
              user =>
                user.username !== currentUser?.username && !draftSharees.includes(user.username),
            )
            .map(user => ({ value: user.username, label: user.username, detail: user.email }))
        })
        .catch(() => {
          userSuggestions = []
        })
    }, 250)
  }

  function addSharee(username: string) {
    const normalized = username.trim()
    const isSelf = currentUser
      ? normalized.toLowerCase() === currentUser.username.toLowerCase()
      : false
    if (!normalized || isSelf || draftSharees.includes(normalized)) {
      return
    }
    draftSharees = [...draftSharees, normalized]
    userSuggestions = []
  }

  function removeSharee(username: string) {
    draftSharees = draftSharees.filter(value => value !== username)
  }
</script>

{#if open}
  <BaseDialog title="Sharing" maxWidth="lg" onCancel={onClose} pending={pending}>
    <div class="flex flex-col gap-4">
      <Checkbox bind:checked={draftIsPublic} name="isPublic" label="Anyone with the link can view" />

      <FormField label="Shared with" htmlFor="share-user-input">
        <Combobox
          bind:this={comboboxRef}
          id="share-user-input"
          selected={shareeOptions}
          suggestions={userSuggestions}
          placeholder="Add by username or email"
          onQueryChange={handleQueryChange}
          onAdd={item => addSharee(item.value)}
          onRemove={removeSharee}>
          {#snippet chip(item: ComboboxOption, remove: (username: string) => void)}
            <Chip
              label={item.label}
              chipClass={tagChipClass()}
              style={tagChipStyle(item.value)}
              ariaLabel={`Remove ${item.label}`}
              onRemove={() => remove(item.value)} />
          {/snippet}
        </Combobox>
      </FormField>

      <Buttons>
        {#snippet children()}
          <Button variant="primary" accent="cyan" onClick={handleApply} disabled={!dirty} pending={pending}>OK</Button>
          <Button variant="outline" onClick={handleReset} disabled={!dirty}>Reset</Button>
        {/snippet}
      </Buttons>
    </div>
  </BaseDialog>
{/if}
