<script lang="ts">
  import { onMount, tick } from 'svelte'
  import BaseDialog from './BaseDialog.svelte'
  import Buttons from './Buttons.svelte'
  import Button from './Button.svelte'
  import ConfirmDialog from './ConfirmDialog.svelte'
  import FormField from './FormField.svelte'
  import LazyCodeEditor from './LazyCodeEditor.svelte'
  import SelectDropdown from './SelectDropdown.svelte'
  import Checkbox from './Checkbox.svelte'
  import ShareeCombobox from './ShareeCombobox.svelte'
  import { useCaretAtEndOnKeyboardFocus } from './use-caret-at-end-on-keyboard-focus.svelte'
  import { DOCUMENT_TYPE_VALUES, getDocumentType } from '$lib/document-types'
  import type { AdminDocumentSummary, AdminSharee } from '$lib/admin'
  import { searchUsers } from '$lib/user-auth'
  import { arraysEqualUnordered } from '$lib/array-utils'
  import { getI18nContext } from '$lib/i18n.svelte'
  const i18n = getI18nContext()

  interface Props {
    mode?: 'add' | 'edit'
    document?: AdminDocumentSummary | null
    content: string
    contentLoading?: boolean
    contentFailed?: boolean
    sharedWith?: AdminSharee[]
    pending?: boolean
    onSave: (input: {
      name: string
      documentType: string
      content: string
      key?: string
      createdBy?: string
      updatedBy?: string
      isPublic?: boolean
      sharedWith?: string[]
    }) => void
    onClose: () => void
  }

  let {
    mode = 'edit',
    document,
    content: loadedContent,
    contentLoading = false,
    contentFailed = false,
    sharedWith = [],
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
  let isPublic = $state(true)
  let discardPromptOpen = $state(false)
  let nameInput = $state<HTMLInputElement | null>(null)
  let draftSharees = $state<string[]>([])
  let lastConsumedShareeNames: string[] | null = null

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
    isPublic = document?.isPublic ?? true
  })

  $effect(() => {
    content = loadedContent
  })

  const typeOptions = $derived(DOCUMENT_TYPE_VALUES.map(value => ({ value, label: getDocumentType(value).label })))

  const shareeByUsername = $derived(new Map(sharedWith.map(user => [user.username, user])))

  function shareeTooltip(username: string) {
    const sharee = shareeByUsername.get(username)
    return sharee ? (sharee.status === 'inactive' ? `${sharee.email} — ${i18n.t('admin.inactive')}` : sharee.email) : undefined
  }

  // Mirror the loaded share list into the editable draft exactly once per
  // load (the sharees arrive with the content fetch), so a later prop change
  // can never clobber an in-progress edit. The guard compares by content, not
  // reference, so it stays correct even if the prop is a fresh array each
  // render.
  $effect(() => {
    if (contentLoading) return
    const names = sharedWith.map(user => user.username)
    if (lastConsumedShareeNames !== null && arraysEqualUnordered(lastConsumedShareeNames, names)) return
    lastConsumedShareeNames = names
    draftSharees = names
  })

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
          isPublic !== (document?.isPublic ?? true) ||
          content !== loadedContent ||
          !arraysEqualUnordered(
            draftSharees,
            sharedWith.map(user => user.username),
          ),
  )

  const okDisabled = $derived(!valid || !dirty || contentLoading || contentFailed)

  function handleReset() {
    key = document?.id ?? ''
    name = document?.name ?? ''
    createdBy = document?.createdBy ?? ''
    updatedBy = document?.updatedBy ?? ''
    documentType = document?.documentType ?? 'text'
    content = loadedContent
    isPublic = document?.isPublic ?? true
    draftSharees = sharedWith.map(user => user.username)
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
      isPublic,
      content,
      sharedWith: draftSharees,
    })
  }
</script>

