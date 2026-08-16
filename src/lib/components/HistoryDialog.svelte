<script lang="ts">
  import { toast } from 'svelte-sonner'
  import BaseDialog from './BaseDialog.svelte'
  import Button from './Button.svelte'
  import ConfirmDialog from './ConfirmDialog.svelte'
  import Spinner from './Spinner.svelte'
  import {
    fetchDocumentVersion,
    fetchDocumentVersions,
    type DocumentVersion,
    type DocumentVersionSummary,
  } from '$lib/documents'
  import { formatTimestamp } from '$lib/date-format'
  import { buildSideBySideRows } from '$lib/version-diff'
  import CompareIcon from '$lib/icons/CompareIcon.svelte'
  import RestoreIcon from '$lib/icons/RestoreIcon.svelte'
  import { t } from '$lib/i18n.svelte'

  interface Props {
    open: boolean
    documentId: string
    currentContent: string
    currentType: string
    hasUnsavedChanges: boolean
    isMobile?: boolean
    onClose: () => void
    onRestore: (version: DocumentVersion) => void
  }

  let {
    open,
    documentId,
    currentContent,
    currentType,
    hasUnsavedChanges,
    isMobile = false,
    onClose,
    onRestore,
  }: Props = $props()

  let versions = $state<DocumentVersionSummary[]>([])
  let loading = $state(false)
  let loadError = $state('')
  let selected = $state<DocumentVersion | null>(null)
  let selectedLoading = $state(false)
  let selectSeq = 0
  let compare = $state(false)
  let restorePromptOpen = $state(false)
  let pendingRestore = $state<DocumentVersion | null>(null)
  let diffLib = $state<typeof import('diff') | null>(null)

  const selectedMatchesCurrent = $derived(
    selected !== null && selected.content === currentContent && selected.documentType === currentType,
  )

  // The action panel stays visible to keep the dialog height fixed across
  // versions and states. Buttons are disabled whenever there is nothing to act
  // on — no version selected yet, a version still loading, or the selected
  // version already matches the current state — so Restore can never act on a
  // stale version while a newer selection is loading, and the panel never
  // resizes when switching versions.
  const actionsDisabled = $derived(selected === null || selectedLoading || selectedMatchesCurrent)

  // The diff library is lazy-loaded so it never enters the initial bundle; the
  // import starts when the dialog opens so Compare rarely waits on it.
  $effect(() => {
    if (!open) return
    let cancelled = false
    import('diff').then(module => {
      if (!cancelled) diffLib = module
    })
    return () => {
      cancelled = true
    }
  })

  const diffRows = $derived.by(() => {
    if (!compare || !selected || !diffLib) return null
    return buildSideBySideRows(selected.content, currentContent, diffLib)
  })

  $effect(() => {
    if (!open) return
    selected = null
    compare = false
    loadVersions()
  })

  // A version identical to the current document state has nothing to compare
  // or restore, so collapse an active split when one is selected.
  $effect(() => {
    if (compare && selectedMatchesCurrent) {
      compare = false
    }
  })

  async function loadVersions() {
    loading = true
    loadError = ''
    try {
      versions = await fetchDocumentVersions(documentId)
      if (versions.length > 0) {
        void selectVersion(versions[0])
      }
    } catch (error) {
      loadError = error instanceof Error ? error.message : t('history.toast.loadFailed')
    } finally {
      loading = false
    }
  }

  async function selectVersion(summary: DocumentVersionSummary) {
    if (selected?.id === summary.id) return
    // Stale responses are dropped: a fast A->B click must not let A's slower
    // fetch overwrite the newer B selection.
    const seq = ++selectSeq
    selectedLoading = true
    try {
      const version = await fetchDocumentVersion(documentId, summary.id)
      if (seq !== selectSeq) return
      if (version) {
        selected = version
      }
    } catch (error) {
      if (seq !== selectSeq) return
      toast.error(error instanceof Error ? error.message : t('history.toast.versionFailed'))
    } finally {
      if (seq === selectSeq) {
        selectedLoading = false
      }
    }
  }

  function toggleCompare() {
    if (actionsDisabled) return
    compare = !compare
  }

  function requestRestore() {
    if (!selected || actionsDisabled) return
    if (hasUnsavedChanges) {
      pendingRestore = selected
      restorePromptOpen = true
      return
    }
    onRestore(selected)
  }

  function confirmRestore() {
    restorePromptOpen = false
    if (pendingRestore) {
      onRestore(pendingRestore)
      pendingRestore = null
    }
  }

  function cancelRestore() {
    restorePromptOpen = false
    pendingRestore = null
  }
</script>

