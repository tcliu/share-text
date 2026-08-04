<script lang="ts">
  interface Props {
    value: string
    ariaLabel: string
    placeholder?: string
    wrapperClass?: string
    inputClass?: string
    oninput?: (event: Event) => void
    onkeydown?: (event: KeyboardEvent) => void
  }

  let {
    value = $bindable(),
    ariaLabel,
    placeholder = 'Search...',
    wrapperClass = '',
    inputClass = 'w-full rounded-md border border-slate-700 bg-slate-950 p-2 pl-7 text-[13px] text-slate-200 placeholder-slate-500 outline-none transition focus:border-cyan-500',
    oninput,
    onkeydown,
  }: Props = $props()
</script>

<div class={wrapperClass}>
  <div class="relative">
    <svg
      class="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      aria-hidden="true">
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M8.5 4a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9M11.7 11.7l3.3 3.3" />
    </svg>
    <input type="search" bind:value aria-label={ariaLabel} {placeholder} {oninput} {onkeydown} class={inputClass} />
  </div>
</div>
