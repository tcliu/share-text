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
    onClose: () => void
    onRestore: (version: DocumentVersion) => void
  }

  let {
    open,
    documentId,
    currentContent,
    currentType,
    hasUnsavedChanges,
    onClose,
    onRestore,
  }: Props = $props()

  let versions = $state<DocumentVersionSummary[]>([])
  let loading = $state(false)
  let loadError = $state('')
  let selected = $state<DocumentVersion | null>(null)
  let selectedLoading = $state(false)
  let compare = $state(false)
  let restorePromptOpen = $state(false)
  let pendingRestore = $state<DocumentVersion | null>(null)

  const selectedMatchesCurrent = $derived(
    selected !== null && selected.content === currentContent && selected.documentType === currentType,
  )

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
    selectedLoading = true
    try {
      const version = await fetchDocumentVersion(documentId, summary.id)
      if (version) {
        selected = version
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load version')
    } finally {
      selectedLoading = false
    }
  }

  function toggleCompare() {
    compare = !compare
  }

  function requestRestore() {
    if (!selected) return
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
  <BaseDialog title="Version History" maxWidth="3xl" onCancel={onClose} dismissKeydownCapture={!restorePromptOpen}>
    <div class="flex flex-col gap-3">
      <p class="text-xs text-slate-500">
        Saved versions of this document, newest first. Restoring copies the selected version back into the editor for
        review.
      </p>

      {#if selected && !selectedLoading && !selectedMatchesCurrent}
        <div class="flex items-center gap-1">
          <Button
            size="sm"
            ariaLabel="Compare with current"
            tooltip="Compare with current"
            tooltipAlign="right"
            variant={compare ? 'outline' : 'secondary'}
            ariaPressed={compare}
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
            tooltip="Restore"
            tooltipAlign="right"
            variant="primary"
            accent="cyan"
            onClick={requestRestore}>
            {#snippet icon()}
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 15 3.75 9.75 9 4.5" />
                <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 9.75H13.5a3.75 3.75 0 0 1 0 7.5H12" />
              </svg>
            {/snippet}
          </Button>
        </div>
      {/if}

      {#if loading}
        <div class="flex h-40 items-center justify-center">
          <Spinner className="h-6 w-6" />
        </div>
      {:else if loadError}
        <div class="text-sm text-rose-400">{loadError}</div>
      {:else}
        <div class="flex flex-col gap-3 md:flex-row">
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
          <div class="flex min-h-[55vh] min-w-0 flex-1 flex-col gap-2">
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
                    <span class="w-fit rounded-full border border-slate-700 bg-slate-950 px-2 py-0.5 text-xs text-slate-400">
                      {selected.documentType}
                    </span>
                    <pre
                      class="max-h-[70vh] flex-1 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-slate-700 bg-slate-950 p-3 font-mono text-xs leading-5 text-slate-300">{selected.content ||
                        '(empty)'}</pre>
                  </div>
                  <div class="flex min-h-40 flex-col gap-1.5">
                    <div class="truncate text-xs font-medium text-slate-500">Current</div>
                    <span class="w-fit rounded-full border border-slate-700 bg-slate-950 px-2 py-0.5 text-xs text-slate-400">
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
