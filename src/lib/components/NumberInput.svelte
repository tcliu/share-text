<script lang="ts">
  import ChevronUpIcon from '$lib/icons/ChevronUpIcon.svelte'
  import ChevronDownIcon from '$lib/icons/ChevronDownIcon.svelte'
  import TextInput from './TextInput.svelte'
  import { getI18nContext } from '$lib/i18n.svelte'
  import type { SizeInput } from '$lib/size-scale'
  import { dimensionMetrics, sizeVarStyle } from './size-metrics'
  import type { ClearableProps } from './clearable-props'
  const i18n = getI18nContext()

  interface Props extends ClearableProps {
    value: string
    // Baseline the clear affordance compares against; forwarded to TextInput,
    // whose fallback clear writes it back.
    defaultValue?: string
    min?: number
    max?: number
    step?: number
    placeholder?: string
    disabled?: boolean
    className?: string
    showControls?: boolean
    // Inline style forwarded to the native input. Used by callers that hide
    // the steppers to size the field themselves (runtime widths must not be
    // utilities); pagination passes a ch-based width here.
    inputStyle?: string
    id?: string
    ariaLabel: string
    size?: SizeInput
    incrementLabel?: string
    decrementLabel?: string
    // The steppers own the field's right edge, so `clearPlacement` `auto`
    // renders the clear outside the input (an explicit `inside` sits left of
    // the steppers instead of over them).
    onkeydown?: (event: KeyboardEvent) => void
    oninput?: (event: Event) => void
    onblur?: (event: FocusEvent) => void
  }

  let {
    value = $bindable(),
    defaultValue,
    min,
    max,
    step = 1,
    placeholder,
    disabled = false,
    className = '',
    showControls = true,
    inputStyle,
    id,
    ariaLabel,
    size = 'md',
    incrementLabel,
    decrementLabel,
    clearable = false,
    clearLabel,
    clearPlacement = 'auto',
    onClear,
    onkeydown,
    oninput,
    onblur,
  }: Props = $props()

  // The input box rides TextInput's shared base metrics; the stepper glyph and
  // the gutter that clears it are the only metrics NumberInput adds. The glyph
  // rides a trimmed share of the slot rather than the whole of it, so the
  // steppers read lighter than the value beside them while still scaling.
  const NUM_RATIOS = { icon: 0.75, padRight: 1.25, radius: 0.375 }

  const numMetrics = $derived(dimensionMetrics(size, NUM_RATIOS))
  const numStyle = $derived(sizeVarStyle('num', numMetrics))

  // A trailing stepper column is overlaid on the input's right gutter, so the
  // box keeps exactly TextInput's height instead of growing to the steppers.
  const framedClass = $derived(`pr-[var(--num-pad-right)]${className ? ` ${className}` : ''}`)
  // Steppers hidden: the caller owns the whole visual (Pagination sizes it), so
  // replace the base chrome and keep only the input plumbing.
  const bareClass = $derived(
    `flex-1 text-slate-100 transition outline-none disabled:opacity-40 motion-reduce:transition-none${className ? ` ${className}` : ''}`,
  )

  // Derived (not plain consts) so locale switches re-resolve the labels.
  const resolvedIncrementLabel = $derived(incrementLabel ?? i18n.t('number.increment'))
  const resolvedDecrementLabel = $derived(decrementLabel ?? i18n.t('number.decrement'))

  // An explicit `inside` clear must sit left of the steppers, not over them.
  // The stepper gutter is published as `--input-clear-offset` for TextInput's
  // clear affordance to consume (TextInput reserves both gutters in the input);
  // `auto` already renders outside while the steppers are present.
  const wrapperStyle = $derived(
    clearable && clearPlacement === 'inside' && showControls ? '--input-clear-offset:var(--num-pad-right)' : undefined,
  )

  let inputEl = $state<HTMLInputElement | null>(null)
  let pointerFocused = false
  let focused = false
  let wheelDelta = 0

  // Wheel deltas arrive as pixels (deltaMode 0), lines (1), or pages (2);
  // normalize the latter two to a pixel-equivalent scale.
  const WHEEL_PIXELS_PER_UNIT = 100
  // Accumulate to a threshold so a trackpad's stream of small deltas steps
  // once per gesture instead of racing through values, while a single mouse
  // notch (100px) steps once.
  const WHEEL_DELTA_THRESHOLD = 50

  export function focus() {
    inputEl?.focus()
  }

  function handleFocus(event: FocusEvent) {
    focused = true
    moveCaretToEndIfKeyboardFocus(event)
  }

  function moveCaretToEndIfKeyboardFocus(event: FocusEvent) {
    const input = event.currentTarget as HTMLInputElement
    if (pointerFocused) {
      pointerFocused = false
      return
    }
    queueMicrotask(() => {
      if (!focused) return
      const end = input.value.length
      input.setSelectionRange(end, end)
    })
  }

  const currentValue = $derived(Number.parseFloat(value))
  const isAtMax = $derived(max !== undefined && !Number.isNaN(currentValue) && currentValue >= max)
  const isAtMin = $derived(min !== undefined && !Number.isNaN(currentValue) && currentValue <= min)
  const inputType = $derived(step !== undefined && !Number.isInteger(step) ? 'decimal' : 'numeric')

  function stepDecimals() {
    if (step === undefined) return 0
    const s = String(step)
    if (s.includes('e-')) {
      const parts = s.split('e-')
      return Number(parts[1] ?? 0)
    }
    const dot = s.indexOf('.')
    return dot === -1 ? 0 : s.length - dot - 1
  }

  function snapToStep(val: number): number {
    if (step === undefined || min === undefined) return val
    const decimals = stepDecimals()
    const steps = Math.round((val - min) / step)
    const snapped = min + steps * step
    const clampedSnap = max !== undefined ? Math.min(max, Math.max(min, snapped)) : snapped
    return Number(clampedSnap.toFixed(decimals))
  }

  // A typed entry clamps as soon as another digit could not bring it back into
  // range: an entry past the max is stuck once it is non-negative (digits only
  // widen it), and one below the min once it is negative or once the next
  // multiple of ten already overshoots the max. A positive entry under the min
  // may still be the prefix of a valid number (`50` under `min: 10`), so it
  // waits for blur or a step, which keep their own clamps.
  function clampTyped(text: string): string {
    const parsed = Number.parseFloat(text)
    if (Number.isNaN(parsed)) return text
    if (max !== undefined && parsed > max && parsed >= 0) return String(max)
    const stuckBelow = parsed < 0 || (max !== undefined && parsed * 10 > max)
    if (min !== undefined && parsed < min && stuckBelow) return String(min)
    return text
  }

  function handleInput(event: Event) {
    const input = event.target as HTMLInputElement
    let newValue = input.value.replace(/[^0-9.-]/g, '')

    if (min !== undefined && min >= 0) {
      newValue = newValue.replace(/-/g, '')
    }

    const decimalCount = (newValue.match(/\./g) || []).length
    if (decimalCount > 1) {
      newValue = newValue.replace(/\.(?=.*\.)/g, '')
    }

    if (newValue.indexOf('-') > 0) {
      newValue = newValue.replace(/-/g, '')
    }

    newValue = clampTyped(newValue)
    input.value = newValue
    value = newValue
  }

  function handleBlur(event: FocusEvent) {
    focused = false
    wheelDelta = 0
    const input = event.target as HTMLInputElement
    const numValue = Number.parseFloat(input.value)
    if (input.value === '' || Number.isNaN(numValue)) {
      onblur?.(event)
      return
    }
    let clamped = numValue
    if (min !== undefined && clamped < min) {
      clamped = min
    }
    if (max !== undefined && clamped > max) {
      clamped = max
    }
    const snapped = snapToStep(clamped)
    const finalValue = snapped !== numValue ? snapped : clamped !== numValue ? clamped : null
    if (finalValue !== null) {
      const decimals = stepDecimals()
      const next = decimals > 0 ? String(Number(finalValue.toFixed(decimals))) : String(finalValue)
      input.value = next
      value = next
    }
    onblur?.(event)
  }

  function adjust(direction: 1 | -1) {
    if (disabled) {
      return
    }
    const current = Number.parseFloat(value)
    const base = Number.isNaN(current) ? (min ?? 0) : current
    let next = base + direction * step
    if (min !== undefined && next < min) {
      next = min
    }
    if (max !== undefined && next > max) {
      next = max
    }
    next = snapToStep(next)
    // Ensure fixed decimals for display consistency when step has decimals
    const decimals = stepDecimals()
    const nextStr = decimals > 0 ? String(Number(next.toFixed(decimals))) : String(next)
    value = nextStr
    if (inputEl) {
      inputEl.value = nextStr
      inputEl.dispatchEvent(new Event('input', { bubbles: true }))
      inputEl.focus()
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      adjust(1)
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      adjust(-1)
    }
    onkeydown?.(event)
  }

  function handleWheel(event: WheelEvent) {
    if (!focused || disabled) return
    // Pinch-zoom arrives as a ctrl-modified wheel, and shift-scroll as a
    // horizontal delta; leave both to the browser.
    if (event.ctrlKey || event.deltaY === 0) return
    // Own the wheel while focused so the page does not scroll instead of the
    // field stepping.
    event.preventDefault()
    wheelDelta += event.deltaMode === 0 ? event.deltaY : event.deltaY * WHEEL_PIXELS_PER_UNIT
    if (Math.abs(wheelDelta) < WHEEL_DELTA_THRESHOLD) return
    const direction = wheelDelta < 0 ? 1 : -1
    wheelDelta = 0
    adjust(direction)
  }
