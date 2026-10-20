<script lang="ts">
  import type { Snippet } from 'svelte'
  import Button from '$lib/components/Button.svelte'
  import CopyIcon from '$lib/icons/CopyIcon.svelte'
  import { getI18nContext } from '$lib/i18n.svelte'
  import { copyToClipboard } from './copy-to-clipboard'
  import type { SizeInput } from '$lib/size-scale'

  const i18n = getI18nContext()

  interface Props {
    text?: string
    copyText?: string
    textClass?: string
    containerClass?: string
    ariaLabel?: string
    tooltip?: string
    copyPosition?: 'inline' | 'top-right'
    children?: Snippet
    size?: SizeInput
  }

  let {
    text,
    copyText = text,
    textClass = 'text-slate-400',
    containerClass = '',
    ariaLabel,
    tooltip,
    copyPosition = 'inline',
    children,
    size = 'md',
  }: Props = $props()

  // Derived (not read inline) so a locale switch re-resolves the labels.
  const resolvedAriaLabel = $derived(ariaLabel ?? i18n.t('copy.toClipboard'))
  const resolvedTooltip = $derived(tooltip ?? i18n.t('common.copy'))

  // hide copy button when there's nothing to copy (empty or whitespace)
  function hasCopyText() {
    return (copyText ?? '').toString().trim().length > 0
  }

  function handleCopy(event: MouseEvent) {
    event.preventDefault()
    event.stopPropagation()
    void copyToClipboard(copyText ?? '', {
      copied: i18n.t('editor.toast.copied'),
      failed: i18n.t('editor.toast.copyFailed'),
    })
  }
</script>

{#snippet copyButton()}
  <!-- Reveals on hover/focus via the surrounding `group` ancestor on
       hover-capable devices (hidden state gated behind `(hover: hover)`),
       always visible on touch devices; must not be portalled. -->
  <span class="shrink-0 transition group-hover:opacity-100 focus-within:opacity-100 [@media(hover:hover)]:opacity-0">
    <Button
      size={size}
      variant="ghost"
      ariaLabel={resolvedAriaLabel}
      tooltip={resolvedTooltip}
      onClick={handleCopy}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') event.stopPropagation()
      }}
      className="bg-transparent text-slate-400 hover:text-cyan-300">
      {#snippet icon()}
        <CopyIcon />
      {/snippet}
    </Button>
  </span>
{/snippet}

{#if copyPosition === 'top-right'}
  <!-- Top-right mode: the copy button sits to the right of the wrapped content
       on the same row as its first line. -->
  <div class={`group flex items-start gap-1 ${containerClass}`}>
    <div class="min-w-0 flex-1">
      {#if children}
        {@render children()}
      {:else}
        <span class={`${textClass} block`}>{text}</span>
      {/if}
    </div>
    {#if hasCopyText()}
      <span class="mt-1.5 mr-1.5">
        {@render copyButton()}
      </span>
    {/if}
  </div>
{:else}
  <div class={`group flex min-w-0 flex-1 items-center gap-1 ${containerClass}`}>
    <span class={`${textClass} min-w-0 truncate`}>
      {#if children}
        {@render children()}
      {:else}
        {text}
      {/if}
    </span>
    {#if hasCopyText()}
      {@render copyButton()}
    {/if}
  </div>
{/if}
