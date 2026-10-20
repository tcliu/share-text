<script lang="ts">
  import type { Snippet } from 'svelte'
  import type { HTMLInputAttributes } from 'svelte/elements'
  import type { SizeInput } from '$lib/size-scale'
  import { getI18nContext } from '$lib/i18n.svelte'
  import CloseIcon from '$lib/icons/CloseIcon.svelte'
  import Button from './Button.svelte'
  import { dimensionMetrics, sizeVarStyle } from './size-metrics'
  import { INPUT_CHROME, INPUT_METRIC_CLASS, INPUT_RATIOS } from './input-chrome'
  import type { ClearableProps } from './clearable-props'

  const i18n = getI18nContext()

  // A native input passthrough (type, role, aria-*, event handlers, …) plus the
  // sizing/decorating hooks below. `value`, `class`, `style`, `size`, the
  // `aria-label` shorthand, and `children` are owned by this component.
  interface Props
    extends Omit<HTMLInputAttributes, 'value' | 'class' | 'style' | 'size' | 'aria-label' | 'children'>,
      ClearableProps {
    value: string
    // Baseline the clear affordance compares against: the cross hides while
    // `value` matches it (empty when unset), and the fallback clear writes it
    // back. A provided `onClear` still owns the clear.
    defaultValue?: string
    ariaLabel?: string
    size?: SizeInput
    inputRef?: HTMLInputElement | null
    // Inline style appended after the size-metric custom properties, for
    // callers that size the field themselves (runtime widths must not be
    // utilities).
    inputStyle?: string
    // Replaces the whole input class string (the override owns the metrics).
    inputClass?: string
    // Extra classes appended after the base (or the inputClass override), for
    // gutter offsets such as clearing a leading icon or trailing adornment.
    className?: string
    // Adornment blocks rendered inside the field frame, before and after the
    // text. Each positions itself (the frame is `relative`), so the caller owns
    // its absolute placement and the matching gutter offset.
    leading?: Snippet
    trailing?: Snippet
    // Metric custom properties for the adornments, set on the wrapping frame so
    // both the input's gutter class and the adornment inherit them.
    wrapperStyle?: string
    // Content rendered outside the field area, after it, in a size-scaled row.
    // The field gives up no room to it; the caller owns its look and behaviour.
    trailer?: Snippet
  }

  let {
    value = $bindable(),
    defaultValue,
    ariaLabel,
    size = 'md',
    disabled = false,
    readonly = false,
    inputRef = $bindable(null),
    inputStyle,
    inputClass,
    className = '',
    leading,
    trailing,
    wrapperStyle,
    trailer,
    clearable = false,
    clearPlacement = 'auto',
    clearLabel,
    onClear,
    ...rest
  }: Props = $props()

  const metrics = $derived(dimensionMetrics(size, INPUT_RATIOS))
  const style = $derived(sizeVarStyle('input', metrics))

  // Clear-affordance metrics: the button rides a trimmed share of the size
  // dimension so the cross reads lighter than the field's own icon slot, while
  // still scaling with the field (the share the trigger affordances ride); the
  // inset matches the field's horizontal padding, and the gutter reserves room
  // for both. The box reserves the outside row's clear slot so the input keeps
  // the same width empty and filled.
  const CLEAR_RATIOS = { button: 0.625, inset: INPUT_RATIOS.padX, gutter: 1.6875, box: 1 }
  const clearMetrics = $derived(dimensionMetrics(size, CLEAR_RATIOS))
  const clearStyle = $derived(sizeVarStyle('clear', clearMetrics))

  // The outside row's gap between the field and whatever follows it — the clear
  // cross and/or a caller's trailer.
  const TRAILER_RATIOS = { gap: 0.375 }
  const trailerMetrics = $derived(dimensionMetrics(size, TRAILER_RATIOS))

  // A disabled or read-only field offers no clear action: clearing it is not
  // permitted, and a disabled input cannot take focus back after the cross
  // disappears. While `value` matches `defaultValue` (empty when unset) there
  // is nothing to clear, so the cross hides.
  const showClear = $derived(clearable && (value ?? '') !== (defaultValue ?? '') && !disabled && !readonly)
  const resolvedClearLabel = $derived(clearLabel ?? i18n.t('common.clear'))
  const placement = $derived(clearPlacement === 'auto' ? (trailing ? 'outside' : 'inside') : clearPlacement)
  // The container that hosts the clear button is chosen from `clearable`, not
  // from whether a value is present, so clearing the field does not tear down
  // and recreate the `<input>` (which would drop focus) — only the button
  // itself toggles with the value.
  const insideField = $derived(clearable && placement === 'inside')
  const outsideField = $derived(clearable && placement === 'outside')
  const clearInside = $derived(showClear && insideField)
  const clearOutside = $derived(showClear && outsideField)
  // The outside row appears for an outside clear and/or a caller's trailer, and
  // (like the inside frame) persists regardless of the value so the `<input>`
  // is never recreated.
  const showTrailerRow = $derived(outsideField || Boolean(trailer))

  // The gutter is reserved whenever the inside clear is configured, not only
  // while a value shows the button, so the text area keeps the same width empty
  // and filled (no reflow when the first character is typed). It rides an inline
  // override rather than a `pr-*` class, so it wins over the base or the
  // `inputClass` padding by cascade, never by class order.
  const resolvedStyle = $derived(
    [
      style,
      inputStyle,
      // `--input-clear-offset` (set by a composite's wrapperStyle) shifts the
      // text clear of an overlay that owns the field's right edge.
      insideField ? 'padding-right:calc(var(--clear-gutter) + var(--input-clear-offset, 0px))' : '',
    ].filter(Boolean).join(';'),
  )

  const resolvedClass = $derived(
    `${inputClass ?? `${INPUT_CHROME} ${INPUT_METRIC_CLASS}`}${className ? ` ${className}` : ''}`,
  )

  // The frame carries the caller's adornment metrics plus the clear metrics, so
  // the input's gutter and the inside button both inherit them.
  const frameStyle = $derived([wrapperStyle, insideField ? clearStyle : ''].filter(Boolean).join(';'))

  const hasAdornment = $derived(Boolean(leading || trailing))

  // A provided handler owns the clear (it may write the bound value itself);
  // otherwise the value is reset to the default. Focus returns to the field
  // either way, so the control stays reachable after the cross disappears
  // with it.
  function handleClear() {
    if (onClear) {
      onClear()
    } else {
      value = defaultValue ?? ''
    }
    inputRef?.focus()
  }
