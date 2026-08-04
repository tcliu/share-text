<script lang="ts">
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
    onContentChange?: (content: string) => void
  }

  let {
    content = $bindable(),
    editable = true,
    docType = 'text',
    containerClass = '',
    editorClass = '',
    editorAriaLabel = 'Content',
    autoFocus = false,
    recreateKey = '',
    maxContentLength = 0,
    onContentChange,
  }: Props = $props()

  let EditorComponent = $state<any>(null)
  let editorInstance = $state<{ focus: () => void } | null>(null)
  let loadError = $state('')

  function handleContentChange(nextContent: string) {
    content = nextContent
    onContentChange?.(nextContent)
  }

  export function focus() {
    editorInstance?.focus()
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
          loadError = error instanceof Error ? error.message : 'Failed to load editor'
        }
      })

    return () => {
      cancelled = true
    }
  })
</script>

{#if EditorComponent}
  <!-- svelte-ignore a11y_autofocus -->
  <EditorComponent
    bind:this={editorInstance}
    {content}
    {editable}
    {docType}
    {containerClass}
    {editorClass}
    {editorAriaLabel}
    {autoFocus}
    {recreateKey}
    {maxContentLength}
    onContentChange={handleContentChange}></EditorComponent>
{:else}
  <div class={containerClass}>
    <div
      class={`${editorClass} flex min-h-[12rem] items-center justify-center rounded-lg border border-slate-700 bg-slate-950 text-sm text-slate-400`}>
      {loadError || 'Loading editor...'}
    </div>
  </div>
{/if}