{#snippet detailsPane()}
  <div class="flex flex-col gap-4" use:useCaretAtEndOnKeyboardFocus>
    {#if mode === 'edit'}
      <FormField label={i18n.t('admin.documents.key')} htmlFor="document-key">
        <input
          id="document-key"
          bind:value={key}
          type="text"
          autocomplete="off"
          class="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-slate-100 outline-none transition focus:border-cyan-500" />
      </FormField>
    {/if}
    <FormField label={i18n.t('admin.documents.name')} htmlFor="document-name">
      <input
        id="document-name"
        bind:this={nameInput}
        bind:value={name}
        type="text"
        autocomplete="off"
        class="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-500" />
    </FormField>
    <FormField label={i18n.t('editor.documentType')}>
      <SelectDropdown
        buttonLabel={getDocumentType(documentType).label}
        options={typeOptions}
        activeValue={documentType}
        ariaLabel={i18n.t('editor.documentType')}
        filterable={true}
        onSelect={value => (documentType = value)} />
    </FormField>
    {#if mode === 'edit'}
      <FormField label={i18n.t('admin.documents.createdBy')} htmlFor="document-created-by">
        <input
          id="document-created-by"
          bind:value={createdBy}
          type="text"
          autocomplete="off"
          class="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-500" />
      </FormField>
      <FormField label={i18n.t('admin.documents.updatedBy')} htmlFor="document-updated-by">
        <input
          id="document-updated-by"
          bind:value={updatedBy}
          type="text"
          autocomplete="off"
          class="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-500" />
      </FormField>
      <Checkbox bind:checked={isPublic} name="isPublic" label={i18n.t('share.anyoneWithLink')} />
      <FormField label={i18n.t('share.sharedWith')} htmlFor="document-shared-with">
        {#if contentLoading}
          <p class="text-sm text-slate-500">{i18n.t('admin.dialog.shareListLoading')}</p>
        {:else if contentFailed}
          <p class="text-sm text-rose-300">{i18n.t('admin.dialog.shareListFailed')}</p>
        {:else}
          <ShareeCombobox
            bind:selected={draftSharees}
            search={searchUsers}
            id="document-shared-with"
            placeholder={i18n.t('share.addByUsernameOrEmail')}
            chipTooltip={shareeTooltip} />
        {/if}
      </FormField>
    {/if}
  </div>
{/snippet}

{#snippet contentPane()}
  <div class="flex h-[45vh] min-h-[16rem] flex-col overflow-hidden rounded-lg">
    {#if contentLoading}
      <div
        class="flex h-full items-center justify-center rounded-lg border border-slate-700 bg-slate-950 text-sm text-slate-400">
        {i18n.t('admin.dialog.loadingContent')}
      </div>
    {:else if contentFailed}
      <div
        class="flex h-full items-center justify-center rounded-lg border border-rose-500/40 bg-slate-950 text-sm text-rose-300">
        {i18n.t('admin.dialog.contentFailed')}
      </div>
    {:else}
      <LazyCodeEditor
        bind:content
        docType={documentType}
        recreateKey={mode === 'edit' && document ? document.id : 'add'}
        containerClass="h-full"
        editorClass="h-full rounded-lg border border-slate-700 bg-slate-950"
        editorAriaLabel={i18n.t('admin.dialog.documentContent')} />
    {/if}
  </div>
{/snippet}

<BaseDialog
  title={mode === 'add' ? i18n.t('admin.dialog.addDocument') : i18n.t('admin.dialog.editDocument')}
  maxWidth="3xl"
  onCancel={handleCancelRequest}
  dismissKeydownCapture={!discardPromptOpen}
  {pending}>
  <div class="flex min-h-0 flex-1 flex-col gap-4">
    <div class="min-h-0 flex-1 overflow-y-auto">
      <div class="flex flex-wrap items-start gap-4">
        <section aria-label={i18n.t('admin.dialog.details')} class="flex min-w-[20rem] flex-1 flex-col gap-4">
          {@render detailsPane()}
        </section>
        <section aria-label={i18n.t('admin.dialog.content')} class="flex min-w-[20rem] flex-1 flex-col gap-2">
          <h2 class="text-sm font-semibold text-slate-300">{i18n.t('admin.dialog.content')}</h2>
          {@render contentPane()}
        </section>
      </div>
    </div>
    <Buttons>
      {#snippet children()}
        <Button variant="primary" accent="cyan" onClick={handleSave} disabled={okDisabled} {pending}>
          {mode === 'add' ? i18n.t('admin.dialog.create') : i18n.t('common.ok')}
        </Button>
        {#if mode === 'edit'}
          <Button variant="outline" onClick={handleReset} disabled={!dirty || pending}>{i18n.t('common.reset')}</Button>
        {/if}
      {/snippet}
    </Buttons>
  </div>
</BaseDialog>

{#if discardPromptOpen}
  <ConfirmDialog
    title={i18n.t('admin.dialog.discardTitle')}
    message={i18n.t('admin.dialog.discardDocument')}
    confirmLabel={i18n.t('admin.discard')}
    onConfirm={handleDiscard}
    onCancel={() => (discardPromptOpen = false)} />
{/if}
