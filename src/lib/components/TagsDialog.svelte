<script lang="ts">
  import { tick } from 'svelte'
  import BaseDialog from './BaseDialog.svelte'
  import Buttons from './Buttons.svelte'
  import Button from './Button.svelte'
  import Chip from './Chip.svelte'
  import ConfirmDialog from './ConfirmDialog.svelte'
  import FormField from './FormField.svelte'
  import TagInput from './TagInput.svelte'
  import { useCaretAtEndOnKeyboardFocus } from './use-caret-at-end-on-keyboard-focus.svelte'
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
  let discardPromptOpen = $state(false)
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

  function colorFor(name: string): string {
    return draftTags.find(tag => tag.name === name)?.color ?? '#00F0FF'
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

  function handleCancelRequest() {
    if (discardPromptOpen) return
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
  <BaseDialog title={i18n.t('tags.title')} maxWidth="lg" onCancel={handleCancelRequest} dismissKeydownCapture={!discardPromptOpen}>
    <div class="flex flex-col gap-4" use:useCaretAtEndOnKeyboardFocus>
      <FormField label={i18n.t('tags.label')} htmlFor="document-tags-input">
        <TagInput
          bind:this={tagInputRef}
          value={tagNames}
          availableTags={availableTagNames}
          onChange={handleTagsChange}
          placeholder={i18n.t('tags.placeholder')}
          inputId="document-tags-input">
          {#snippet chip(name, remove)}
            <Chip
              label={name}
              chipClass={tagChipClass()}
              style={tagChipStyle(colorFor(name))}
              removeButtonClass={tagRemoveBtnClass()}
              removeButtonStyle={tagRemoveBtnStyle(colorFor(name))}
              ariaLabel={i18n.t('combobox.remove', { name })}
              onRemove={remove} />
          {/snippet}
          {#snippet option(name)}
            <span class={tagDotClass()} style={tagDotStyle(colorFor(name))}></span>
            <span>{name}</span>
          {/snippet}
        </TagInput>
      </FormField>

    <Buttons align="right">
        {#snippet children()}
          <Button variant="primary" accent="cyan" onClick={handleSave} disabled={!dirty}>{i18n.t('common.ok')}</Button>
          <Button variant="outline" onClick={handleReset} disabled={!dirty}>{i18n.t('common.reset')}</Button>
        {/snippet}
      </Buttons>
    </div>
  </BaseDialog>
{/if}

{#if discardPromptOpen}
  <ConfirmDialog
    title={i18n.t('tags.discardTitle')}
    message={i18n.t('tags.discardMessage')}
    confirmLabel={i18n.t('tags.discard')}
    onConfirm={handleDiscard}
    confirmOnDismiss />
{/if}
