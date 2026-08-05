<script lang="ts">
  import Chip from './Chip.svelte'
  import { positionPanel } from '$lib/position-panel.svelte'
  import {
    getDefaultTagColor,
    isTagColor,
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

  let inputValue = $state('')
  let activeIndex = $state(0)
  let dropdownOpen = $state(false)
  let navigated = $state(false)
  let removedNames = $state<Set<string>>(new Set())
  let closeTimer: ReturnType<typeof setTimeout> | null = null
  let internalUpdate = false
  let containerRef = $state<HTMLDivElement | null>(null)

  $effect(() => {
    void value
    if (internalUpdate) {
      internalUpdate = false
      return
    }
    inputValue = ''
    activeIndex = 0
    dropdownOpen = false
    navigated = false
    removedNames = new Set()
  })

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
      inputValue = ''
      return
    }
    const existing = findAvailable(name)
    const prevColor = value[value.length - 1]?.color
    let color = existing?.color ?? nextTagColor(value.length)
    if (prevColor && sameColorFamily(color, prevColor)) {
      color = pickTagColor(name, [prevColor])
    }
    internalUpdate = true
    value = [...value, { name, color }]
    inputValue = ''
    activeIndex = 0
    navigated = false
  }

  function removeTag(name: string) {
    const key = normalizeName(name)
    removedNames = new Set(removedNames).add(key)
    internalUpdate = true
    value = value.filter(existing => normalizeName(existing.name) !== key)
  }

  const filteredTags = $derived.by(() => {
    const query = inputValue.trim().toLowerCase()
    return availableTags.filter(
      tag =>
        !hasTag(tag.name) &&
        !removedNames.has(normalizeName(tag.name)) &&
        (!query || tag.name.toLowerCase().includes(query)),
    )
  })

  function confirmTag() {
    const tagValue = inputValue.trim()
    if (!tagValue) return
    const match = filteredTags.find(tag => normalizeName(tag.name) === normalizeName(tagValue))
    if (match) {
      addTagValue(match.name)
    } else {
      addTagValue(tagValue)
    }
  }

  function handleInputFocus() {
    if (closeTimer) {
      clearTimeout(closeTimer)
      closeTimer = null
    }
    dropdownOpen = true
  }

  function handleInputBlur() {
    if (inputValue.trim()) {
      confirmTag()
    }
    if (closeTimer) clearTimeout(closeTimer)
    closeTimer = setTimeout(() => {
      dropdownOpen = false
      closeTimer = null
    }, 120)
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Backspace' && !inputValue && value.length > 0) {
      removeTag(value[value.length - 1].name)
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      navigated = true
      if (filteredTags.length > 0) {
        activeIndex = (activeIndex + 1) % filteredTags.length
      }
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      navigated = true
      if (filteredTags.length > 0) {
        activeIndex = (activeIndex - 1 + filteredTags.length) % filteredTags.length
      }
      return
    }

    if (event.key === 'Enter') {
      if (!inputValue.trim()) return
      event.preventDefault()
      if (navigated && filteredTags[activeIndex]) {
        addTagValue(filteredTags[activeIndex].name)
        return
      }
      confirmTag()
      return
    }

    if (event.key === 'Escape') {
      event.stopPropagation()
      inputValue = ''
      activeIndex = 0
      dropdownOpen = false
    }
  }
</script>

<div class="flex flex-col gap-1.5">
  <div
    bind:this={containerRef}
    class="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 transition focus-within:border-cyan-500">
    <div class="flex flex-wrap items-center gap-2">
      {#each value as tag (tag.name)}
        <Chip
          label={tag.name}
          chipClass={tagChipClass()}
          style={tagChipStyle(tag.color)}
          removeButtonClass={tagRemoveBtnClass()}
          removeButtonStyle={tagRemoveBtnStyle(tag.color)}
          ariaLabel={`Remove ${tag.name}`}
          onRemove={() => removeTag(tag.name)} />
      {/each}
      <input
        {id}
        bind:value={inputValue}
        type="text"
        class="min-w-0 flex-1 bg-transparent py-1 text-sm text-slate-100 outline-none placeholder:text-slate-500"
        placeholder={value.length === 0 ? placeholder : ''}
        autocomplete="off"
        data-escape-capture={(dropdownOpen || inputValue.trim()) ? true : undefined}
        onfocus={handleInputFocus}
        onblur={handleInputBlur}
        oninput={() => {
          navigated = false
          activeIndex = 0
        }}
        onkeydown={handleKeydown} />
    </div>
  </div>
  {#if dropdownOpen && filteredTags.length > 0}
    <div
      id="document-tags-options"
      role="listbox"
      use:positionPanel={() => ({ getTrigger: () => containerRef, getOpen: () => dropdownOpen })}
      data-escape-capture
      class="fixed left-0 top-0 z-50 w-64 will-change-transform max-h-52 overflow-y-auto rounded-lg border border-slate-700 bg-slate-900/95 p-1 shadow-2xl shadow-slate-950/60 backdrop-blur">
      {#each filteredTags as tag, index (tag.name)}
        <button
          type="button"
          role="option"
          aria-selected={index === activeIndex}
          class={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition ${index === activeIndex ? 'bg-slate-800 text-cyan-200' : 'text-slate-300 hover:bg-slate-800 hover:text-cyan-200'}`}
          onmousedown={e => e.preventDefault()}
          onmouseenter={() => {
            activeIndex = index
            navigated = true
          }}
          onclick={() => addTagValue(tag.name)}>
          <span class={tagDotClass()} style={tagDotStyle(tag.color)}></span>
          <span>{tag.name}</span>
        </button>
      {/each}
    </div>
  {/if}
</div>
