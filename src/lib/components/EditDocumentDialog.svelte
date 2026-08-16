<script lang="ts">
  import { onMount, tick } from 'svelte'
  import BaseDialog from './BaseDialog.svelte'
  import Buttons from './Buttons.svelte'
  import Button from './Button.svelte'
  import ConfirmDialog from './ConfirmDialog.svelte'
  import FormField from './FormField.svelte'
  import LazyCodeEditor from './LazyCodeEditor.svelte'
  import SelectDropdown from './SelectDropdown.svelte'
  import Tabs from './Tabs.svelte'
  import { useCaretAtEndOnKeyboardFocus } from './use-caret-at-end-on-keyboard-focus.svelte'
  import { DOCUMENT_TYPE_VALUES, getDocumentType } from '$lib/document-types'
  import type { AdminDocumentSummary } from '$lib/admin'
  import { t } from '$lib/i18n.svelte'

  interface Props {
    mode?: 'add' | 'edit'
    document?: AdminDocumentSummary | null
    content: string
    contentLoading?: boolean
    pending?: boolean
    onSave: (input: {
      name: string
      documentType: string
      content: string
      key?: string
      createdBy?: string
      updatedBy?: string
    }) => void
    onClose: () => void
  }

  let {
    mode = 'edit',
    document,
    content: loadedContent,
    contentLoading = false,
    pending = false,
    onSave,
    onClose,
  }: Props = $props()

  let key = $state('')
  let name = $state('')
  let createdBy = $state('')
  let updatedBy = $state('')
  let documentType = $state('text')
  let content = $state('')
  let discardPromptOpen = $state(false)
  let nameInput = $state<HTMLInputElement | null>(null)

  onMount(() => {
    tick().then(() => {
      if (nameInput && !name.trim()) {
        nameInput.focus()
      }
    })
  })

  $effect(() => {
    key = document?.id ?? ''
    name = document?.name ?? ''
    createdBy = document?.createdBy ?? ''
    updatedBy = document?.updatedBy ?? ''
    documentType = document?.documentType ?? 'text'
  })

  $effect(() => {
    content = loadedContent
  })

  const typeOptions = $derived(DOCUMENT_TYPE_VALUES.map(value => ({ value, label: getDocumentType(value).label })))

  const valid = $derived(
    name.trim().length > 0 &&
      (mode === 'add' || (key.trim().length > 0 && createdBy.trim().length > 0 && updatedBy.trim().length > 0)),
  )

  const dirty = $derived(
    mode === 'add'
      ? name.trim().length > 0 || documentType !== 'text' || content.length > 0
      : key !== (document?.id ?? '') ||
          name !== (document?.name ?? '') ||
          createdBy !== (document?.createdBy ?? '') ||
          updatedBy !== (document?.updatedBy ?? '') ||
          documentType !== (document?.documentType ?? 'text') ||
          content !== loadedContent,
  )

  const okDisabled = $derived(!valid || !dirty || contentLoading)

  function handleReset() {
    key = document?.id ?? ''
    name = document?.name ?? ''
    createdBy = document?.createdBy ?? ''
    updatedBy = document?.updatedBy ?? ''
    documentType = document?.documentType ?? 'text'
    content = loadedContent
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

  function handleSave() {
    if (okDisabled) {
      return
    }
    if (mode === 'add') {
      onSave({
        name: name.trim(),
        documentType,
        content,
      })
      return
    }
    onSave({
      key: key.trim(),
      name: name.trim(),
      createdBy: createdBy.trim(),
      updatedBy: updatedBy.trim(),
      documentType,
      content,
    })
  }
</script>

{#snippet detailsContent()}
  <div class="flex flex-col gap-4" use:useCaretAtEndOnKeyboardFocus>
    {#if mode === 'edit'}
      <FormField label={t('admin.documents.key')} htmlFor="document-key">
        <input
          id="document-key"
          bind:value={key}
          type="text"
          autocomplete="off"
          class="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-slate-100 outline-none transition focus:border-cyan-500" />
      </FormField>
    {/if}
    <FormField label={t('admin.documents.name')} htmlFor="document-name">
      <input
        id="document-name"
        bind:this={nameInput}
        bind:value={name}
        type="text"
        autocomplete="off"
        class="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-500" />
    </FormField>
    <FormField label={t('editor.documentType')}>
      <SelectDropdown
        buttonLabel={getDocumentType(documentType).label}
        options={typeOptions}
        activeValue={documentType}
        ariaLabel={t('editor.documentType')}
        filterable={true}
        onSelect={value => (documentType = value)} />
    </FormField>
    {#if mode === 'edit'}
      <FormField label={t('admin.documents.createdBy')} htmlFor="document-created-by">
        <input
          id="document-created-by"
          bind:value={createdBy}
          type="text"
          autocomplete="off"
          class="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-500" />
      </FormField>
      <FormField label={t('admin.documents.updatedBy')} htmlFor="document-updated-by">
        <input
          id="document-updated-by"
          bind:value={updatedBy}
          type="text"
          autocomplete="off"
          class="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-500" />
      </FormField>
    {/if}
  </div>
{/snippet}

{#snippet contentTab()}
  <div class="flex h-[45vh] min-h-[16rem] flex-col overflow-hidden rounded-lg">
    {#if contentLoading}
      <div
        class="flex h-full items-center justify-center rounded-lg border border-slate-700 bg-slate-950 text-sm text-slate-400">
        {t('admin.dialog.loadingContent')}
      </div>
    {:else}
      <LazyCodeEditor
        bind:content
        docType={documentType}
        autoFocus
        recreateKey={mode === 'edit' && document ? document.id : 'add'}
        containerClass="h-full"
        editorClass="h-full rounded-lg border border-slate-700 bg-slate-950"
        editorAriaLabel={t('admin.dialog.documentContent')} />
    {/if}
  </div>
{/snippet}

<BaseDialog
  title={mode === 'add' ? t('admin.dialog.addDocument') : t('admin.dialog.editDocument')}
  maxWidth="3xl"
  onCancel={handleCancelRequest}
  dismissKeydownCapture={!discardPromptOpen}
  {pending}>
  <div class="flex min-h-0 flex-col gap-4">
    <Tabs
      tabs={[
        { label: t('admin.dialog.details'), path: 'details', content: detailsContent },
        { label: t('admin.dialog.content'), path: 'content', content: contentTab },
      ]}
      state={{}}
      ariaLabel={t('admin.dialog.documentSections')} />
    <Buttons>
      {#snippet children()}
        <Button variant="primary" accent="cyan" onClick={handleSave} disabled={okDisabled} {pending}>
          {mode === 'add' ? t('admin.dialog.create') : t('common.ok')}
        </Button>
        {#if mode === 'edit'}
          <Button variant="outline" onClick={handleReset} disabled={!dirty || pending}>{t('common.reset')}</Button>
        {/if}
      {/snippet}
    </Buttons>
  </div>
</BaseDialog>

{#if discardPromptOpen}
  <ConfirmDialog
    title={t('admin.dialog.discardTitle')}
    message={t('admin.dialog.discardDocument')}
    confirmLabel={t('admin.discard')}
    onConfirm={handleDiscard}
    onCancel={() => (discardPromptOpen = false)} />
{/if}
