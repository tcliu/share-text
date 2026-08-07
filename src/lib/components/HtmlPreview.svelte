<script lang="ts">
  import type { PreviewProps } from '$lib/document-types'

  let { content }: PreviewProps = $props()

  const srcdoc = $derived(
    content.trim()
      ? content
      : `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"></head><body><div class="placeholder">No content to preview</div></body></html>`,
  )
</script>

<iframe
  title="HTML preview"
  sandbox=""
  srcdoc={srcdoc}
  class="h-full w-full bg-white"></iframe>
