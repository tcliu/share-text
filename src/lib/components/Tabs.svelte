<script lang="ts" generics="TState">
  import type { Snippet } from 'svelte'

  export interface Tab<TState> {
    label: string
    path: string
    toolbar: Snippet<[TState]>
    content: Snippet<[TState]>
  }

  interface Props<TState> {
    tabs: Tab<TState>[]
    state: TState
    pathname: string
    ariaLabel?: string
  }

  let { tabs, state, pathname, ariaLabel = 'Tabs' }: Props<TState> = $props()

  const activeTab = $derived(tabs.find(tab => tab.path === pathname) ?? tabs[0])
</script>

<div class="flex min-h-0 flex-1 flex-col gap-3">
  <div class="flex items-center justify-between">
    <nav aria-label={ariaLabel} class="inline-flex rounded-xl border border-slate-700 bg-slate-950 p-1">
      {#each tabs as tab}
        <a
          href={tab.path}
          aria-current={tab.path === pathname ? 'page' : undefined}
          class={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${tab.path === pathname ? 'bg-cyan-500 text-slate-950' : 'text-slate-300 hover:text-cyan-300'}`}>
          {tab.label}
        </a>
      {/each}
    </nav>
    {#if activeTab}
      <div class="flex items-center gap-2">
        {@render activeTab.toolbar(state)}
      </div>
    {/if}
  </div>
  {#if activeTab}
    <div class="min-h-0 flex-1">
      {@render activeTab.content(state)}
    </div>
  {/if}
</div>
