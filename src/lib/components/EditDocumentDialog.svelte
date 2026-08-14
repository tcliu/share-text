<script lang="ts">
  import BaseDialog from './BaseDialog.svelte'
  import Buttons from './Buttons.svelte'
  import Button from './Button.svelte'
  import FormField from './FormField.svelte'
  import type { AdminDocumentSummary } from '$lib/admin'

  interface Props {
    document: AdminDocumentSummary
    pending?: boolean
    onSave: (input: {
      name: string
      key: string
      createdBy: string
      updatedBy: string
    }) => void
    onClose: () => void
  }

  let { document, pending = false, onSave, onClose }: Props = $props()

  let key = $state('')
  let name = $state('')
  let createdBy = $state('')
  let updatedBy = $state('')

  $effect(() => {
    key = document.id
    name = document.name
    createdBy = document.createdBy
    updatedBy = document.updatedBy
  })

  const valid = $derived(
    name.trim().length > 0 &&
      key.trim().length > 0 &&
      createdBy.trim().length > 0 &&
      updatedBy.trim().length > 0,
  )

  const dirty = $derived(
    key !== document.id ||
      name !== document.name ||
      createdBy !== document.createdBy ||
      updatedBy !== document.updatedBy,
  )

  const okDisabled = $derived(!valid || !dirty)

  function handleReset() {
    key = document.id
    name = document.name
    createdBy = document.createdBy
    updatedBy = document.updatedBy
  }

  function handleSave() {
    if (okDisabled) {
      return
    }
    onSave({
      key: key.trim(),
      name: name.trim(),
      createdBy: createdBy.trim(),
      updatedBy: updatedBy.trim(),
    })
  }
</script>

<BaseDialog title="Edit Document" maxWidth="md" onCancel={onClose} pending={pending}>
  <div class="flex flex-col gap-4">
    <FormField label="Key" htmlFor="document-key">
      <input
        id="document-key"
        bind:value={key}
        type="text"
        autocomplete="off"
        class="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-slate-100 outline-none transition focus:border-cyan-500" />
    </FormField>
    <FormField label="Name" htmlFor="document-name">
      <input
        id="document-name"
        bind:value={name}
        type="text"
        autocomplete="off"
        class="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-500" />
    </FormField>
    <FormField label="Created by" htmlFor="document-created-by">
      <input
        id="document-created-by"
        bind:value={createdBy}
        type="text"
        autocomplete="off"
        class="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-500" />
    </FormField>
    <FormField label="Updated by" htmlFor="document-updated-by">
      <input
        id="document-updated-by"
        bind:value={updatedBy}
        type="text"
        autocomplete="off"
        class="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-500" />
    </FormField>
    <Buttons>
      {#snippet children()}
        <Button variant="primary" accent="cyan" onClick={handleSave} disabled={okDisabled} pending={pending}>
          OK
        </Button>
        <Button variant="outline" onClick={handleReset} disabled={!dirty || pending}>Reset</Button>
      {/snippet}
    </Buttons>
  </div>
</BaseDialog>
