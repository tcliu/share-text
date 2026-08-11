<script lang="ts">
  import { toast } from 'svelte-sonner'
  import Button from './Button.svelte'

  interface Props {
    text: string
    copyAriaLabel?: string
    copyTooltip?: string
  }

  let {
    text,
    copyAriaLabel = 'Copy to clipboard',
    copyTooltip = 'Copy',
  }: Props = $props()

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text)
      toast.success('Copied to clipboard')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to copy')
    }
  }
</script>

<!-- Reveals on hover/focus via a `group` ancestor; must not be portalled -->
<span class="shrink-0 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
  <Button
    size="sm"
    variant="ghost"
    ariaLabel={copyAriaLabel}
    tooltip={copyTooltip}
    onClick={(e) => { e.stopPropagation(); void handleCopy() }}
    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') e.stopPropagation() }}
    className="bg-transparent p-1 h-auto w-auto text-slate-400 hover:text-cyan-300">
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
