<script lang="ts">
  import type { Component } from 'svelte'
  import type { PreviewProps } from '$lib/document-types'

  interface Props {
    preview: () => Promise<Component<PreviewProps>>
    content: string
  }

  let { preview, content }: Props = $props()

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
          loadError = error instanceof Error ? error.message : 'Failed to load preview'
        }
      })

    return () => {
      cancelled = true
    }
  })
</script>

{#if PreviewComponent}
  <PreviewComponent {content} />
{:else}
  <div class="flex items-center justify-center rounded-lg border border-slate-700 bg-slate-950 text-sm text-slate-400">
    {loadError || 'Loading preview...'}
  </div>
{/if}
