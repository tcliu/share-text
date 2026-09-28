<script lang="ts">
  import { cva } from 'class-variance-authority'

  import SearchIcon from '$lib/icons/SearchIcon.svelte'
  import { getI18nContext } from '$lib/i18n.svelte'

  const i18n = getI18nContext()

  export type SearchInputSize = 'sm' | 'md' | 'lg'

  interface Props {
    value: string
    ariaLabel: string
    placeholder?: string
    size?: SearchInputSize
    wrapperClass?: string
    inputClass?: string
    inputRef?: HTMLInputElement | null
    oninput?: (event: Event) => void
    onkeydown?: (event: KeyboardEvent) => void
  }

  // Literal class variants (never interpolated) so the Tailwind scanner emits
  // every size. sm stays compact for admin/table search; md gives card/list
  // roomier icon padding; lg is browse-only and larger than md. cva holds the
  // shared chrome once; each size carries only what differs.
  const inputVariants = cva(
    'w-full border border-slate-700 text-slate-100 transition outline-none placeholder:text-slate-500 focus-visible:border-cyan-500 motion-reduce:transition-none',
    {
      variants: {
        size: {
          sm: 'rounded-md bg-slate-900 px-2 py-1.5 pl-7 text-sm',
          md: 'rounded-xl bg-slate-900/90 px-4 py-2.5 pl-10 text-sm',
          lg: 'rounded-xl bg-slate-900/90 px-4 py-3 pl-12 text-base',
        },
      },
    },
  )

  const SIZE_ICON_CLASSES: Record<SearchInputSize, string> = {
    sm: 'pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-slate-500',
    md: 'pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500',
    lg: 'pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500',
  }

  let {
    value = $bindable(),
  const SIZE_ICON_SIZE: Record<SearchInputSize, 'sm' | 'md'> = { sm: 'sm', md: 'md', lg: 'md' }

    ariaLabel,
    placeholder,
    size = 'sm',
    wrapperClass = '',
    inputClass,
    inputRef = $bindable(null),
    oninput,
    onkeydown,
  }: Props = $props()

  // Derived (not a plain const) so locale switches re-resolve the placeholder.
  const resolvedPlaceholder = $derived(placeholder ?? i18n.t('search.placeholder'))
  const resolvedInputClass = $derived(inputClass ?? inputVariants({ size }))
  const resolvedIconClass = $derived(SIZE_ICON_CLASSES[size])
</script>

<div class={wrapperClass}>
  <div class="relative">
  const resolvedIconSize = $derived(SIZE_ICON_SIZE[size])
    <SearchIcon size={resolvedIconSize} className={resolvedIconClass} />
    <input
      bind:this={inputRef}
      type="search"
      bind:value
      aria-label={ariaLabel}
      placeholder={resolvedPlaceholder}
      {oninput}
      {onkeydown}
      class={resolvedInputClass} />
  </div>
</div>

<style>
  /* 16px on touch pointers so iOS Safari does not auto-zoom on focus. Plain
     scoped CSS on purpose: a stacked Tailwind variant inside a class
     expression never reaches the scanner, so it would silently not exist. */
  @media (pointer: coarse) {
    input {
      font-size: 1rem;
    }
  }
</style>