{#if open}
  <BaseDialog
    title={t('history.title')}
    maxWidth="3xl"
    fullscreen={isMobile}
    onCancel={onClose}
    dismissKeydownCapture={!restorePromptOpen}>
    <div class="flex min-h-0 flex-col gap-3">
      <p class="text-xs text-slate-400">
        {t('history.description')}
      </p>

      <div class="flex items-center gap-1">
        <Button
          size="sm"
          ariaLabel={t('history.compareWithCurrent')}
          tooltip={actionsDisabled ? undefined : t('history.compareWithCurrent')}
          tooltipAlign="right"
          variant={compare ? 'outline' : 'secondary'}
          ariaPressed={compare}
          disabled={actionsDisabled}
          onClick={toggleCompare}>
          {#snippet icon()}
            <CompareIcon />
          {/snippet}
        </Button>
        <Button
          size="sm"
          ariaLabel={t('history.restoreVersion')}
          tooltip={actionsDisabled ? undefined : t('history.restore')}
          tooltipAlign="right"
          variant="primary"
          accent="cyan"
          disabled={actionsDisabled}
          onClick={requestRestore}>
          {#snippet icon()}
            <RestoreIcon />
          {/snippet}
        </Button>
      </div>

      {#if loading}
        <div class="flex h-[60vh] min-h-0 items-center justify-center">
          <Spinner className="h-6 w-6" />
        </div>
      {:else if loadError}
        <div class="text-sm text-rose-400">{loadError}</div>
      {:else}
        <div class="flex min-h-0 flex-col gap-3 md:h-[60vh] md:flex-row">
          <div class="flex max-h-[70vh] flex-col gap-1 overflow-y-auto pr-1 md:w-56 md:shrink-0">
            {#each versions as version (version.id)}
              <button
                type="button"
                aria-pressed={selected?.id === version.id}
                class="rounded-lg border px-3 py-2 text-left outline-none transition {selected?.id === version.id
                  ? 'border-cyan-500/60 bg-cyan-500/10'
                  : 'border-slate-700 bg-slate-950 hover:border-slate-500 focus:border-slate-500'}"
                onclick={() => selectVersion(version)}>
                <div class="text-xs font-medium text-slate-200">{formatTimestamp(version.createdAt)}</div>
                <div class="mt-0.5 truncate text-xs text-slate-400">
                  {version.updatedBy} · {t('history.chars', { count: version.contentSize })}
                </div>
              </button>
            {/each}
          </div>
          <div
            data-testid="history-content-pane"
            class="flex h-[60vh] min-h-0 min-w-0 flex-1 flex-col gap-2 md:h-full">
            {#if selectedLoading}
              <div class="flex flex-1 items-center justify-center">
                <Spinner className="h-6 w-6" />
              </div>
            {:else if selected}
              {#if !compare}
                <div class="flex items-center gap-2">
                  <span class="rounded-full border border-slate-700 bg-slate-950 px-2 py-0.5 text-xs text-slate-400">
                    {selected.documentType}
                  </span>
                </div>
              {/if}
              {#if compare}
                <div class="flex min-h-0 flex-1 flex-col gap-1.5">
                  <div class="grid grid-cols-2 gap-2">
                    <div class="flex min-w-0 items-center gap-2">
                      <span class="truncate text-xs font-medium text-slate-400">
                        {t('history.selected')} · {formatTimestamp(selected.createdAt)}
                      </span>
                      <span
                        class="rounded-full border border-slate-700 bg-slate-950 px-2 py-0.5 text-xs text-slate-400">
                        {selected.documentType}
                      </span>
                    </div>
                    <div class="flex min-w-0 items-center gap-2">
                      <span class="text-xs font-medium text-slate-400">{t('history.current')}</span>
                      <span
                        class="rounded-full border border-slate-700 bg-slate-950 px-2 py-0.5 text-xs text-slate-400">
                        {currentType}
                      </span>
                    </div>
                  </div>
                  {#if diffRows}
                    <div
                      data-testid="history-diff"
                      class="grid max-h-[70vh] min-w-0 flex-1 grid-cols-2 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-slate-700 bg-slate-950 font-mono text-xs leading-5">
                      {#each diffRows as row}
                        <div
                          class="min-h-5 min-w-0 border-r border-slate-800 px-3 py-0.5 {row.leftKind === 'removed'
                            ? 'bg-rose-500/10 text-rose-300'
                            : row.leftKind === 'context'
                              ? 'text-slate-300'
                              : ''}"><span class="inline-block w-3 shrink-0 select-none">{row.leftKind ===
                            'removed'
                            ? '-'
                            : ''}</span>{row.left}</div>
                        <div
                          class="min-h-5 min-w-0 px-3 py-0.5 {row.rightKind === 'added'
                            ? 'bg-emerald-500/10 text-emerald-300'
                            : row.rightKind === 'context'
                              ? 'text-slate-300'
                              : ''}"><span class="inline-block w-3 shrink-0 select-none">{row.rightKind ===
                            'added'
                            ? '+'
                            : ''}</span>{row.right}</div>
                      {/each}
                    </div>
                  {:else}
                    <div class="flex flex-1 items-center justify-center">
                      <Spinner className="h-6 w-6" />
                    </div>
                  {/if}
                </div>
              {:else}
                <pre
                  class="max-h-[70vh] flex-1 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-slate-700 bg-slate-950 p-3 font-mono text-xs leading-5">{selected.content ||
                    t('history.empty')}</pre>
              {/if}
            {:else}
              <div class="flex flex-1 items-center justify-center text-sm text-slate-400">
                {t('history.selectVersion')}
              </div>
            {/if}
          </div>
        </div>
      {/if}
    </div>
  </BaseDialog>
{/if}

{#if restorePromptOpen}
  <ConfirmDialog
    title={t('history.restoreTitle')}
    message={t('history.restoreMessage')}
    confirmLabel={t('history.restore')}
    confirmColor="cyan"
    onConfirm={confirmRestore}
    onCancel={cancelRestore} />
{/if}
