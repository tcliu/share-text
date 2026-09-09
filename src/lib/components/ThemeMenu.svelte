<script lang="ts">
  import Menu, { type MenuItemState } from './Menu.svelte'
  import { THEME_ICONS, THEME_MENU_OPTIONS } from '$lib/page/theme'
  import { useTheme, type UiTheme } from '$lib/use-theme.svelte'
  import { getI18nContext } from '$lib/i18n.svelte'
  import PaletteIcon from '$lib/icons/PaletteIcon.svelte'

  const i18n = getI18nContext()
  const themeState = useTheme()

  interface Props {
    align?: 'left' | 'right'
    autoPlace?: boolean
  }

  let { align = 'left', autoPlace = true }: Props = $props()

  const themeLabels = $derived<Record<UiTheme, string>>({
    dark: i18n.t('theme.dark'),
    ember: i18n.t('theme.ember'),
    forest: i18n.t('theme.forest'),
    midnight: i18n.t('theme.midnight'),
    nebula: i18n.t('theme.nebula'),
    light: i18n.t('theme.light'),
    mint: i18n.t('theme.mint'),
    sepia: i18n.t('theme.sepia'),
    lavender: i18n.t('theme.lavender'),
    sky: i18n.t('theme.sky'),
  })

  const themeOptions = $derived(
    THEME_MENU_OPTIONS.map(option => ({
      value: option.value,
      label: themeLabels[option.value],
      icon: THEME_ICONS[option.value],
    })),
  )

  type ThemeOption = (typeof themeOptions)[number]

  function itemClass(option: ThemeOption, state: MenuItemState): string {
    return `flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm outline-none transition-none ${
      state.disabled
        ? 'cursor-not-allowed text-slate-600'
        : state.active
          ? 'bg-slate-800 text-cyan-200'
          : option.value === themeState.theme
            ? 'text-cyan-200'
            : 'text-slate-300'
    }`
  }
</script>

<Menu
  items={themeOptions}
  itemKey={option => option.value}
  onSelect={index => themeState.setTheme(themeOptions[index].value)}
  ariaLabel={i18n.t('theme.label')}
  {align}
  {autoPlace}
  itemRole="menuitemradio"
  itemChecked={option => option.value === themeState.theme}
  triggerClass="p-1.5 relative before:absolute before:-inset-1.5 before:content-['']"
  phoneSheetTitle={i18n.t('theme.label')}
  closeLabel={i18n.t('common.close')}
  {itemClass}>
  {#snippet icon()}
    <PaletteIcon className="h-4 w-4" />
  {/snippet}
  {#snippet item(option: ThemeOption, _state: MenuItemState)}
    {@const OptionIcon = option.icon}
    <OptionIcon className="h-4 w-4 shrink-0" />
    <span>{option.label}</span>
  {/snippet}
</Menu>
