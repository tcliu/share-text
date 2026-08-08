<script lang="ts">
  import { toast } from 'svelte-sonner'
  import { parseStructured } from '$lib/document-type-utils'
  import type { PreviewProps } from '$lib/document-types'
  import StructureNode from './StructureNode.svelte'
  import { detectFormat, isContainer, renameKeyAtPath, setAtPath, valueClass, valueText } from './structure-value'

  let { content, onContentChange }: PreviewProps = $props()

  type State =
    | { status: 'loading' }
    | { status: 'error'; error: string }
    | { status: 'ok'; value?: unknown; label?: string }

  let state = $state<State>({ status: 'loading' })
  let format: 'json' | 'yaml' | null = null

  $effect(() => {
    let cancelled = false
    const text = content
    format = detectFormat(text)
    parseStructured(text)
      .then(result => {
        if (cancelled) return
        if (!result.ok) {
          state = { status: 'error', error: result.error ?? 'Invalid content' }
          return
        }
        if (result.value === undefined) {
          state = { status: 'ok', value: undefined }
          return
        }
        const label = Array.isArray(result.value)
          ? `array[${result.value.length}]`
          : `object{${Object.keys(result.value as object).length}}`
        state = { status: 'ok', value: result.value, label }
      })
      .catch(error => {
        if (!cancelled) {
          state = { status: 'error', error: error instanceof Error ? error.message : 'Invalid content' }
        }
      })
    return () => {
      cancelled = true
    }
  })

  async function handleNodeChange(path: string[], newValue: unknown) {
    if (state.status !== 'ok' || state.value === undefined || !isContainer(state.value)) return
    const updated = setAtPath(state.value, path, newValue)
    if (updated === state.value) return
    const serialized = await serialize(updated)
    if (serialized === null) {
      toast.error('Failed to serialize changes')
      return
    }
    state = { status: 'ok', value: updated, label: state.label }
    onContentChange?.(serialized)
  }

  async function handleRenameKey(parentPath: string[], oldKey: string, newKey: string) {
    if (state.status !== 'ok' || state.value === undefined || !isContainer(state.value)) return
    const updated = renameKeyAtPath(state.value, parentPath, oldKey, newKey)
    if (updated === state.value) return
    const serialized = await serialize(updated)
    if (serialized === null) {
      toast.error('Failed to serialize changes')
      return
    }
    const label = Array.isArray(updated)
      ? `array[${updated.length}]`
      : `object{${Object.keys(updated as object).length}}`
    state = { status: 'ok', value: updated, label }
    onContentChange?.(serialized)
  }

  async function serialize(value: unknown): Promise<string | null> {
    if (format === null) return null
    if (format === 'json') {
      try {
        return JSON.stringify(value, null, 2)
      } catch {
        return null
      }
    }
    try {
      const { stringify } = await import('yaml')
      return stringify(value, { indent: 2, lineWidth: 0 })
    } catch {
      return null
    }
  }
</script>

<div data-testid="structure-preview" class="h-full overflow-auto p-4 text-slate-300">
  {#if state.status === 'loading'}
    <div class="text-sm text-slate-400">Loading preview…</div>
  {:else if state.status === 'error'}
    <div class="text-sm text-red-400">Unable to parse: {state.error}</div>
  {:else if state.value === undefined}
    <div class="text-sm italic text-slate-500">No content to preview</div>
  {:else if !isContainer(state.value)}
    <pre class={valueClass(state.value)}>{valueText(state.value)}</pre>
  {:else}
    <StructureNode
      label={state.label ?? ''}
      value={state.value}
      depth={0}
      onChange={onContentChange ? handleNodeChange : undefined}
      onRenameKey={onContentChange ? handleRenameKey : undefined}
    />
  {/if}
</div>
