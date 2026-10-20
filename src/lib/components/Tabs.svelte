<script lang="ts" generics="TState">
  import type { Snippet } from 'svelte'
  import { getI18nContext } from '$lib/i18n.svelte'
  import type { SizeInput } from '$lib/size-scale'
  import { dimensionMetrics, sizeVarStyle } from './size-metrics'

  const i18n = getI18nContext()

  export interface Tab<TState> {
    label: string
    path: string
    toolbar?: Snippet<[TState]>
    content: Snippet<[TState]>
  }

  interface Props<TState> {
    tabs: Tab<TState>[]
    state: TState
    pathname?: string
    ariaLabel?: string
    className?: string
    size?: SizeInput
  }

  let {
    tabs,
    state: tabState,
    pathname,
    ariaLabel,
    className = '',
    size = 'md',
  }: Props<TState> = $props()

  // Fixed ratios of the size dimension, calibrated so `md` reproduces the
  // original tab bar: a 14px label, 12/8 tab padding, an 8px tab radius, and the
  // nav's 4px padding and 12px radius.
  const TABS_RATIOS = { font: 0.875, padX: 0.75, padY: 0.5, radius: 0.5, navPad: 0.25, navRadius: 0.75 }

  const metrics = $derived(dimensionMetrics(size, TABS_RATIOS))
  const tabsStyle = $derived(sizeVarStyle('tabs', metrics))

  // Built-in header row classes; `className` appends to these.
  const HEADER_ROW_CLASS = 'sticky top-0 z-10 flex w-full flex-wrap items-center justify-between gap-2 bg-transparent pb-3'

  // Derived (not a plain const) so locale switches re-resolve the label.
  const resolvedAriaLabel = $derived(ariaLabel ?? i18n.t('tabs.label'))

  let activePath = $state('')

  const activeTab = $derived(tabs.find(tab => tab.path === (pathname ?? activePath)) ?? tabs[0])
</script>

<div class="flex min-h-0 flex-1 flex-col" style={tabsStyle}>
  <div class={`${HEADER_ROW_CLASS} ${className}`}>
    <nav aria-label={resolvedAriaLabel} class="inline-flex rounded-[var(--tabs-nav-radius)] border border-slate-700 bg-slate-950 p-[var(--tabs-nav-pad)]">
      {#each tabs as tab}
        {#if pathname !== undefined}
          <a
            href={tab.path}
            aria-current={tab.path === pathname ? 'page' : undefined}
            onclick={event => {
              if (tab.path === pathname) {
                event.preventDefault()
              }
            }}
            class={`rounded-[var(--tabs-radius)] px-[var(--tabs-pad-x)] py-[var(--tabs-pad-y)] text-[length:var(--tabs-font)] font-medium transition outline-none motion-reduce:transition-none ${tab.path === pathname ? 'bg-cyan-500 text-onaccent' : 'text-slate-300 hover:text-cyan-300 focus:text-cyan-300'}`}>
            {tab.label}
          </a>
        {:else}
          <button
            type="button"
            aria-pressed={tab.path === activeTab?.path}
            onclick={() => (activePath = tab.path)}
            class={`rounded-[var(--tabs-radius)] px-[var(--tabs-pad-x)] py-[var(--tabs-pad-y)] text-[length:var(--tabs-font)] font-medium transition outline-none motion-reduce:transition-none ${tab.path === activeTab?.path ? 'bg-cyan-500 text-onaccent' : 'text-slate-300 hover:text-cyan-300 focus:text-cyan-300'}`}>
            {tab.label}
          </button>
        {/if}
      {/each}
    </nav>
    {#if activeTab?.toolbar}
      <div class="flex items-center gap-2">
        {@render activeTab.toolbar(tabState)}
      </div>
    {/if}
  </div>
  {#if activeTab}
    <div class="flex min-h-0 flex-1 flex-col">
      {@render activeTab.content(tabState)}
    </div>
  {/if}
</div>
