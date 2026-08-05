<script lang="ts">
  import BaseDialog from './BaseDialog.svelte'
  import Buttons from './Buttons.svelte'
  import Button from './Button.svelte'
  import ConfirmDialog from './ConfirmDialog.svelte'
  import FormField from './FormField.svelte'
  import TagInput from './TagInput.svelte'
  import { getDefaultTagColor, isTagColor, type Tag } from '$lib/tag-colors'

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
  <BaseDialog title="Edit Tags" maxWidth="lg" onCancel={handleCancelRequest} dismissKeydownCapture={!discardPromptOpen}>
    <div class="flex flex-col gap-4">
      <FormField label="Tags" htmlFor="document-tags-input">
        <TagInput id="document-tags-input" bind:value={draftTags} {availableTags} />
      </FormField>

      <Buttons>
        {#snippet children()}
          <Button variant="primary" accent="cyan" onClick={handleSave} disabled={!dirty}>OK</Button>
          <Button variant="outline" onClick={handleReset} disabled={!dirty}>Reset</Button>
        {/snippet}
      </Buttons>
    </div>
  </BaseDialog>
{/if}

{#if discardPromptOpen}
  <ConfirmDialog
    title="Discard unsaved changes?"
    message="You have unsaved tag changes that will be lost."
    confirmLabel="Discard"
    onConfirm={handleDiscard}
    onCancel={() => (discardPromptOpen = false)} />
{/if}
