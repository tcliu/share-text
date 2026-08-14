<script lang="ts">
  import CodeEditor from '../CodeEditor.svelte'

  let {
    content = $bindable(),
    recreateKey = 'default',
    docType = 'text',
    maxContentLength = 0,
  }: {
    content: string
    recreateKey?: string
    docType?: string
    maxContentLength?: number
  } = $props()
</script>

<CodeEditor
  bind:content
  {docType}
  {recreateKey}
  {maxContentLength} />
<span data-testid="content-length" class="hidden">{content.length}</span>