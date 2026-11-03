import MoonIcon from '@codepg/ui-lib/icons/MoonIcon.svelte'
import FireIcon from '@codepg/ui-lib/icons/FireIcon.svelte'
import ForestIcon from '@codepg/ui-lib/icons/ForestIcon.svelte'
import MidnightIcon from '@codepg/ui-lib/icons/MidnightIcon.svelte'
import SparklesIcon from '@codepg/ui-lib/icons/SparklesIcon.svelte'
import SunIcon from '@codepg/ui-lib/icons/SunIcon.svelte'
import MintIcon from '@codepg/ui-lib/icons/MintIcon.svelte'
import LightBulbIcon from '@codepg/ui-lib/icons/LightBulbIcon.svelte'
import LavenderIcon from '@codepg/ui-lib/icons/LavenderIcon.svelte'
import CloudIcon from '@codepg/ui-lib/icons/CloudIcon.svelte'
import type { UiTheme } from '#lib/use-theme.svelte.js'

export const THEME_MENU_OPTIONS: { value: UiTheme }[] = [
  { value: 'dark' },
  { value: 'ember' },
  { value: 'forest' },
  { value: 'midnight' },
  { value: 'nebula' },
  { value: 'light' },
  { value: 'mint' },
  { value: 'sepia' },
  { value: 'lavender' },
  { value: 'sky' },
]

export const THEME_ICONS: Record<UiTheme, typeof MoonIcon> = {
  dark: MoonIcon,
  ember: FireIcon,
  forest: ForestIcon,
  midnight: MidnightIcon,
  nebula: SparklesIcon,
  light: SunIcon,
  mint: MintIcon,
  sepia: LightBulbIcon,
  lavender: LavenderIcon,
  sky: CloudIcon,
}
