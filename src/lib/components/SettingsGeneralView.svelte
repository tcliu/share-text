<script lang="ts">
  import SelectDropdown from './SelectDropdown.svelte'
  import { LOCALES, getI18nContext, type Locale } from '$lib/i18n.svelte'
  const i18n = getI18nContext()
  import type { useUserSettings } from '$lib/use-user-settings.svelte'

  interface Props {
    settingsState: ReturnType<typeof useUserSettings>
  }

  let { settingsState }: Props = $props()

  const languageOptions = $derived(
    [...LOCALES].map(locale => ({ value: locale.code, label: locale.label })),
  )

  const currentLabel = $derived(
    languageOptions.find(option => option.value === settingsState.draft.preferredLanguage)?.label ??
      i18n.t('language.label'),
  )
</script>

<div class="overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/50">
  <div class="grid items-center gap-2 p-3 md:grid-cols-[minmax(0,1fr)_minmax(6.4rem,0.25fr)]">
    <div>
      <span class="text-sm font-medium text-slate-100">{i18n.t('settings.general.preferredLanguage')}</span>
      <p class="mt-0.5 text-xs text-slate-400">{i18n.t('settings.general.preferredLanguageDescription')}</p>
    </div>
    <SelectDropdown
      buttonLabel={currentLabel}
      options={languageOptions}
      activeValue={settingsState.draft.preferredLanguage}
      ariaLabel={i18n.t('settings.general.preferredLanguage')}
      onSelect={value => settingsState.setPreferredLanguage(value as Locale)}
      emptyLabel={i18n.t('dropdown.noOptions')} />
  </div>
</div>