</script>

{#snippet control()}
  <input
    bind:this={inputRef}
    bind:value
    {...rest}
    {disabled}
    {readonly}
    aria-label={ariaLabel}
    class={resolvedClass}
    style={resolvedStyle} />
{/snippet}

{#snippet clearIcon()}
  <CloseIcon />
{/snippet}

{#snippet clearControl()}
  <Button
    variant="ghost"
    size={clearMetrics.button}
    icon={clearIcon}
    ariaLabel={resolvedClearLabel}
    onClick={handleClear}
    className="size-[var(--clear-box)] shrink-0" />
{/snippet}

{#snippet field()}
  {#if hasAdornment || insideField}
    <div class="relative" style={frameStyle}>
      {@render control()}
      {#if leading}{@render leading()}{/if}
      {#if trailing}{@render trailing()}{/if}
      {#if clearInside}
        <!-- Overlays the field's own right edge; a `--input-clear-offset`
            (from a composite's wrapperStyle) shifts it left of a trailing
            adornment, and `inset`/`gutter` are the frame-inherited clear
            metrics so the input's reserved padding and this button stay in
            lockstep. -->
        <span
          class="absolute inset-y-0 flex items-center"
          style="right:calc(var(--clear-inset) + var(--input-clear-offset, 0px));">
          {@render clearControl()}
        </span>
      {/if}
    </div>
  {:else}
    {@render control()}
  {/if}
{/snippet}

{#if showTrailerRow}
  <!-- The field already owns its right edge (a `trailing` adornment), so the
      clear and any caller trailer sit after it as siblings, spaced by the
      size-scaled gap. The row hugs the field (no `w-full`) so that, as a flex
      item, it keeps the field's own width instead of occupying the whole row;
      as a block-level flex container it still fills block layouts. The row
      persists whenever a clear or trailer is configured so the input is never
      recreated. The clear slot is reserved even while empty: the spacer takes
      the same box metric the cross button pins itself to (`--clear-box`, and
      its touch floor where the button floors), so the input keeps exactly the
      same width empty and filled. -->
  <span
    class="flex items-center"
    style={[`gap:${trailerMetrics.gap}px`, outsideField ? clearStyle : ''].filter(Boolean).join(';')}>
    <span class="min-w-0 flex-1">{@render field()}</span>
    {#if clearOutside}{@render clearControl()}
    {:else if outsideField}
      <span
        aria-hidden="true"
        class="h-[var(--clear-box)] w-[var(--clear-box)] shrink-0 max-phone:h-11 max-phone:w-11"></span>
    {/if}
    {#if trailer}{@render trailer()}{/if}
  </span>
{:else}
  {@render field()}
{/if}

<style>
  /* 16px on touch pointers so iOS Safari does not auto-zoom on focus. Plain
     scoped CSS on purpose: a stacked Tailwind variant inside a class
     expression never reaches the scanner, so it would silently not exist. */
  @media (pointer: coarse) {
    input {
      font-size: 1rem;
    }
  }
</style>
