<script lang="ts">
  import type { Snippet } from 'svelte'
  import Spinner from './Spinner.svelte'
  import Tooltip from './Tooltip.svelte'

  interface Props {
    variant?: 'primary' | 'secondary' | 'danger' | 'outline' | 'ghost'
    accent?: 'cyan' | 'emerald' | 'amber' | 'violet' | 'rose'
    size?: 'sm' | 'md'
    disabled?: boolean
    pending?: boolean
    type?: 'button' | 'submit' | 'reset'
    className?: string
    onClick?: (event: MouseEvent) => void
    onKeyDown?: (event: KeyboardEvent) => void
    ariaLabel?: string
    tooltip?: string
    tooltipAlign?: 'center' | 'left' | 'right'
    icon?: Snippet
    children?: Snippet
  }

  let {
    variant = 'secondary',
    accent = 'cyan',
    size = 'md',
    disabled = false,
    pending = false,
    type = 'button',
    className = '',
    onClick,
    onKeyDown,
    ariaLabel,
    tooltip,
    tooltipAlign = 'center',
    icon,
    children,
  }: Props = $props()

  const primaryClasses: Record<string, string> = {
    cyan: 'bg-cyan-500 text-slate-950 hover:bg-cyan-400',
    emerald: 'bg-emerald-500 text-slate-950 hover:bg-emerald-400',
    amber: 'bg-amber-500 text-slate-950 hover:bg-amber-400',
    violet: 'bg-violet-500 text-slate-950 hover:bg-violet-400',
    rose: 'bg-rose-500 text-slate-950 hover:bg-rose-400',
  }

  const outlineClasses: Record<string, string> = {
    cyan: 'border border-cyan-500/40 bg-cyan-500/10 text-cyan-200 hover:border-cyan-400 hover:text-cyan-100',
    emerald:
      'border border-emerald-500/40 bg-emerald-500/10 text-emerald-200 hover:border-emerald-400 hover:text-emerald-100',
    amber: 'border border-amber-500/40 bg-amber-500/10 text-amber-200 hover:border-amber-400 hover:text-amber-100',
    violet:
      'border border-violet-500/40 bg-violet-500/10 text-violet-200 hover:border-violet-400 hover:text-violet-100',
    rose: 'border border-rose-500/40 bg-rose-500/10 text-rose-200 hover:border-rose-400 hover:text-rose-100',
  }

  const iconSizeClass = $derived(size === 'sm' ? 'h-4 w-4' : 'h-5 w-5')

  const baseClass = $derived.by(() => {
    const common = `${size === 'sm' ? 'inline-flex h-8 w-8 items-center justify-center rounded-md' : 'inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold'} transition disabled:cursor-not-allowed disabled:opacity-40`
    if (variant === 'primary') {
      return `${common} ${primaryClasses[accent]}`
    }
    if (variant === 'danger') {
      return `${common} bg-rose-500 text-slate-950 hover:bg-rose-400`
    }
    if (variant === 'outline') {
      return `${common} ${outlineClasses[accent]}`
    }
    if (variant === 'ghost') {
      return `${common}`
    }
    if (size === 'sm') {
      return `${common} border border-slate-700 bg-slate-950 text-slate-200 hover:border-cyan-500 hover:text-cyan-300`
    }
    return `${common} border border-slate-700 bg-slate-950 hover:border-slate-500 hover:text-slate-100`
  })
</script>

{#snippet buttonInner()}
  {#if pending}
    <span class="inline-flex items-center gap-2">
      <Spinner className="h-4 w-4" />
      {#if icon}<span class={`${iconSizeClass} [&_svg]:h-full [&_svg]:w-full`}>{@render icon()}</span>{/if}
      {@render children?.()}
    </span>
  {:else if icon}
    <span class="inline-flex items-center gap-2">
      <span class={`${iconSizeClass} [&_svg]:h-full [&_svg]:w-full`}>{@render icon()}</span>
      {@render children?.()}
    </span>
  {:else}
    {@render children?.()}
  {/if}
{/snippet}

{#if tooltip}
  <span class="group relative inline-flex">
    <button {type} aria-label={ariaLabel} onclick={onClick} onkeydown={onKeyDown} {disabled} class={`${baseClass} ${className}`}>
      {@render buttonInner()}
    </button>
    <Tooltip align={tooltipAlign}>{tooltip}</Tooltip>
  </span>
{:else}
  <button {type} aria-label={ariaLabel} onclick={onClick} onkeydown={onKeyDown} {disabled} class={`${baseClass} ${className}`}>
    {@render buttonInner()}
  </button>
{/if}