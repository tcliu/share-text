<script lang="ts">
  import { onMount } from 'svelte'
  import Chip from './Chip.svelte'
  import Combobox, { type ComboboxOption } from './Combobox.svelte'
  import { getDefaultTagColor, tagChipClass, tagChipStyle, tagRemoveBtnClass, tagRemoveBtnStyle } from '$lib/tag-colors'
  import type { User } from '$lib/documents'

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

  let userSuggestions = $state<ComboboxOption[]>([])
  let searchTimer: ReturnType<typeof setTimeout> | null = null
  let comboboxRef = $state<ReturnType<typeof Combobox> | null>(null)

  const options = $derived(selected.map(username => ({ value: username, label: username })))

  export function focus() {
    comboboxRef?.focus()
  }

  onMount(() => {
    if (seedOnMount) {
      void refreshSuggestions('')
    }
  })

  async function refreshSuggestions(query: string) {
    try {
      const users = await search(query)
      userSuggestions = users
        .filter(user => !selected.some(name => name.toLowerCase() === user.username.toLowerCase()))
        .map(user => ({ value: user.username, label: user.username, detail: user.email }))
    } catch {
      userSuggestions = []
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
      userSuggestions = []
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

  function addSharee(username: string) {
    const normalized = username.trim()
    const isSelf = selfUsername ? normalized.toLowerCase() === selfUsername.toLowerCase() : false
    if (!normalized || isSelf || selected.some(name => name.toLowerCase() === normalized.toLowerCase())) {
      return
    }
    selected = [...selected, normalized]
    userSuggestions = []
  }

  function removeSharee(username: string) {
    selected = selected.filter(value => value !== username)
  }
</script>

<Combobox
  bind:this={comboboxRef}
  {id}
  selected={options}
  suggestions={userSuggestions}
  {placeholder}
  onQueryChange={handleQueryChange}
  onAdd={item => addSharee(item.value)}
  onRemove={removeSharee}>
  {#snippet chip(item: ComboboxOption, remove: (value: string) => void)}
    {@const color = getDefaultTagColor(item.value)}
    <Chip
      label={item.label}
      chipClass={tagChipClass()}
      style={tagChipStyle(color)}
      tooltip={chipTooltip?.(item.value)}
      removeButtonClass={tagRemoveBtnClass()}
      removeButtonStyle={tagRemoveBtnStyle(color)}
      ariaLabel={`Remove ${item.label}`}
      onRemove={() => remove(item.value)} />
  {/snippet}
</Combobox>
