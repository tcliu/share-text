<script lang="ts">
  import type { Component } from 'svelte'
  import type { PreviewProps } from '$lib/document-types'
  import { t } from '$lib/i18n.svelte'

  interface Props {
    preview: () => Promise<Component<PreviewProps>>
    content: string
    docType?: string
    onContentChange?: (content: string) => void
  }

  let { preview, content, docType, onContentChange }: Props = $props()

  let PreviewComponent = $state<Component<PreviewProps> | null>(null)
  let loadError = $state('')

  $effect(() => {
    let cancelled = false
    preview()
      .then(module => {
        if (!cancelled) {
          PreviewComponent = module
        }
      })
      .catch(error => {
        if (!cancelled) {
          loadError = error instanceof Error ? error.message : t('preview.loadFailed')
        }
      })

    return () => {
      cancelled = true
    }
  })
</script>

{#if PreviewComponent}
  <PreviewComponent {content} {docType} {onContentChange} />
{:else}
  <div class="flex h-full items-center justify-center text-sm text-slate-400">
    {loadError || t('preview.loading')}
  </div>
{/if}
