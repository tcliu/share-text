<script lang="ts">
  import Tooltip from './Tooltip.svelte'

  interface Props {
    label: string
    chipClass: string
    style?: string
    ariaLabel?: string
    removeButtonClass?: string
    removeButtonStyle?: string
    tooltip?: string
    disabled?: boolean
    onRemove?: () => void
  }

  let {
    label,
    chipClass,
    style = '',
    ariaLabel = `Remove ${label}`,
    removeButtonClass = '',
    removeButtonStyle = '',
    tooltip,
    disabled = false,
    onRemove,
  }: Props = $props()
</script>

<span class={tooltip ? 'group relative inline-flex' : 'inline-flex'}>
  <span {style} class={`${chipClass} inline-flex items-center gap-1`}>
    {label}
    {#if onRemove}
      <button type="button" aria-label={ariaLabel} onclick={onRemove} {disabled} style={removeButtonStyle} class={removeButtonClass}>
        <svg class="h-2.5 w-2.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path
            d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
        </svg>
      </button>
    {/if}
  </span>
  {#if tooltip}
    <Tooltip>{tooltip}</Tooltip>
  {/if}
</span>
