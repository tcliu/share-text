<script lang="ts">
  import { onMount } from 'svelte'
  import Chip from '@codepg/ui-lib/components/Chip.svelte'
  import TagInput from '@codepg/ui-lib/components/TagInput.svelte'
  import { getDefaultTagColor, tagChipClass, tagChipStyle, tagRemoveBtnClass, tagRemoveBtnStyle } from '#lib/tag-colors.js'
  import type { User } from '#lib/documents.js'

  interface Props {
    selected?: string[]
    search: (query: string) => Promise<User[]>
    id?: string
    placeholder?: string
    selfUsername?: string
    chipTooltip?: (username: string) => string | undefined
    seedOnMount?: boolean
    searchOnEmpty?: boolean
    debounceMs?: number
  }

  let {
    selected = $bindable([] as string[]),
    search,
    id,
    placeholder = 'Add by username or email',
    selfUsername,
    chipTooltip,
    seedOnMount = false,
    searchOnEmpty = false,
    debounceMs = 250,
  }: Props = $props()

  let suggestionUsers = $state<User[]>([])
  let searchTimer: ReturnType<typeof setTimeout> | null = null
  let tagInputRef = $state<ReturnType<typeof TagInput> | null>(null)

  // Object options map to string[] at this boundary; the caller-side
  // lookup below restores each suggestion's email for the option rows.
  const availableNames = $derived(suggestionUsers.map(user => user.username))
  const emailByUsername = $derived(
    new Map(suggestionUsers.map(user => [user.username.toLowerCase(), user.email])),
  )

  export function focus() {
    tagInputRef?.focus()
  }

  onMount(() => {
    if (seedOnMount) {
      void refreshSuggestions('')
    }
  })

  async function refreshSuggestions(query: string) {
    try {
      const users = await search(query)
      suggestionUsers = users.filter(
        user => !selected.some(name => name.toLowerCase() === user.username.toLowerCase()),
      )
    } catch {
      suggestionUsers = []
    }
  }

  // An empty query clears suggestions without a request unless the provider
  // wants to re-list its suggestions on empty (the Share dialog's recent
  // sharees). `debounceMs === 0` disables the debounce for that same instant
  // local filtering; directory searches debounce.
  function handleQueryChange(query: string) {
    if (searchTimer) {
      clearTimeout(searchTimer)
    }
    if (!query.trim() && !searchOnEmpty) {
      suggestionUsers = []
      return
    }
    if (debounceMs === 0) {
      void refreshSuggestions(query)
      return
    }
    searchTimer = setTimeout(() => {
      searchTimer = null
      void refreshSuggestions(query)
    }, debounceMs)
  }

  // TagInput reports the whole next value; re-apply the sharee invariants
  // (non-empty, not self, case-insensitive dedupe) so a typed draft can
  // never commit a name `addSharee` would have rejected.
  function handleChange(next: string[]): void {
    const kept = new Set(selected.map(name => name.toLowerCase()))
    const result: string[] = []
    for (const name of next) {
      const normalized = name.trim()
      const lower = normalized.toLowerCase()
      if (!normalized || result.some(existing => existing.toLowerCase() === lower)) continue
      if (kept.has(lower)) {
        result.push(selected.find(existing => existing.toLowerCase() === lower) ?? normalized)
        continue
      }
      if (selfUsername && lower === selfUsername.toLowerCase()) continue
      result.push(normalized)
    }
    selected = result
    suggestionUsers = suggestionUsers.filter(
      user => !selected.some(name => name.toLowerCase() === user.username.toLowerCase()),
    )
  }
</script>

<TagInput
  bind:this={tagInputRef}
  value={selected}
  options={availableNames}
  onChange={handleChange}
  onQueryChange={handleQueryChange}
  {placeholder}
  id={id}>
  {#snippet chip(username: string, remove: () => void)}
    {@const color = getDefaultTagColor(username)}
    <Chip
      label={username}
      chipClass={tagChipClass()}
      style={tagChipStyle(color)}
      tooltip={chipTooltip?.(username)}
      removable
      removeButtonClass={tagRemoveBtnClass()}
      removeButtonStyle={tagRemoveBtnStyle(color)}
      onRemove={remove} />
  {/snippet}
  {#snippet option(username: string)}
    <span class="flex w-full items-center justify-between gap-2">
      <span>{username}</span>
      {#if emailByUsername.get(username.toLowerCase())}
        <span class="text-xs text-slate-400">{emailByUsername.get(username.toLowerCase())}</span>
      {/if}
    </span>
  {/snippet}
</TagInput>
