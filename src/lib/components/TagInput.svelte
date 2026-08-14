<script lang="ts">
  import Combobox, { type ComboboxOption } from './Combobox.svelte'
  import Chip from './Chip.svelte'
  import {
    nextTagColor,
    pickTagColor,
    sameColorFamily,
    tagChipClass,
    tagChipStyle,
    tagDotClass,
    tagDotStyle,
    tagRemoveBtnClass,
    tagRemoveBtnStyle,
    type Tag,
  } from '$lib/tag-colors'

  interface Props {
    value: Tag[]
    availableTags: Tag[]
    id?: string
    placeholder?: string
  }

  let { value = $bindable([] as Tag[]), availableTags, id, placeholder = 'Select or type tags...' }: Props = $props()

  let inputQuery = $state('')

  const tagOptions = $derived(value.map(tag => ({ value: tag.name, label: tag.name })))

  const filteredTags = $derived.by(() => {
    const query = inputQuery.trim().toLowerCase()
    return availableTags
      .filter(
        tag =>
          !value.some(existing => existing.name.toLowerCase() === tag.name.toLowerCase()) &&
          (!query || tag.name.toLowerCase().includes(query)),
      )
      .map(tag => ({ value: tag.name, label: tag.name }))
  })

  function colorFor(name: string): string {
    return value.find(tag => tag.name === name)?.color ?? '#00F0FF'
  }

  function normalizeName(name: string) {
    return name.trim().toLowerCase()
  }

  function hasTag(name: string) {
    const key = normalizeName(name)
    return value.some(existing => normalizeName(existing.name) === key)
  }

  function findAvailable(name: string): Tag | undefined {
    const key = normalizeName(name)
    return availableTags.find(tag => normalizeName(tag.name) === key)
  }

  function addTagValue(tagName: string) {
    const name = tagName.trim()
    if (!name || hasTag(name)) {
      return
    }
    const existing = findAvailable(name)
    const prevColor = value[value.length - 1]?.color
    let color = existing?.color ?? nextTagColor(value.length)
    if (prevColor && sameColorFamily(color, prevColor)) {
      color = pickTagColor(name, [prevColor])
    }
    value = [...value, { name, color }]
  }

  function removeTag(name: string) {
    const key = normalizeName(name)
    value = value.filter(existing => normalizeName(existing.name) !== key)
  }
</script>

<Combobox
  {id}
  {placeholder}
  selected={tagOptions}
  suggestions={filteredTags}
  onQueryChange={query => (inputQuery = query)}
  onAdd={item => addTagValue(item.value)}
  onRemove={removeTag}>
  {#snippet chip(item: ComboboxOption, remove: (name: string) => void)}
    <Chip
      label={item.label}
      chipClass={tagChipClass()}
      style={tagChipStyle(colorFor(item.value))}
      removeButtonClass={tagRemoveBtnClass()}
      removeButtonStyle={tagRemoveBtnStyle(colorFor(item.value))}
      ariaLabel={`Remove ${item.label}`}
      onRemove={() => remove(item.value)} />
  {/snippet}
  {#snippet option(tag: ComboboxOption)}
    <span class={tagDotClass()} style={tagDotStyle(colorFor(tag.value))}></span>
    <span>{tag.label}</span>
  {/snippet}
</Combobox>
