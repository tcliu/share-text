<script lang="ts">
  import Button from './Button.svelte'
  import Buttons from './Buttons.svelte'
  import SelectDropdown from './SelectDropdown.svelte'
  import { LOCALES, getI18nContext, type Locale } from '$lib/i18n.svelte'
  const i18n = getI18nContext()
  import type { useAdminPreferences } from '$lib/use-admin-preferences.svelte'

  interface Props {
    preferencesState: ReturnType<typeof useAdminPreferences>
  }

  let { preferencesState }: Props = $props()

  const languageOptions = $derived([...LOCALES].map(locale => ({ value: locale.code, label: locale.label })))
  const currentLabel = $derived(
    languageOptions.find(option => option.value === preferencesState.draft.preferredLanguage)?.label ??
      i18n.t('language.label'),
  )
</script>

<div class="flex min-h-0 flex-1 flex-col gap-4">
  <div class="overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/50">
    <div class="grid items-center gap-2 p-3 md:grid-cols-[minmax(0,1fr)_minmax(6.4rem,0.25fr)]">
      <div>
        <span class="text-sm font-medium text-slate-100">{i18n.t('settings.general.preferredLanguage')}</span>
        <p class="mt-0.5 text-xs text-slate-400">{i18n.t('settings.general.preferredLanguageDescription')}</p>
      </div>
      <SelectDropdown
        buttonLabel={currentLabel}
        options={languageOptions}
        activeValue={preferencesState.draft.preferredLanguage}
        ariaLabel={i18n.t('settings.general.preferredLanguage')}
        onSelect={value => preferencesState.setPreferredLanguage(value as Locale)} />
    </div>
  </div>
  <Buttons align="right">
    {#snippet children()}
      <Button
        variant="primary"
        accent="cyan"
        disabled={!preferencesState.hasUnsavedChanges || preferencesState.pending}
        pending={preferencesState.pending}
        onClick={() => void preferencesState.apply()}>
        {i18n.t('common.apply')}
      </Button>
      <Button disabled={preferencesState.pending} onClick={() => void preferencesState.reload()}>{i18n.t('common.reload')}</Button>
      <Button
        disabled={preferencesState.pending || !preferencesState.hasUnsavedChanges}
        onClick={() => preferencesState.resetDraft()}>
        {i18n.t('common.reset')}
      </Button>
    {/snippet}
  </Buttons>
</div>
