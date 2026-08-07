<script lang="ts">
  import { usePreviewContent } from '../use-preview-content.svelte'

  interface Props {
    content: string
    documentId: string
  }

  let { content, documentId }: Props = $props()

  const preview = usePreviewContent(() => content, () => documentId, { debounceMs: 300 })
</script>

<span data-testid="preview-content">{preview.value}</span>
