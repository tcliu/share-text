<script lang="ts">
  import { tick } from 'svelte'
  import BaseDialog from './BaseDialog.svelte'
  import Buttons from './Buttons.svelte'
  import Button from './Button.svelte'
  import ConfirmDialog from './ConfirmDialog.svelte'
  import FormField from './FormField.svelte'
  import ColorTagInput from './ColorTagInput.svelte'
  import { useCaretAtEndOnKeyboardFocus } from './use-caret-at-end-on-keyboard-focus.svelte'
  import { getDefaultTagColor, isTagColor, type Tag } from '$lib/tag-colors'
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
  let tagInputRef = $state<ReturnType<typeof ColorTagInput> | null>(null)

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
        <ColorTagInput bind:this={tagInputRef} id="document-tags-input" bind:value={draftTags} {availableTags} />
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
    onCancel={() => (discardPromptOpen = false)} />
{/if}
