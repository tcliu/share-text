<script lang="ts">
  import { toast } from 'svelte-sonner'
  import type { Snippet } from 'svelte'
  import Button from './Button.svelte'

  interface Props {
    text: string
    copyText?: string
    className?: string
    copyAriaLabel?: string
    copyTooltip?: string
    children?: Snippet
  }

  let {
    text,
    copyText = text,
    className = 'text-slate-400',
    copyAriaLabel = 'Copy to clipboard',
    copyTooltip = 'Copy',
    children,
  }: Props = $props()

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(copyText)
      toast.success('Copied to clipboard')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to copy')
    }
  }
</script>

<div class="group flex min-w-0 flex-1 items-center">
  <span class={`${className} min-w-0 truncate`}>
    {#if children}
      {@render children()}
    {:else}
      {text}
    {/if}
  </span>
  <span class="shrink-0 opacity-0 transition group-hover:opacity-100">
    <Button
      size="sm"
      variant="ghost"
      ariaLabel={copyAriaLabel}
      tooltip={copyTooltip}
      onClick={(e) => { e.stopPropagation(); void handleCopy() }}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') e.stopPropagation() }}
      className="bg-transparent p-0 text-slate-400 hover:text-cyan-300">
      {#snippet icon()}
        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          stroke-width="1.7"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true">
          <rect x="7" y="7" width="9" height="9" rx="1.5" />
          <path d="M5.5 13H5A1.5 1.5 0 0 1 3.5 11.5V5A1.5 1.5 0 0 1 5 3.5h6.5A1.5 1.5 0 0 1 13 5v.5" />
        </svg>
      {/snippet}
    </Button>
  </span>
</div>
