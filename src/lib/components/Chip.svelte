<script lang="ts">
  import Tooltip from './Tooltip.svelte'
  import CloseIcon from '$lib/icons/CloseIcon.svelte'
  import { getI18nContext } from '$lib/i18n.svelte'
  import { type SizeInput } from '$lib/size-scale'
  import { dimensionMetrics, sizeVarStyle } from './size-metrics'
  const i18n = getI18nContext()

  interface Props {
    label: string
    chipClass: string
    size?: SizeInput
    style?: string
    removeLabel?: string
    removeButtonClass?: string
    removeButtonStyle?: string
    tooltip?: string
    disabled?: boolean
    // Removable mode: the chip offers a remove affordance next to the label.
    // `onRemove` is the handler; the affordance renders when both are set, so
    // a chip never shows a cross it cannot act on. The toggle mode (`onclick`)
    // owns the whole pill and takes no affordance.
    removable?: boolean
    onRemove?: () => void
    // Toggle mode: renders an `aria-pressed` button instead of the static
    // pill. `chipClass` supplies the color; the pressed frame swaps border
    // weight while the invisible-bold grid keeps the width stable.
    active?: boolean
    onclick?: () => void
  }

  let {
    label,
    chipClass,
    size = 'md',
    style = '',
    removeLabel,
    removeButtonClass = '',
    removeButtonStyle = '',
    tooltip,
    disabled = false,
    removable = false,
    onRemove,
    active = false,
    onclick,
  }: Props = $props()

  // Derived (not read inline) so a locale switch re-resolves the label.
  const resolvedRemoveLabel = $derived(removeLabel ?? i18n.t('chip.remove', { name: label }))

  // The affordance needs a handler: a removable chip without one shows no
  // cross, so the pill never offers an action that does nothing.
  const showRemove = $derived(removable && Boolean(onRemove))

  // Every metric is a fixed ratio of the size dimension, calibrated so the
  // default `md` reproduces the pill's current metrics: a 12px label, 8/2
  // padding, a 4px label→remove gap, and the 7.3px remove cross. Chip owns the
  // size-scaled spacing; `chipClass` supplies color and shape (radius) only.
  // The remove cross's icon size is 0.5625 of the size dimension (9px at `md`),
  // and `resolveIconPx` renders the cross at 0.8125 of that (7.3px), because a
  // glyph fills its box and the shared icon ratio trims the artwork inside it.
  const CHIP_RATIOS = {
    font: 0.75,
    line: 1,
    padX: 0.5,
    padY: 0.125,
    gap: 0.25,
    icon: 0.75 * 0.75,
  }

  const metrics = $derived(dimensionMetrics(size, CHIP_RATIOS))
  const chipStyle = $derived(sizeVarStyle('chip', metrics))
</script>

<span class={tooltip ? 'group relative inline-flex' : 'inline-flex'} style={chipStyle}>
  {#if onclick}
    <button
      type="button"
      aria-pressed={active}
      {onclick}
      {disabled}
      class={`inline-flex w-fit cursor-pointer items-center gap-[var(--chip-gap)] rounded-full px-[var(--chip-pad-x)] py-[var(--chip-pad-y)] text-[length:var(--chip-font)] leading-[var(--chip-line)] transition disabled:cursor-not-allowed ${chipClass} ${active ? 'border-2 font-semibold opacity-100' : 'm-px border opacity-70 hover:opacity-100'}`}>
      <span class="grid">
        <span class="col-start-1 row-start-1 {active ? 'font-semibold' : ''}">{label}</span>
        <span class="invisible col-start-1 row-start-1 font-semibold" aria-hidden="true">{label}</span>
      </span>
    </button>
  {:else}
    <span {style} class={`${chipClass} inline-flex items-center gap-[var(--chip-gap)] px-[var(--chip-pad-x)] py-[var(--chip-pad-y)] text-[length:var(--chip-font)] leading-[var(--chip-line)]`}>
      {label}
      {#if showRemove}
        <button
          type="button"
          aria-label={resolvedRemoveLabel}
          onclick={onRemove}
          {disabled}
          style={removeButtonStyle}
          class={removeButtonClass}>
          <CloseIcon size={metrics.icon} />
        </button>
      {/if}
    </span>
  {/if}
  {#if tooltip}
    <Tooltip>{tooltip}</Tooltip>
  {/if}
</span>
