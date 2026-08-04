<script lang="ts">
  import { onDestroy } from 'svelte'
  import Button from './Button.svelte'

  interface Props {
    text: string
    onChange: (text: string) => void
    size?: 'sm' | 'md'
    className?: string
    onActivate?: () => void
  }

  const sizeFontClass: Record<'sm' | 'md', string> = {
    sm: 'text-[13px]',
    md: 'text-[15px]',
  }

  let {
    text,
    onChange,
    size = 'md',
    className = 'text-slate-200',
    onActivate,
  }: Props = $props()

  let editing = $state(false)
  let value = $state('')
  let cancelled = $state(false)
  let input = $state<HTMLInputElement | null>(null)
  let clickTimer: ReturnType<typeof setTimeout> | null = null

  function scheduleActivate() {
    if (editing || !onActivate) return
    clickTimer = setTimeout(() => onActivate(), 250)
  }

  function startEdit() {
    if (clickTimer) {
      clearTimeout(clickTimer)
      clickTimer = null
    }
    cancelled = false
    value = text
    editing = true
  }

  function handleTextDoubleClick(event: MouseEvent) {
    event.preventDefault()
    startEdit()
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      cancelled = true
      editing = false
    } else if (event.key === 'Enter') {
      event.preventDefault()
      commit()
    }
  }

  function commit() {
    if (cancelled) return
    const next = value.trim()
    if (!next || next === text) {
      editing = false
      return
    }
    onChange(next)
    editing = false
  }

  $effect(() => {
    if (!editing) return
    input?.focus()
    input?.select()
  })

  onDestroy(() => {
    if (clickTimer) clearTimeout(clickTimer)
  })
</script>

{#if editing}
  <input
    bind:this={input}
    bind:value={value}
    onclick={(e) => e.stopPropagation()}
    onkeydown={(e) => { e.stopPropagation(); handleKeydown(e) }}
    onblur={commit}
    data-escape-capture
    aria-label="Edit text"
    class={`${sizeFontClass[size]} min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100 outline-none transition focus:border-cyan-500`} />
{:else}
  <div class="group flex min-w-0 flex-1 items-center gap-1">
    <button
      type="button"
      class={`${sizeFontClass[size]} min-w-0 truncate bg-transparent p-0 pl-2 text-left transition hover:text-cyan-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50 ${className}`}
      title="Double-click to edit"
      onclick={(e) => { e.stopPropagation(); scheduleActivate() }}
      onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') e.stopPropagation() }}
      ondblclick={handleTextDoubleClick}>
      {text}
    </button>
    <span class="opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
      <Button
        size="sm"
        variant="ghost"
        ariaLabel="Edit"
        tooltip="Edit"
        onClick={(e) => { e.stopPropagation(); startEdit() }}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') e.stopPropagation() }}
        className="bg-transparent p-0 text-slate-400 hover:text-cyan-300">
        {#snippet icon()}
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
        {/snippet}
      </Button>
    </span>
  </div>
{/if}
