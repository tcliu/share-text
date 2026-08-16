<script lang="ts">
  import { toast } from 'svelte-sonner'
  import Button from './Button.svelte'
  import CopyIcon from '$lib/icons/CopyIcon.svelte'

  interface Props {
    text: string
    copyAriaLabel?: string
    copyTooltip?: string
    alwaysVisible?: boolean
  }

  let {
    text,
    copyAriaLabel = 'Copy to clipboard',
    copyTooltip = 'Copy',
    alwaysVisible = false,
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

<!-- Reveals on hover/focus via a `group` ancestor on hover-capable devices (hidden state gated behind `(hover: hover)`), always visible on touch devices; must not be portalled -->
<span class={`shrink-0 ${alwaysVisible ? '' : '[@media(hover:hover)]:opacity-0 transition group-hover:opacity-100 focus-within:opacity-100'}`}>
  <Button
    size="sm"
    variant="ghost"
    ariaLabel={copyAriaLabel}
    tooltip={copyTooltip}
    onClick={(e) => { e.preventDefault(); e.stopPropagation(); void handleCopy() }}
    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') e.stopPropagation() }}
    className="bg-transparent text-slate-400 hover:text-cyan-300">
    {#snippet icon()}
      <CopyIcon />
    {/snippet}
  </Button>
</span>
