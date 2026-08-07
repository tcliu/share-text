<script lang="ts">
  import type { Component } from 'svelte'
  import type { PreviewProps } from '$lib/document-types'

  interface Props {
    preview: () => Promise<Component<PreviewProps>>
    content: string
  }

  let { preview, content }: Props = $props()

  const PREVIEW_DEBOUNCE_MS = 300

  let PreviewComponent = $state<Component<PreviewProps> | null>(null)
  let loadError = $state('')
  let debouncedContent = $state('')

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
          loadError = error instanceof Error ? error.message : 'Failed to load preview'
        }
      })

    return () => {
      cancelled = true
    }
  })

  $effect(() => {
    const nextContent = content
    const timeout = setTimeout(() => {
      debouncedContent = nextContent
    }, PREVIEW_DEBOUNCE_MS)
    return () => clearTimeout(timeout)
  })
</script>

{#if PreviewComponent}
  <PreviewComponent content={debouncedContent} />
{:else}
  <div class="flex h-full items-center justify-center text-sm text-slate-400">
    {loadError || 'Loading preview...'}
  </div>
{/if}
