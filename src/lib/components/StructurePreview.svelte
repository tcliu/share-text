<script lang="ts">
  import { parseStructured } from '$lib/document-type-utils'
  import type { PreviewProps } from '$lib/document-types'
  import StructureNode from './StructureNode.svelte'
  import { isContainer, valueClass, valueText } from './structure-value'

  let { content }: PreviewProps = $props()

  type State =
    | { status: 'loading' }
    | { status: 'error'; error: string }
    | { status: 'ok'; value?: unknown; label?: string }

  let state = $state<State>({ status: 'loading' })

  $effect(() => {
    let cancelled = false
    const text = content
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
    <StructureNode label={state.label ?? ''} value={state.value} depth={0} />
  {/if}
</div>
