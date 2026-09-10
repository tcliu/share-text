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
  import { getI18nContext } from '$lib/i18n.svelte'
  const i18n = getI18nContext()

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
            label: i18n.t('admin.import.singleDocument'),
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
            label: i18n.t('admin.import.multipleDocuments'),
            json: `[
  { "name": "Report", "content": "Draft", "documentType": "text" },
  { "name": "Data", "content": "{\\"a\\": 1}", "documentType": "json", "isPublic": false }
]`,
          },
        }
      : {
          single: {
            label: i18n.t('admin.import.singleUser'),
            json: `{
  "username": "alice",
  "email": "alice@example.com",
  "password": "s3cret",
  "status": "active"
}`,
          },
          multiple: {
            label: i18n.t('admin.import.multipleUsers'),
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
      toast.error(i18n.t('admin.import.fileReadFailed'))
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
      toast.error(
        error instanceof Error
          ? i18n.t('admin.import.invalidJsonWith', { error: error.message })
          : i18n.t('admin.import.invalidJson'),
      )
      return
    }
    let records: unknown[]
    if (Array.isArray(parsed)) {
      if (parsed.length === 0) {
        toast.error(i18n.t('admin.import.noRecords'))
        return
      }
      records = parsed
    } else if (typeof parsed === 'object' && parsed !== null) {
      records = [parsed]
    } else {
      toast.error(i18n.t('admin.import.mustBeObject'))
      return
    }
    onImport(records)
  }
</script>

<BaseDialog
  title={kind === 'documents' ? i18n.t('admin.import.documentsTitle') : i18n.t('admin.import.usersTitle')}
  maxWidth="3xl"
  onCancel={onClose}
  {pending}>
  <div class="flex min-h-0 flex-col gap-4">
    <div class="flex min-h-0 flex-col gap-1">
      <div class="flex items-start justify-between gap-3">
        <p class="text-sm text-slate-400">
          {i18n.t('admin.import.description', {
            kind: kind === 'documents' ? i18n.t('admin.kind.document') : i18n.t('admin.kind.user'),
          })}
        </p>
        <div class="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            ariaLabel={i18n.t('admin.import.uploadAria')}
            tooltip={i18n.t('editor.upload')}
            disabled={pending}
            onClick={handleUpload}>
            {#snippet icon()}
              <UploadIcon />
            {/snippet}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            ariaLabel={i18n.t('admin.import.showSamples')}
            tooltip={i18n.t('admin.import.showSamples')}
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
          editorAriaLabel={i18n.t('admin.import.contentAria')} />
      </div>
    </div>
    <Buttons align="right">
      {#snippet children()}
        <Button variant="primary" accent="cyan" onClick={handleOk} {pending}>{i18n.t('common.ok')}</Button>
        <Button variant="outline" onClick={handleReset} disabled={!content || pending}>{i18n.t('common.reset')}</Button>
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
  <BaseDialog title={i18n.t('admin.import.samples')} maxWidth="2xl" onCancel={() => (samplesOpen = false)}>
    <div class="flex min-h-0 flex-col gap-4">
      <p class="text-sm text-slate-400">
        {i18n.t('admin.import.samplesHint')}
      </p>
      <Tabs
        tabs={[
          { label: i18n.t('admin.import.single'), path: 'single', content: singleSample },
          { label: i18n.t('admin.import.multiple'), path: 'multiple', content: multipleSample },
        ]}
        state={{}}
        ariaLabel={i18n.t('admin.import.sampleTypes')}
        class="bg-slate-950" />
    </div>
  </BaseDialog>
{/if}

{#snippet sampleCard(sample: { label: string; json: string })}
  <Copyable
    copyText={sample.json}
    copyAriaLabel={i18n.t('admin.import.copySampleAria', { name: sample.label })}
    copyTooltip={i18n.t('admin.import.copySample')}
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
