<script lang="ts">
  import { getI18nContext } from '$lib/i18n.svelte'
  import type CodeEditor from './CodeEditor.svelte'
  const i18n = getI18nContext()

  interface Props {
    content: string
    editable?: boolean
    docType?: string
    containerClass?: string
    editorClass?: string
    editorAriaLabel?: string
    autoFocus?: boolean
    recreateKey?: string
    maxContentLength?: number
    onReady?: () => void
    onAutoFocused?: () => void
    onContentChange?: (content: string) => void
  }

  let {
    content = $bindable(),
    editable = true,
    docType = 'text',
    containerClass = '',
    editorClass = '',
    editorAriaLabel,
    autoFocus = false,
    recreateKey = '',
    maxContentLength = 0,
    onReady,
    onAutoFocused,
    onContentChange,
  }: Props = $props()

  const resolvedAriaLabel = $derived(editorAriaLabel ?? i18n.t('editor.content'))

  // Lazy CodeEditor module: typed from the real component so the lazy boundary
  // stays cast-free.
  let EditorComponent = $state<typeof CodeEditor | null>(null)
  let editorInstance = $state<{
    focus: () => void
    getSelectionText: () => string
    getSelectionRange: () => { from: number; to: number } | null
    setSelection: (from: number, to: number) => boolean
    clearSelection: () => void
  } | null>(null)
  let loadError = $state('')

  function handleContentChange(nextContent: string) {
    content = nextContent
    onContentChange?.(nextContent)
  }

  export function focus() {
    editorInstance?.focus()
  }

  export function getSelectionText(): string {
    return editorInstance?.getSelectionText() ?? ''
  }

  export function getSelectionRange(): { from: number; to: number } | null {
    return editorInstance?.getSelectionRange() ?? null
  }

  export function setSelection(from: number, to: number): boolean {
    return editorInstance?.setSelection(from, to) ?? false
  }

  export function clearSelection() {
    editorInstance?.clearSelection()
  }

  $effect(() => {
    let cancelled = false
    import('./CodeEditor.svelte')
      .then(module => {
        if (!cancelled) {
          EditorComponent = module.default
        }
      })
      .catch(error => {
        if (!cancelled) {
          loadError = error instanceof Error ? error.message : i18n.t('editor.loadFailed')
        }
      })

    return () => {
      cancelled = true
    }
  })
</script>

{#if EditorComponent}
  <EditorComponent
    bind:this={editorInstance}
    {content}
    {editable}
    {docType}
    {containerClass}
    {editorClass}
    editorAriaLabel={resolvedAriaLabel}
    {autoFocus}
    {recreateKey}
    {maxContentLength}
    {onReady}
    {onAutoFocused}
    onContentChange={handleContentChange}></EditorComponent>
{:else}
  <div class={containerClass}>
    <div
      role="status"
      class={`${editorClass} flex min-h-[12rem] items-center justify-center rounded-lg border border-slate-700 bg-slate-950 text-sm text-slate-400`}>
      {loadError || i18n.t('editor.loading')}
    </div>
  </div>
{/if}
