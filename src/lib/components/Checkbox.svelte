<script lang="ts">
  interface Props {
    checked: boolean
    ariaLabel?: string
    disabled?: boolean
    indeterminate?: boolean
    boxClass?: string
    onChange?: (checked: boolean) => void
  }

  let {
    checked = $bindable(),
    ariaLabel,
    disabled = false,
    indeterminate = false,
    boxClass = '',
    onChange,
  }: Props = $props()

  let inputEl = $state<HTMLInputElement | null>(null)

  $effect(() => {
    if (inputEl) {
      inputEl.indeterminate = indeterminate
    }
  })
</script>

<label class={`inline-flex cursor-pointer items-center ${disabled ? 'cursor-not-allowed opacity-40' : ''}`}>
  <input
    bind:checked
    bind:this={inputEl}
    type="checkbox"
    {disabled}
    aria-label={ariaLabel}
    onclick={event => {
      event.stopPropagation()
    }}
    onchange={event => onChange?.((event.currentTarget as HTMLInputElement).checked)}
    class="peer sr-only" />
  <span
    aria-hidden="true"
    class={`inline-flex h-4 w-4 items-center justify-center rounded border transition peer-focus-visible:ring-2 peer-focus-visible:ring-cyan-500/70 ${checked ? 'border-cyan-500 bg-cyan-300 text-slate-950' : 'border-slate-600 bg-slate-950 text-transparent'} ${boxClass}`}>
    <svg class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
      <path
        fill-rule="evenodd"
        d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
        clip-rule="evenodd" />
    </svg>
  </span>
</label>
