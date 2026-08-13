<script lang="ts">
  import Tooltip from './Tooltip.svelte'
  import CloseIcon from '$lib/icons/CloseIcon.svelte'

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
        <CloseIcon className="h-2.5 w-2.5" />
      </button>
    {/if}
  </span>
  {#if tooltip}
    <Tooltip>{tooltip}</Tooltip>
  {/if}
</span>
