<script lang="ts">
  import Self from './StructureNode.svelte'
  import {
    type StructureEntry,
    childEntries,
    containerSummary,
    isContainer,
    valueClass,
    valueText,
  } from './structure-value'

  let {
    label,
    value,
    depth = 0,
  }: { label: string; value: object | unknown[]; depth?: number } = $props()

  // svelte-ignore state_referenced_locally
  let open = $state(depth === 0)

  const entries = $derived(childEntries(value))
</script>

<div class="font-mono text-[0.8125rem] leading-relaxed">
  <button
    type="button"
    class="group flex w-full items-center gap-1.5 rounded px-1 py-0.5 text-left hover:bg-slate-800/40"
    onclick={() => (open = !open)}
  >
    <svg
      class="h-3 w-3 shrink-0 text-slate-500 transition-transform {open ? 'rotate-90' : ''}"
      viewBox="0 0 12 12"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M4 2l4 4-4 4z" />
    </svg>
    {#if label !== ''}
      <span class="text-slate-300">{label}</span>
      <span class="text-slate-600">:</span>
    {/if}
    <span class="text-slate-500">{containerSummary(value)}</span>
  </button>

  {#if open}
    <div class="ml-[0.4rem] border-l border-slate-800 pl-3">
      {#each entries as entry (entry.key)}
        {#if isContainer(entry.value)}
          <Self label={entry.key} value={entry.value as object | unknown[]} depth={depth + 1} />
        {:else}
          <div class="flex items-start gap-1.5 px-1 py-0.5">
            <span class="w-3 shrink-0"></span>
            <span class="text-slate-300">{entry.key}</span>
            <span class="text-slate-600">:</span>
            <span class={valueClass(entry.value)}>{valueText(entry.value)}</span>
          </div>
        {/if}
      {/each}
    </div>
  {/if}
</div>
