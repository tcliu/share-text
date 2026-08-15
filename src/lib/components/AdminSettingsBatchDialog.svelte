<script lang="ts">
  import { toast } from 'svelte-sonner'
  import BaseDialog from './BaseDialog.svelte'
  import Buttons from './Buttons.svelte'
  import Button from './Button.svelte'
  import ConfirmDialog from './ConfirmDialog.svelte'
  import LazyCodeEditor from './LazyCodeEditor.svelte'
  import UploadIcon from '$lib/icons/UploadIcon.svelte'
  import { serializeProperties } from '$lib/document-type-utils'
  import type { useAdminSettings } from '$lib/use-admin-settings.svelte'

  interface Props {
    settingsState: ReturnType<typeof useAdminSettings>
  }

  let { settingsState }: Props = $props()

  function initialContent() {
    const record = Object.fromEntries(
      settingsState.settings.map(setting => [setting.key, String(setting.value)]),
    )
    return serializeProperties(record)
  }

  let content = $state(initialContent())
  let fileInput = $state<HTMLInputElement | null>(null)
  let discardPromptOpen = $state(false)

  const dirty = $derived(content !== initialContent())

  function handleUpload() {
    fileInput?.click()
  }

  async function handleFileChange(event: Event) {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) {
      return
    }
    try {
      content = await file.text()
    } catch {
      toast.error('Failed to read the selected file')
    } finally {
      input.value = ''
    }
  }

  function handleReset() {
    content = initialContent()
  }

  function handleApply() {
    void settingsState.submitBatch(content)
  }

  function handleCancelRequest() {
    if (discardPromptOpen) {
      return
    }
    if (dirty) {
      discardPromptOpen = true
      return
    }
    settingsState.closeBatch()
  }

  function handleDiscard() {
    discardPromptOpen = false
    settingsState.closeBatch()
  }
</script>

<BaseDialog
  title="Batch update settings"
  maxWidth="3xl"
  onCancel={handleCancelRequest}
  dismissKeydownCapture={!discardPromptOpen}
  pending={settingsState.batchPending}>
  <div class="flex min-h-0 flex-col gap-4">
    <div class="flex min-h-0 flex-col gap-1">
      <div class="flex items-start justify-between gap-3">
        <p class="text-sm text-slate-400">
          Enter settings as key=value lines, one per line. Numeric values are validated against their setting's own
          rule (whole number within the allowed range); string settings accept any value. The update is all-or-nothing
          and any invalid value rejects the whole update. Keys you omit keep their current value.
        </p>
        <div class="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            ariaLabel="Upload a properties file"
            tooltip="Upload"
            disabled={settingsState.batchPending}
            onClick={handleUpload}>
            {#snippet icon()}
              <UploadIcon />
            {/snippet}
          </Button>
        </div>
      </div>
      <div class="flex h-[45vh] min-h-[16rem] flex-col overflow-hidden rounded-lg">
        <LazyCodeEditor
          bind:content
          docType="properties"
          autoFocus
          containerClass="h-full"
          editorClass="h-full rounded-lg border border-slate-700 bg-slate-950"
          editorAriaLabel="Settings properties content" />
      </div>
    </div>
    <Buttons>
      {#snippet children()}
        <Button
          variant="primary"
          accent="cyan"
          onClick={handleApply}
          disabled={!dirty}
          pending={settingsState.batchPending}>
          Apply
        </Button>
        <Button variant="outline" onClick={handleReset} disabled={!dirty || settingsState.batchPending}>Reset</Button>
      {/snippet}
    </Buttons>
    <input
      bind:this={fileInput}
      class="hidden"
      type="file"
      accept=".properties,text/x-java-properties"
      onchange={handleFileChange} />
  </div>
</BaseDialog>

{#if discardPromptOpen}
  <ConfirmDialog
    title="Discard unsaved changes?"
    message="You have unsaved changes to these settings that will be lost."
    confirmLabel="Discard"
    onConfirm={handleDiscard}
    onCancel={() => (discardPromptOpen = false)} />
{/if}
