<script lang="ts">
  import type { User } from '$lib/documents'
  import { searchUsers } from '$lib/user-auth'
  import BaseDialog from './BaseDialog.svelte'
  import Buttons from './Buttons.svelte'
  import Button from './Button.svelte'
  import Checkbox from './Checkbox.svelte'
  import Chip from './Chip.svelte'
  import FormField from './FormField.svelte'
  import { tagChipClass, tagChipStyle } from '$lib/tag-colors'

  interface Props {
    open: boolean
    isPublic: boolean
    sharedWith: User[]
    pending?: boolean
    onClose: () => void
    onApply: (input: { isPublic: boolean; sharedWith: string[] }) => void
  }

  let { open, isPublic, sharedWith, pending = false, onClose, onApply }: Props = $props()

  let draftIsPublic = $state(false)
  let draftSharees = $state<string[]>([])
  let addValue = $state('')
  let suggestions = $state<User[]>([])
  let suggestionsOpen = $state(false)
  let searchTimer: ReturnType<typeof setTimeout> | null = null

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

  function handleInput() {
    suggestionsOpen = true
    if (searchTimer) {
      clearTimeout(searchTimer)
    }
    const query = addValue.trim()
    if (!query) {
      suggestions = []
      searchTimer = null
      return
    }
    searchTimer = setTimeout(() => {
      searchTimer = null
      void searchUsers(query)
        .then(users => {
          suggestions = users.filter(user => !draftSharees.includes(user.username))
        })
        .catch(() => {
          suggestions = []
        })
    }, 250)
  }

  function addSharee(value: string) {
    const normalized = value.trim()
    if (!normalized || draftSharees.includes(normalized)) {
      return
    }
    draftSharees = [...draftSharees, normalized]
    addValue = ''
    suggestions = []
    suggestionsOpen = false
  }

  function handleInputKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault()
      const first = suggestions[0]
      addSharee(first ? first.username : addValue)
    } else if (event.key === 'Escape') {
      suggestionsOpen = false
    }
  }

  function removeSharee(value: string) {
    draftSharees = draftSharees.filter(item => item !== value)
  }
</script>

{#if open}
  <BaseDialog title="Sharing" maxWidth="lg" onCancel={onClose} pending={pending}>
    <div class="flex flex-col gap-4">
      <Checkbox bind:checked={draftIsPublic} name="isPublic" label="Anyone with the link can view and edit" />

      <FormField label="Shared with" htmlFor="share-user-input">
        <input
          id="share-user-input"
          bind:value={addValue}
          type="text"
          placeholder="Add by username or email"
          oninput={handleInput}
          onkeydown={handleInputKeydown}
          onfocus={() => (suggestionsOpen = suggestions.length > 0)}
          onblur={() => setTimeout(() => (suggestionsOpen = false), 120)}
          class="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-500" />
      </FormField>

      {#if suggestionsOpen && suggestions.length > 0}
        <ul class="flex flex-col gap-1 rounded-lg border border-slate-800 bg-slate-950 p-1">
          {#each suggestions as user (user.id)}
            <li>
              <button
                type="button"
                onmousedown={event => event.preventDefault()}
                onclick={() => addSharee(user.username)}
                class="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm text-slate-200 transition hover:bg-slate-800">
                <span>{user.username}</span>
                <span class="text-xs text-slate-500">{user.email}</span>
              </button>
            </li>
          {/each}
        </ul>
      {/if}

      {#if draftSharees.length > 0}
        <div class="flex flex-wrap gap-1.5">
          {#each draftSharees as sharee (sharee)}
            <Chip
              label={sharee}
              chipClass={tagChipClass()}
              style={tagChipStyle(sharee)}
              ariaLabel={`Remove ${sharee}`}
              onRemove={() => removeSharee(sharee)} />
          {/each}
        </div>
      {/if}

      <Buttons>
        {#snippet children()}
          <Button variant="primary" accent="cyan" onClick={handleApply} disabled={!dirty} pending={pending}>OK</Button>
          <Button variant="outline" onClick={handleReset} disabled={!dirty}>Reset</Button>
        {/snippet}
      </Buttons>
    </div>
  </BaseDialog>
{/if}
