<script lang="ts">
  import Menu, { type MenuItemState } from './Menu.svelte'
  import { LOCALES, getI18nContext } from '$lib/i18n.svelte'
  import GlobeIcon from '$lib/icons/GlobeIcon.svelte'

  const i18n = getI18nContext()

  interface Props {
    align?: 'left' | 'right'
    autoPlace?: boolean
  }

  type LocaleOption = (typeof LOCALES)[number]

  let { align = 'left', autoPlace = true }: Props = $props()

  function itemClass(option: LocaleOption, state: MenuItemState): string {
    const checked = i18n.locale === option.code
    return `flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm outline-none transition ${
      checked ? 'bg-cyan-500/15 text-cyan-200' : state.active ? 'bg-slate-800 text-cyan-200' : 'text-slate-300'
    }`
  }
</script>

<Menu
  items={[...LOCALES]}
  itemKey={option => option.code}
  onSelect={index => i18n.setLocale(LOCALES[index].code)}
  ariaLabel={i18n.t('language.label')}
  {align}
  {autoPlace}
  itemRole="menuitemradio"
  itemChecked={option => i18n.locale === option.code}
  triggerClass="h-8 w-8"
  panelClass="w-40"
  {itemClass}>
  {#snippet icon()}
    <GlobeIcon className="h-4 w-4" />
  {/snippet}
  {#snippet item(option: LocaleOption, _state: MenuItemState)}
    <span>{option.label}</span>
    {#if i18n.locale === option.code}
      <span class="h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400"></span>
    {/if}
  {/snippet}
</Menu>