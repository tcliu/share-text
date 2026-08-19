<script lang="ts">
  import { toast } from 'svelte-sonner'
  import SettingsVoiceField from './SettingsVoiceField.svelte'
  import Spinner from './Spinner.svelte'
  import { loadTtsCapabilities, type TtsCapabilities } from '$lib/tts-client'
  import { ttsLanguageLabel } from '$lib/tts-language'
  import { t } from '$lib/i18n.svelte'
  import type { useUserSettings } from '$lib/use-user-settings.svelte'

  interface Props {
    settingsState: ReturnType<typeof useUserSettings>
  }

  let { settingsState }: Props = $props()

  let capabilities = $state<TtsCapabilities | null>(null)
  let loading = $state(true)

  const voiceLangs = $derived.by(() => {
    if (!capabilities) return []
    return Object.entries(capabilities.voices)
      .filter(([, voices]) => voices.length > 0)
      .map(([lang, voices]) => ({ lang, voices }))
  })

  $effect(() => {
    let cancelled = false
    loading = true
    void loadTtsCapabilities()
      .then(caps => {
        if (!cancelled) capabilities = caps
      })
      .catch(() => {
        if (!cancelled) toast.error(t('settings.readAloud.loadFailed'))
      })
      .finally(() => {
        if (!cancelled) loading = false
      })
    return () => {
      cancelled = true
    }
  })
</script>

{#if loading}
  <div class="flex h-full items-center justify-center">
    <Spinner className="h-6 w-6" />
  </div>
{:else if !capabilities?.configured || voiceLangs.length === 0}
  <div class="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
    <p class="text-sm text-slate-400">{t('settings.readAloud.notConfigured')}</p>
  </div>
{:else}
  <div class="overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/50">
    <div class="border-b border-slate-800 p-3">
      <h2 class="text-sm font-medium text-slate-100">{t('settings.readAloud.title')}</h2>
      <p class="mt-0.5 text-xs text-slate-400">{t('settings.readAloud.description')}</p>
    </div>
    {#each voiceLangs as { lang, voices }, i}
      <div class={i > 0 ? 'border-t border-slate-800' : ''}>
        <SettingsVoiceField
          lang={lang}
          langLabel={ttsLanguageLabel(lang)}
          voices={voices}
          activeValue={settingsState.draft.ttsVoices[lang] ?? ''}
          onSelect={value => settingsState.setTtsVoice(lang, value || null)} />
      </div>
    {/each}
  </div>
{/if}