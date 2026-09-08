<script lang="ts">
  import type { Component } from 'svelte'
  import type { PreviewProps } from '$lib/document-types'
  import { getI18nContext } from '$lib/i18n.svelte'
  const i18n = getI18nContext()

  interface Props {
    preview: () => Promise<Component<PreviewProps>>
    content: string
    docType?: string
    onContentChange?: (content: string) => void
    editable?: boolean
  }

  let { preview, content, docType, onContentChange, editable = true }: Props = $props()

  let PreviewComponent = $state<Component<PreviewProps> | null>(null)
  let loadError = $state('')
  let lastPreview: (() => Promise<Component<PreviewProps>>) | null = null

  $effect(() => {
    if (preview === lastPreview) return
    lastPreview = preview
    let cancelled = false
    PreviewComponent = null
    loadError = ''
    preview()
      .then(module => {
        if (!cancelled) {
          PreviewComponent = module
        }
      })
      .catch(error => {
        if (!cancelled) {
          loadError = error instanceof Error ? error.message : i18n.t('preview.loadFailed')
        }
      })

    return () => {
      cancelled = true
    }
  })
</script>

{#if PreviewComponent}
  <PreviewComponent {content} {docType} onContentChange={editable ? onContentChange : undefined} {editable} />
{:else}
  <div class="flex h-full items-center justify-center text-sm text-slate-400">
    {loadError || i18n.t('preview.loading')}
  </div>
{/if}
