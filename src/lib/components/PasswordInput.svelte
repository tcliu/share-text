<script lang="ts">
  import type { HTMLInputAttributes } from 'svelte/elements'
  import Tooltip from './Tooltip.svelte'
  import TextInput from './TextInput.svelte'
  import EyeIcon from '$lib/icons/EyeIcon.svelte'
  import EyeSlashIcon from '$lib/icons/EyeSlashIcon.svelte'
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
    id?: string
    name?: string
    placeholder?: string
    autocomplete?: HTMLInputAttributes['autocomplete']
    disabled?: boolean
    required?: boolean
    showLabel?: string
    hideLabel?: string
    size?: SizeInput
    className?: string
    // The visibility toggle owns the field's right edge, so `clearPlacement`
    // `auto` renders the clear outside the input.
    oninput?: (event: Event) => void
  }

  let {
    value = $bindable(),
    defaultValue,
    id,
    name,
    placeholder,
    autocomplete = 'current-password',
    disabled = false,
    required = false,
    showLabel,
    hideLabel,
    size = 'md',
    className = '',
    clearable = false,
    clearLabel,
    clearPlacement = 'auto',
    onClear,
    oninput,
  }: Props = $props()

  // The input box rides TextInput's shared base metrics; only the toggle's
  // icon needs its own metric, scaled by the same dimension.
  const pwdMetrics = $derived(dimensionMetrics(size, { icon: 1, box: 2.25, inset: 0.25 }))
  const pwdStyle = $derived(sizeVarStyle('pwd', pwdMetrics))

  // Derived (not plain consts) so locale switches re-resolve the labels.
  const resolvedShowLabel = $derived(showLabel ?? i18n.t('password.show'))
  const resolvedHideLabel = $derived(hideLabel ?? i18n.t('password.hide'))

  let visible = $state(false)
  let input = $state<HTMLInputElement | null>(null)
  let toggleBtn = $state<HTMLElement | null>(null)
  export function focus() {
    input?.focus()
  }

  function toggleVisibility() {
    visible = !visible
    requestAnimationFrame(() => {
      if (input) input.setSelectionRange(input.value.length, input.value.length)
    })
  }
</script>

<TextInput
  bind:value
  bind:inputRef={input}
  {id}
  {name}
  {placeholder}
  {autocomplete}
  {disabled}
  {required}
  {size}
  type={visible ? 'text' : 'password'}
  {oninput}
  {defaultValue}
  {clearable}
  {clearLabel}
  {clearPlacement}
  {onClear}
  className={`pr-[calc(var(--pwd-box)+var(--pwd-inset)*2)]${className ? ` ${className}` : ''}`}
  wrapperStyle={pwdStyle}>
  {#snippet trailing()}
    <button
      bind:this={toggleBtn}
      onclick={toggleVisibility}
      aria-label={visible ? resolvedHideLabel : resolvedShowLabel}
      type="button"
      {disabled}
      class="absolute right-[var(--pwd-inset)] top-[var(--pwd-inset)] bottom-[var(--pwd-inset)] inline-flex w-[var(--pwd-box)] items-center justify-center text-slate-400 transition outline-none hover:text-cyan-300 focus:text-cyan-300 disabled:cursor-not-allowed disabled:opacity-40">
      {#if visible}
        <EyeSlashIcon size={pwdMetrics.icon} />
      {:else}
        <EyeIcon size={pwdMetrics.icon} />
      {/if}
      <Tooltip trigger={toggleBtn}>{visible ? resolvedHideLabel : resolvedShowLabel}</Tooltip>
    </button>
  {/snippet}
</TextInput>
