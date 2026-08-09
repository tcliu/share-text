<script lang="ts">
  interface Props {
    checked: boolean
    label?: string
    ariaLabel?: string
    name?: string
    disabled?: boolean
    indeterminate?: boolean
    stopPropagation?: boolean
    labelClass?: string
    wrapperClass?: string
    boxClass?: string
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
    labelClass = 'text-sm text-slate-300',
    wrapperClass = '',
    boxClass = '',
    inputRef = $bindable(null),
    onChange,
  }: Props = $props()

  $effect(() => {
    if (!inputRef) {
      return
    }
    inputRef.indeterminate = indeterminate
  })
</script>

<label
  class={`inline-flex cursor-pointer items-center gap-3 ${disabled ? 'cursor-not-allowed opacity-40' : ''} ${wrapperClass}`}>
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
    class={`inline-flex h-5 w-5 items-center justify-center rounded-md border transition peer-focus-visible:ring-2 peer-focus-visible:ring-cyan-500/70 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-slate-900 ${checked ? 'border-cyan-500 bg-cyan-300 text-slate-950' : 'border-slate-700 bg-slate-950 text-transparent'} ${boxClass}`}>
    <svg class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
      <path
        fill-rule="evenodd"
        d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
        clip-rule="evenodd" />
    </svg>
  </span>
  {#if label}
    <span class={labelClass}>{label}</span>
  {/if}
</label>