</script>

{#snippet steppers()}
  <!-- The column paints no border of its own: it only reserves the input's
       border ring with a transparent border and lets the input's border show
       through, so its focus/disabled color always tracks the field's. -->
  <div
    class="absolute inset-y-0 right-0 flex w-[var(--num-pad-right)] flex-col overflow-hidden rounded-r-[var(--num-radius)] border-y border-r border-transparent">
    <button
      type="button"
      onclick={() => adjust(1)}
      disabled={disabled || isAtMax}
      tabindex="-1"
      aria-label={resolvedIncrementLabel}
      class="flex flex-1 items-center justify-center border-b border-slate-700 bg-slate-900 text-slate-400 transition outline-none hover:text-cyan-300 focus:text-cyan-300 focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-inset disabled:opacity-40 motion-reduce:transition-none [@media(pointer:coarse)]:min-h-6">
      <ChevronUpIcon size={numMetrics.icon} />
    </button>
    <button
      type="button"
      onclick={() => adjust(-1)}
      disabled={disabled || isAtMin}
      tabindex="-1"
      aria-label={resolvedDecrementLabel}
      class="flex flex-1 items-center justify-center bg-slate-900 text-slate-400 transition outline-none hover:text-cyan-300 focus:text-cyan-300 focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-inset disabled:opacity-40 motion-reduce:transition-none [@media(pointer:coarse)]:min-h-6">
      <ChevronDownIcon size={numMetrics.icon} />
    </button>
  </div>
{/snippet}

<div onwheel={handleWheel} class={showControls ? '' : 'flex flex-none items-stretch'} style={numStyle}>
  <TextInput
    bind:inputRef={inputEl}
    {id}
    type="text"
    inputmode={inputType}
    {placeholder}
    {disabled}
    {ariaLabel}
    {size}
    {inputStyle}
    bind:value
    {defaultValue}
    inputClass={showControls ? undefined : bareClass}
    className={showControls ? framedClass : undefined}
    trailing={showControls ? steppers : undefined}
    {clearable}
    {clearLabel}
    {clearPlacement}
    {wrapperStyle}
    {onClear}
    onpointerdown={() => {
      pointerFocused = true
    }}
    onpointerup={() => {
      queueMicrotask(() => {
        pointerFocused = false
      })
    }}
    onpointercancel={() => {
      pointerFocused = false
    }}
    onfocus={handleFocus}
    oninput={e => {
      handleInput(e)
      oninput?.(e)
    }}
    onblur={handleBlur}
    onkeydown={handleKeydown} />
</div>
