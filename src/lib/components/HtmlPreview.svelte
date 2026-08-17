<script lang="ts">
  import type { PreviewProps } from '$lib/document-types'
  import { t } from '$lib/i18n.svelte'

  let { content }: PreviewProps = $props()

  const srcdoc = $derived(
    content.trim()
      ? content
      : `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div class="placeholder">${t('preview.noContent')}</div></body></html>`,
  )
</script>

<iframe
  title={t('preview.html')}
  sandbox=""
  srcdoc={srcdoc}
  class="h-full w-full bg-white"></iframe>
