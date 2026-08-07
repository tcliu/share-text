<script lang="ts">
  import Self from './StructureNode.svelte'
  import Copyable from './Copyable.svelte'
  import {
    type StructureEntry,
    childEntries,
    containerSummary,
    copyValue,
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
  const startsOpen = depth === 0
  let open = $state(startsOpen)

  const entries = $derived(childEntries(value))
</script>

<div class="font-mono text-sm leading-snug">
  <div class="flex items-center gap-1 rounded px-1 py-px hover:bg-slate-800/40">
    <button
      type="button"
      class="inline-flex h-3.5 w-3 shrink-0 items-center justify-center"
      aria-label={open ? `Collapse ${label}` : `Expand ${label}`}
      onclick={() => (open = !open)}
    >
      <svg
        class="h-3 w-3 text-slate-500 transition-transform {open ? 'rotate-90' : ''}"
        viewBox="0 0 12 12"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M4 2l4 4-4 4z" />
      </svg>
    </button>
    <Copyable
      copyText={copyValue(value)}
      copyAriaLabel={label ? `Copy ${label}` : 'Copy node'}
      copyTooltip={label ? `Copy ${label}` : 'Copy node'}
    >
      {#if label !== ''}
        <span class="text-slate-300">{label}</span>
        <span class="text-slate-600">:</span>
      {/if}
      <span class="text-slate-500">{containerSummary(value)}</span>
    </Copyable>
  </div>

  {#if open}
    <div class="ml-[0.3rem] border-l border-slate-800 pl-2">
      {#each entries as entry (entry.key)}
        {#if isContainer(entry.value)}
          <Self label={entry.key} value={entry.value as object | unknown[]} depth={depth + 1} />
        {:else}
          <div class="flex items-center gap-1 rounded px-1 py-px hover:bg-slate-800/40">
            <span class="w-3 shrink-0"></span>
            <Copyable
              copyText={copyValue(entry.value)}
              copyAriaLabel={`Copy ${entry.key}`}
              copyTooltip={`Copy ${entry.key}`}
            >
              <span class="text-slate-300">{entry.key}</span>
              <span class="text-slate-600">:</span>
              <span class={valueClass(entry.value)}>{valueText(entry.value)}</span>
            </Copyable>
          </div>
        {/if}
      {/each}
    </div>
  {/if}
</div>
