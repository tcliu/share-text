<script lang="ts">
  import { onDestroy } from 'svelte'
  import Button from './Button.svelte'
  import { SPLIT_PANE_MAX_WIDTH } from '$lib/split-pane'

  interface Props {
    text: string
    onChange: (text: string) => void
    size?: 'xs' | 'sm' | 'md' | 'lg'
    className?: string
    onActivate?: () => void
    // maximum width (in px) the editable input may expand to; actual max
    // will be clamped to the remaining horizontal space when editing.
    maxWidth?: number
  }

  let {
    text,
    onChange,
    size = 'md',
    className = 'text-slate-200',
    onActivate,
    maxWidth = SPLIT_PANE_MAX_WIDTH,
  }: Props = $props()

  let editing = $state(false)
  let value = $state('')
  let cancelled = $state(false)
  let input = $state<HTMLInputElement | null>(null)
  let displayBtn = $state<HTMLButtonElement | null>(null)
  let editBtn = $state<HTMLElement | null>(null)
  let inputWidth = $state<number | null>(null)
  let computedMaxWidth = $state<number | null>(null)
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
    // Measure the rendered label and edit-button widths so the input can
    // size to "label width + gap + edit icon width" when editing starts.
    // We measure before switching to edit mode because the display elements
    // are replaced when editing becomes true.
    try {
      const labelRect = displayBtn?.getBoundingClientRect()
      const editRect = editBtn?.getBoundingClientRect()
      const gapPx = 4 // Tailwind gap-1 is 0.25rem -> 4px at 16px root
      if (labelRect) {
        inputWidth = Math.ceil(labelRect.width + (editRect?.width ?? 0) + gapPx)
      } else {
        inputWidth = null
      }
      // Compute the remaining horizontal width so the editable input's max
      // width is the lesser of the `maxWidth` prop and available space.
      // The editable root (displayBtn's direct parent) only spans label+icon,
      // so walk up to the first ancestor with meaningful space to its right.
      try {
        let row: Element | null = displayBtn?.parentElement ?? null
        while (row && labelRect) {
          const rect = row.getBoundingClientRect()
          if (rect.right - labelRect.right >= 56) break
          row = row.parentElement
        }
        const rowRect = row?.getBoundingClientRect()
        if (labelRect && rowRect) {
          // Reserve room for sibling action buttons (e.g. delete) + padding.
          const reserved = 48
          const remaining = Math.max(0, Math.floor(rowRect.right - labelRect.left - reserved))
          computedMaxWidth = Math.min(maxWidth, remaining)
        } else {
          computedMaxWidth = maxWidth
        }
      } catch (e) {
        computedMaxWidth = maxWidth
      }
    } catch (e) {
      inputWidth = null
    }
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
  })

  // Auto-resize the input to fit its content while editing, but don't shrink
  // below the initially measured label+icon width and cap at a sensible max.
  $effect(() => {
    if (!editing || !input) return
    // Depend on value so this effect runs as the user types.
    void value
    try {
      // Temporarily collapse width to let scrollWidth reflect content width.
      input.style.width = '0px'
      const contentWidth = input.scrollWidth
      // Account for horizontal padding (px-2 -> 0.5rem each side ~= 8px at 16px root)
      const paddingExtra = 16
      const base = inputWidth ?? 0
      const max = computedMaxWidth ?? maxWidth
      const next = Math.min(max, Math.max(base, contentWidth + paddingExtra))
      input.style.width = `${next}px`
      inputWidth = next
    } catch (e) {
      // ignore measurement errors
    }
  })

  onDestroy(() => {
    if (clickTimer) clearTimeout(clickTimer)
  })
</script>

  {#if editing}
  <!-- In edit mode size the input to the measured label+icon width so
       sibling tag chips don't shift. Fallback to min-width only if we
       couldn't measure. -->
  <div class="flex min-w-0 items-center">
    <input
      bind:this={input}
      bind:value={value}
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => { e.stopPropagation(); handleKeydown(e) }}
      onblur={commit}
      data-escape-capture
      aria-label="Edit text"
      style={inputWidth ? `width: ${inputWidth}px; min-width: 0` : 'min-width: 0'}
      class={`text-${size} max-w-full rounded-md bg-slate-950 px-2 py-1 text-slate-100 outline outline-1 outline-slate-700 transition focus:outline-cyan-500`} />
  </div>
{:else}
  <!-- Don't grow to fill the available space in display mode so sibling elements
       (e.g. tag chips) sit immediately after the filename instead of being
       pushed to the right. Keep min-w-0 so truncation still works. -->
  <div class="group flex min-w-0 items-center gap-1">
    <button
      bind:this={displayBtn}
      type="button"
      class={`text-${size} min-w-0 truncate bg-transparent p-0 pl-2 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50 ${className}`}
      title="Double-click to edit"
      onclick={(e) => { e.stopPropagation(); scheduleActivate() }}
      onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') e.stopPropagation() }}
      ondblclick={handleTextDoubleClick}>
      {text}
    </button>
    <span bind:this={editBtn} class="opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
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
