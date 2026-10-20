<script lang="ts">
  import CheckIcon from '$lib/icons/CheckIcon.svelte'
  import type { SizeInput } from '$lib/size-scale'
  import { dimensionMetrics, sizeVarStyle } from './size-metrics'

  interface Props {
    checked: boolean
    label?: string
    ariaLabel?: string
    name?: string
    disabled?: boolean
    indeterminate?: boolean
    stopPropagation?: boolean
    size?: SizeInput
    wrapperClass?: string
    inputRef?: HTMLInputElement | null
    onChange?: (checked: boolean) => void
  }

  let {
    checked = $bindable(),
    label,
    ariaLabel,
    name,
    disabled = false,
    indeterminate = false,
    stopPropagation = true,
    size = 'md',
    wrapperClass = '',
    inputRef = $bindable(null),
    onChange,
  }: Props = $props()

  // Every metric is a fixed ratio of the size dimension, so each keeps a
  // constant metric:dimension ratio across the whole range (calibrated at the
  // md default); the box keeps its 1.25× padding while the tick rides a trimmed
  // share of the slot, so the mark sits light inside it without shrinking the
  // checkbox.
  const CBX_RATIOS = { gap: 0.75, box: 1.25, font: 0.875, icon: 0.875 }

  const metrics = $derived(dimensionMetrics(size, CBX_RATIOS))
  const boxStyle = $derived(sizeVarStyle('cbx', metrics))
  const iconPx = $derived(metrics.icon)

  $effect(() => {
    if (!inputRef) return
    inputRef.indeterminate = indeterminate
  })
</script>

<label
  style={boxStyle}
  class={`relative inline-flex cursor-pointer items-center gap-[var(--cbx-gap)] before:absolute before:-inset-1 before:content-[''] ${disabled ? 'cursor-not-allowed opacity-40' : ''} ${wrapperClass}`}>
  <input
    bind:checked
    bind:this={inputRef}
    {name}
    type="checkbox"
    class="peer sr-only"
    {disabled}
    aria-label={ariaLabel ?? label}
    onclick={event => {
      if (stopPropagation) {
        event.stopPropagation()
      }
    }}
    onchange={event => onChange?.((event.currentTarget as HTMLInputElement).checked)} />
  <span
    aria-hidden="true"
    class={`inline-flex h-[var(--cbx-box)] w-[var(--cbx-box)] items-center justify-center rounded-md border transition peer-focus-visible:border-transparent peer-focus-visible:ring-2 peer-focus-visible:ring-cyan-500/70 ${checked ? 'border-cyan-500 bg-cyan-300 text-slate-950' : 'border-slate-700 bg-slate-950 text-transparent'}`}>
    <CheckIcon size={iconPx} />
  </span>
  {#if label}
    <span class="text-[length:var(--cbx-font)] text-slate-300">{label}</span>
  {/if}
</label>
