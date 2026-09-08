<script lang="ts">
  import type { PreviewProps } from '$lib/document-types'
  import { getI18nContext } from '$lib/i18n.svelte'
  const i18n = getI18nContext()

  let { content }: PreviewProps = $props()

  const srcdoc = $derived(
    content.trim()
      ? content
      : `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div class="placeholder">${i18n.t('preview.noContent')}</div></body></html>`,
  )
</script>

<iframe
  title={i18n.t('preview.html')}
  sandbox=""
  srcdoc={srcdoc}
  class="h-full w-full bg-white"></iframe>
