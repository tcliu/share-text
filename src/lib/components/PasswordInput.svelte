<script lang="ts">
  import type { HTMLInputAttributes } from 'svelte/elements'
  import Tooltip from './Tooltip.svelte'

  interface Props {
    value: string
    id?: string
    name?: string
    placeholder?: string
    autocomplete?: HTMLInputAttributes['autocomplete']
    disabled?: boolean
    required?: boolean
    className?: string
    oninput?: (event: Event) => void
  }

  let {
    value = $bindable(),
    id,
    name,
    placeholder,
    autocomplete = 'current-password',
    disabled = false,
    required = false,
    className = '',
    oninput,
  }: Props = $props()

  let visible = $state(false)
  let input = $state<HTMLInputElement>()

  function toggleVisibility() {
    visible = !visible
    requestAnimationFrame(() => {
      if (input) input.setSelectionRange(input.value.length, input.value.length)
    })
  }
</script>

<div class="relative">
  <input
    {id}
    bind:this={input}
    bind:value
    {name}
    {placeholder}
    {autocomplete}
    {disabled}
    {required}
    type={visible ? 'text' : 'password'}
    {oninput}
    class="w-full rounded-lg border border-slate-700 bg-slate-950 py-2 pr-12 pl-3 text-sm text-slate-100 outline-none transition focus:border-cyan-500 disabled:opacity-40 {className}" />
  <button
    onclick={toggleVisibility}
    aria-label={visible ? 'Hide password' : 'Show password'}
    type="button"
    {disabled}
    class="absolute inset-y-0 right-1 my-1 inline-flex w-9 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-800 hover:text-cyan-300 disabled:cursor-not-allowed disabled:opacity-40">
    {#if visible}
      <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path
          d="M3.28 2.22a.75.75 0 0 0-1.06 1.06l1.845 1.845A8.977 8.977 0 0 0 1.6 9.697a1 1 0 0 0 0 .606 8.02 8.02 0 0 0 12.513 4.152l2.607 2.607a.75.75 0 1 0 1.06-1.06l-14.5-14.5Zm7.63 7.63a2.75 2.75 0 0 1-3.76-3.76l3.76 3.76Zm2.128 2.128A6.52 6.52 0 0 1 3.1 10a7.49 7.49 0 0 1 2.04-3.205l1.036 1.036a4.25 4.25 0 0 0 6 6l.862.862Zm1.822-1.822-1.03-1.03a4.25 4.25 0 0 0-5.956-5.956l-1.03-1.03A8.018 8.018 0 0 1 18.4 9.697a1 1 0 0 1 0 .606 7.934 7.934 0 0 1-3.54 3.853Z" />
      </svg>
    {:else}
      <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path
          d="M1.6 10.303a1 1 0 0 1 0-.606 8.02 8.02 0 0 1 14.8-1.98.75.75 0 1 1-1.298.752 6.52 6.52 0 0 0-12.002 1.531 6.52 6.52 0 0 0 12.002 1.531.75.75 0 0 1 1.298.752 8.02 8.02 0 0 1-14.8-1.98Z" />
        <path d="M10 7.25a2.75 2.75 0 1 0 0 5.5 2.75 2.75 0 0 0 0-5.5Z" />
      </svg>
    {/if}
    <Tooltip>{visible ? 'Hide password' : 'Show password'}</Tooltip>
  </button>
</div>
