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
    return `flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm outline-none transition-none ${
      state.disabled
        ? 'cursor-not-allowed text-slate-600'
        : state.active
          ? 'bg-slate-800 text-cyan-200'
          : option.code === i18n.locale
            ? 'text-cyan-200'
            : 'text-slate-300'
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
  triggerClass="p-1.5 relative before:absolute before:-inset-1.5 before:content-['']"
  phoneSheetTitle={i18n.t('language.label')}
  closeLabel={i18n.t('common.close')}
  {itemClass}>
  {#snippet icon()}
    <GlobeIcon className="h-4 w-4" />
  {/snippet}
  {#snippet item(option: LocaleOption, _state: MenuItemState)}
    <span>{option.label}</span>
  {/snippet}
</Menu>
