<script lang="ts">
  import type { Snippet } from 'svelte'
  import CopyButton from './CopyButton.svelte'

  interface Props {
    text?: string
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

  // hide copy button when there's nothing to copy (empty or whitespace)
  function hasCopyText() {
    return (copyText ?? '').toString().trim().length > 0
  }
</script>

<div class="group flex min-w-0 flex-1 items-center gap-1">
  <span class={`${className} min-w-0 truncate`}>
    {#if children}
      {@render children()}
    {:else}
      {text}
    {/if}
  </span>
  {#if hasCopyText()}
    <CopyButton text={copyText ?? ''} {copyAriaLabel} {copyTooltip} />
  {/if}
</div>
