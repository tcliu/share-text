<script lang="ts">
  import { toast } from 'svelte-sonner'
  import BaseDialog from './BaseDialog.svelte'
  import Buttons from './Buttons.svelte'
  import Button from './Button.svelte'
  import Copyable from './Copyable.svelte'
  import LazyCodeEditor from './LazyCodeEditor.svelte'
  import Tabs from './Tabs.svelte'
  import HelpIcon from '$lib/icons/HelpIcon.svelte'
  import UploadIcon from '$lib/icons/UploadIcon.svelte'

  interface Props {
    kind: 'documents' | 'users'
    pending?: boolean
    onImport: (records: unknown[]) => void
    onClose: () => void
  }

  let { kind, pending = false, onImport, onClose }: Props = $props()

  let content = $state('')
  let fileInput = $state<HTMLInputElement | null>(null)
  let samplesOpen = $state(false)

  const samples = $derived(
    kind === 'documents'
      ? {
          single: {
            label: 'Single document',
            json: `{
  "key": "abc123",
  "name": "Meeting notes",
  "content": "# Agenda\\n- Sync on Q3 goals",
  "documentType": "markdown",
  "tags": [{ "name": "work", "color": "#00F0FF" }],
  "isPublic": true
}`,
          },
          multiple: {
            label: 'Multiple documents',
            json: `[
  { "name": "Report", "content": "Draft", "documentType": "text" },
  { "name": "Data", "content": "{\\"a\\": 1}", "documentType": "json", "isPublic": false }
]`,
          },
        }
      : {
          single: {
            label: 'Single user',
            json: `{
  "username": "alice",
  "email": "alice@example.com",
  "password": "s3cret",
  "status": "active"
}`,
          },
          multiple: {
            label: 'Multiple users',
            json: `[
  { "username": "alice", "email": "alice@example.com", "password": "s3cret" },
  { "username": "bob", "email": "bob@example.com", "password": "s3cret", "status": "inactive" }
]`,
          },
        },
  )

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
    content = ''
  }

  function handleOk() {
    if (pending) {
      return
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(content)
    } catch (error) {
      toast.error(error instanceof Error ? `Invalid JSON: ${error.message}` : 'Invalid JSON')
      return
    }
    let records: unknown[]
    if (Array.isArray(parsed)) {
      if (parsed.length === 0) {
        toast.error('No records to import')
        return
      }
      records = parsed
    } else if (typeof parsed === 'object' && parsed !== null) {
      records = [parsed]
    } else {
      toast.error('JSON must be an object or an array of objects')
      return
    }
    onImport(records)
  }
</script>

<BaseDialog
  title={kind === 'documents' ? 'Import Documents' : 'Import Users'}
  maxWidth="3xl"
  onCancel={onClose}
  {pending}>
  <div class="flex min-h-0 flex-col gap-4">
    <div class="flex min-h-0 flex-col gap-1">
      <div class="flex items-start justify-between gap-3">
        <p class="text-sm text-slate-400">
          Enter a JSON object (single {kind === 'documents' ? 'document' : 'user'}) or an array of objects. The import
          is all-or-nothing: any invalid record rejects the entire import.
        </p>
        <div class="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            ariaLabel="Upload a JSON file"
            tooltip="Upload"
            disabled={pending}
            onClick={handleUpload}>
            {#snippet icon()}
              <UploadIcon />
            {/snippet}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            ariaLabel="Show import samples"
            tooltip="Show samples"
            onClick={() => (samplesOpen = true)}>
            {#snippet icon()}
              <HelpIcon />
            {/snippet}
          </Button>
        </div>
      </div>
      <div class="flex h-[45vh] min-h-[16rem] flex-col overflow-hidden rounded-lg">
        <LazyCodeEditor
          bind:content
          docType="json"
          autoFocus
          containerClass="h-full"
          editorClass="h-full rounded-lg border border-slate-700 bg-slate-950"
          editorAriaLabel="JSON import content" />
      </div>
    </div>
    <Buttons>
      {#snippet children()}
        <Button variant="primary" accent="cyan" onClick={handleOk} {pending}>OK</Button>
        <Button variant="outline" onClick={handleReset} disabled={!content || pending}>Reset</Button>
      {/snippet}
    </Buttons>
    <input
      bind:this={fileInput}
      class="hidden"
      type="file"
      accept=".json,application/json"
      onchange={handleFileChange} />
  </div>
</BaseDialog>

{#if samplesOpen}
  <BaseDialog title="Import samples" maxWidth="2xl" onCancel={() => (samplesOpen = false)}>
    <div class="flex min-h-0 flex-col gap-4">
      <p class="text-sm text-slate-400">
        Copy a sample below and paste it into the editor, then adjust it to your data.
      </p>
      <Tabs
        tabs={[
          { label: 'Single', path: 'single', content: singleSample },
          { label: 'Multiple', path: 'multiple', content: multipleSample },
        ]}
        state={{}}
        ariaLabel="Import sample types" />
    </div>
  </BaseDialog>
{/if}

{#snippet sampleCard(sample: { label: string; json: string })}
  <Copyable
    copyText={sample.json}
    copyAriaLabel={`Copy ${sample.label} sample`}
    copyTooltip="Copy sample"
    copyPosition="top-right"
    containerClass="overflow-hidden rounded-lg border border-slate-700 bg-slate-950">
    <pre
      class="max-h-64 min-w-0 flex-1 overflow-auto whitespace-pre-wrap p-3 font-mono text-xs leading-relaxed text-slate-300">{sample.json}</pre>
  </Copyable>
{/snippet}

{#snippet singleSample()}
  {@render sampleCard(samples.single)}
{/snippet}

{#snippet multipleSample()}
  {@render sampleCard(samples.multiple)}
{/snippet}
