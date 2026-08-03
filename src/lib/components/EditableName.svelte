<script lang="ts">
  import { onDestroy } from 'svelte'
  import Button from './Button.svelte'

  interface Props {
    name: string
    onRename: (name: string) => void
    className?: string
    fontSizeClass?: string
    onActivate?: () => void
  }

  let {
    name,
    onRename,
    className = 'text-slate-200',
    fontSizeClass = 'text-[15px]',
    onActivate,
  }: Props = $props()

  let renaming = $state(false)
  let value = $state('')
  let cancelled = $state(false)
  let input = $state<HTMLInputElement | null>(null)
  let clickTimer: ReturnType<typeof setTimeout> | null = null

  function scheduleActivate() {
    if (renaming || !onActivate) return
    clickTimer = setTimeout(() => onActivate(), 250)
  }

  function startRename() {
    if (clickTimer) {
      clearTimeout(clickTimer)
      clickTimer = null
    }
    cancelled = false
    value = name
    renaming = true
  }

  function handleNameDoubleClick(event: MouseEvent) {
    event.preventDefault()
    startRename()
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      cancelled = true
      renaming = false
    } else if (event.key === 'Enter') {
      event.preventDefault()
      commit()
    }
  }

  function commit() {
    if (cancelled) return
    const next = value.trim()
    if (!next || next === name) {
      renaming = false
      return
    }
    onRename(next)
    renaming = false
  }

  $effect(() => {
    if (!renaming) return
    input?.focus()
    input?.select()
  })

  onDestroy(() => {
    if (clickTimer) clearTimeout(clickTimer)
  })
</script>

{#if renaming}
  <input
    bind:this={input}
    bind:value={value}
    onclick={(e) => e.stopPropagation()}
    onkeydown={(e) => { e.stopPropagation(); handleKeydown(e) }}
    onblur={commit}
    aria-label="Rename document"
    class={`${fontSizeClass} min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100 outline-none transition focus:border-cyan-500`} />
{:else}
  <div class="group flex min-w-0 flex-1 items-center gap-1">
    <button
      type="button"
      class={`${fontSizeClass} min-w-0 truncate bg-transparent p-0 text-left transition hover:text-cyan-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50 ${className}`}
      title="Double-click to rename"
      onclick={(e) => { e.stopPropagation(); scheduleActivate() }}
      onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') e.stopPropagation() }}
      ondblclick={handleNameDoubleClick}>
      {name}
    </button>
    <span class="opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
<Button
        size="sm"
        variant="ghost"
        ariaLabel="Rename"
        tooltip="Rename"
        onClick={(e) => { e.stopPropagation(); startRename() }}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') e.stopPropagation() }}
        className="bg-transparent p-0 text-slate-400 hover:text-cyan-300">
        {#snippet children()}
          <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path
              d="M2.695 14.763l-1.262 3.154a.5.5 0 0 0 .65.65l3.155-1.262a3 3 0 0 0 1.417-.582L14.76 8.582a3 3 0 0 0-3.162-3.162l-8.003 9.343ZM15.344 3.91a3 3 0 0 0-3.647.647l-9.447 11.07a1 1 0 0 0 .21 1.534l1.262.248a1 1 0 0 0 1.09-.244l7.894-7.357a3 3 0 0 0 .73-3.773Z" />
          </svg>
        {/snippet}
      </Button>
    </span>
  </div>
{/if}