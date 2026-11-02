<script lang="ts">
  import { tick } from 'svelte'
  import FormDialog from '@codepg/ui-lib/components/FormDialog.svelte'
  import FormField from '@codepg/ui-lib/components/FormField.svelte'
  import TagInput from '@codepg/ui-lib/components/TagInput.svelte'
  import { caretAtEndOnKeyboardFocus } from '@codepg/ui-lib/actions/caret-at-end-on-keyboard-focus'
  import {
    getDefaultTagColor,
    isTagColor,
    nextTagColor,
    pickTagColor,
    sameColorFamily,
    tagChipClass,
    tagChipStyle,
    tagDotStyle,
    type Tag,
  } from '$lib/tag-colors'
  import { getI18nContext } from '$lib/i18n.svelte'
  const i18n = getI18nContext()

  interface Props {
    open: boolean
    tags: Tag[]
    availableTags: Tag[]
    onClose: () => void
    onSave: (tags: Tag[]) => void
  }

  let { open, tags, availableTags, onClose, onSave }: Props = $props()

  function normalizeTag(tag: Tag): Tag {
    return {
      name: tag.name,
      color: isTagColor(tag.color) ? tag.color : getDefaultTagColor(tag.name),
    }
  }

  let draftTags = $state<Tag[]>([])
  let tagInputRef = $state<ReturnType<typeof TagInput> | null>(null)

  $effect(() => {
    if (!open) return
    tick().then(() => tagInputRef?.focus())
  })

  $effect(() => {
    if (open) {
      draftTags = tags.map(normalizeTag)
    }
  })

  const normalizedSourceTags = $derived(tags.map(normalizeTag))
  const tagNames = $derived(draftTags.map(tag => tag.name))
  const availableTagNames = $derived(availableTags.map(tag => tag.name))

  // The colour a tag carries: its own in the draft, else the colour it
  // already has in the library (the colour it would get if added), else the
  // default the server would assign.
  function colorFor(name: string): string {
    const draft = draftTags.find(tag => tag.name === name)
    if (draft) return draft.color
    const available = availableTags.find(tag => tag.name.toLowerCase() === name.toLowerCase())
    return available?.color ?? getDefaultTagColor(name)
  }

  function handleTagsChange(next: string[]): void {
    const previous = new Map(draftTags.map(tag => [tag.name.toLowerCase(), tag]))
    const result: Tag[] = []
    for (const name of next) {
      const existing = previous.get(name.toLowerCase())
      if (existing) {
        result.push(existing)
        continue
      }
      const available = availableTags.find(tag => tag.name.toLowerCase() === name.toLowerCase())
      const prevColor = result[result.length - 1]?.color
      let color = available?.color ?? nextTagColor(result.length)
      if (prevColor && sameColorFamily(color, prevColor)) {
        color = pickTagColor(name, [prevColor])
      }
      result.push({ name, color })
    }
    draftTags = result
  }

  function tagsEqual(a: Tag[], b: Tag[]): boolean {
    if (a.length !== b.length) return false
    const sortedA = [...a].sort((x, y) => x.name.localeCompare(y.name))
    const sortedB = [...b].sort((x, y) => x.name.localeCompare(y.name))
    return sortedA.every((tag, i) => tag.name === sortedB[i]?.name && tag.color === sortedB[i]?.color)
  }

  const dirty = $derived(!tagsEqual(draftTags, normalizedSourceTags))

  function handleReset() {
    draftTags = tags.map(normalizeTag)
  }

  function handleSave() {
    const normalized = [...draftTags].sort((a, b) => a.name.localeCompare(b.name))
    onSave(normalized)
    onClose()
  }
</script>

{#if open}
  <FormDialog
    title={i18n.t('tags.title')}
    widthVariant="lg"
    closeLabel={i18n.t('common.closeDialog')}
    saveLabel={i18n.t('common.ok')}
    resetLabel={i18n.t('common.reset')}
    discardTitle={i18n.t('tags.discardTitle')}
    discardMessage={i18n.t('tags.discardMessage')}
    discardLabel={i18n.t('tags.discard')}
    {dirty}
    confirmOnDismiss
    onSave={handleSave}
    onReset={handleReset}
    onClose={onClose}>
    <div class="flex flex-col gap-4" use:caretAtEndOnKeyboardFocus>
      <FormField label={i18n.t('tags.label')} htmlFor="document-tags-input">
        <TagInput
          bind:this={tagInputRef}
          value={tagNames}
          options={availableTagNames}
          onChange={handleTagsChange}
          placeholder={i18n.t('tags.placeholder')}
          id="document-tags-input"
          chipClass={tagChipClass()}
          chipStyle={name => tagChipStyle(colorFor(name))}
          optionDotStyle={name => tagDotStyle(colorFor(name))} />
      </FormField>
    </div>
  </FormDialog>
{/if}
