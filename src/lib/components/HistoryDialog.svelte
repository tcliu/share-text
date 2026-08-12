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
      loadError = error instanceof Error ? error.message : 'Failed to load version history'
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
      toast.error(error instanceof Error ? error.message : 'Failed to load version')
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
    title="Version History"
    maxWidth="3xl"
    fullscreen={isMobile}
    onCancel={onClose}
    dismissKeydownCapture={!restorePromptOpen}>
    <div class="flex min-h-0 flex-col gap-3">
      <p class="text-xs text-slate-500">
        Saved versions of this document, newest first. Restoring copies the selected version back into the editor for
        review.
      </p>

      <div class="flex items-center gap-1">
        <Button
          size="sm"
          ariaLabel="Compare with current"
          tooltip={actionsDisabled ? undefined : 'Compare with current'}
          tooltipAlign="right"
          variant={compare ? 'outline' : 'secondary'}
          ariaPressed={compare}
          disabled={actionsDisabled}
          onClick={toggleCompare}>
          {#snippet icon()}
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
              <rect x="3" y="4" width="6.5" height="12" rx="1.5" />
              <rect x="10.5" y="4" width="6.5" height="12" rx="1.5" />
            </svg>
          {/snippet}
        </Button>
        <Button
          size="sm"
          ariaLabel="Restore version"
          tooltip={actionsDisabled ? undefined : 'Restore'}
          tooltipAlign="right"
          variant="primary"
          accent="cyan"
          disabled={actionsDisabled}
          onClick={requestRestore}>
          {#snippet icon()}
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 15 3.75 9.75 9 4.5" />
              <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 9.75H13.5a3.75 3.75 0 0 1 0 7.5H12" />
            </svg>
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
                class="rounded-lg border px-3 py-2 text-left transition {selected?.id === version.id
                  ? 'border-cyan-500/60 bg-cyan-500/10'
                  : 'border-slate-700 bg-slate-950 hover:border-slate-500'}"
                onclick={() => selectVersion(version)}>
                <div class="text-xs font-medium text-slate-200">{formatTimestamp(version.createdAt)}</div>
                <div class="mt-0.5 truncate text-xs text-slate-500">
                  {version.updatedBy} · {version.contentSize} chars
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
                <div class="grid flex-1 gap-2 md:grid-cols-2">
                  <div class="flex min-h-40 flex-col gap-1.5">
                    <div class="truncate text-xs font-medium text-slate-500">
                      Selected · {formatTimestamp(selected.createdAt)}
                    </div>
                    <span
                      class="w-fit rounded-full border border-slate-700 bg-slate-950 px-2 py-0.5 text-xs text-slate-400">
                      {selected.documentType}
                    </span>
                    <pre
                      class="max-h-[70vh] flex-1 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-slate-700 bg-slate-950 p-3 font-mono text-xs leading-5 text-slate-300">{selected.content ||
                        '(empty)'}</pre>
                  </div>
                  <div class="flex min-h-40 flex-col gap-1.5">
                    <div class="truncate text-xs font-medium text-slate-500">Current</div>
                    <span
                      class="w-fit rounded-full border border-slate-700 bg-slate-950 px-2 py-0.5 text-xs text-slate-400">
                      {currentType}
                    </span>
                    <pre
                      class="max-h-[70vh] flex-1 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-slate-700 bg-slate-950 p-3 font-mono text-xs leading-5 text-slate-300">{currentContent ||
                        '(empty)'}</pre>
                  </div>
                </div>
              {:else}
                <pre
                  class="max-h-[70vh] flex-1 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-slate-700 bg-slate-950 p-3 font-mono text-xs leading-5 text-slate-300">{selected.content ||
                    '(empty)'}</pre>
              {/if}
            {:else}
              <div class="flex flex-1 items-center justify-center text-sm text-slate-500">
                Select a version to view it
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
    title="Restore this version?"
    message="Restoring will replace the current editor content with this version's content. Any unsaved changes will be lost."
    confirmLabel="Restore"
    confirmColor="cyan"
    onConfirm={confirmRestore}
    onCancel={cancelRestore} />
{/if}
