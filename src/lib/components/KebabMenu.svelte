<script module lang="ts">
  import type { Snippet } from 'svelte'

  export interface KebabMenuItem {
    id: string
    label: string
    onClick: () => void
    disabled?: boolean
    icon?: Snippet
  }
</script>

<script lang="ts">
  import Menu, { type MenuItemState } from './Menu.svelte'
  import KebabIcon from '$lib/icons/KebabIcon.svelte'

  interface Props {
    items: KebabMenuItem[]
    ariaLabel?: string
    align?: 'left' | 'right'
    autoPlace?: boolean
  }

  let { items, ariaLabel = 'More actions', align = 'right', autoPlace = true }: Props = $props()

  function itemClass(item: KebabMenuItem, state: MenuItemState): string {
    return `flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm outline-none transition ${
      state.disabled
        ? 'cursor-not-allowed text-slate-600'
        : 'text-slate-300 hover:bg-slate-800 hover:text-cyan-200 focus:bg-slate-800 focus:text-cyan-200'
    }`
  }
</script>

<Menu
  {items}
  itemKey={item => item.id}
  onSelect={index => items[index].onClick()}
  {ariaLabel}
  {align}
  {autoPlace}
  triggerClass="p-2"
  panelClass="w-44"
  {itemClass}
  itemDisabled={item => item.disabled ?? false}>
  {#snippet icon()}
    <KebabIcon className="h-4 w-4" />
  {/snippet}
  {#snippet item(it: KebabMenuItem, _state: MenuItemState)}
    {#if it.icon}
      <span class="h-4 w-4 shrink-0 [&_svg]:h-full [&_svg]:w-full">{@render it.icon()}</span>
    {/if}
    {it.label}
  {/snippet}
</Menu>