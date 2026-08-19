<script lang="ts">
  import { toast } from 'svelte-sonner'
  import SettingsVoiceField from './SettingsVoiceField.svelte'
  import Spinner from './Spinner.svelte'
  import Tabs from './Tabs.svelte'
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

{#snippet voicesContent()}
  <div class="overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/50">
    {#if !capabilities?.configured}
      <div class="p-3">
        <p class="text-xs text-amber-300">{t('settings.readAloud.notConfigured')}</p>
      </div>
    {/if}
    {#if voiceLangs.length > 0}
      {#each voiceLangs as { lang, voices }, i}
        <div class={i > 0 || !capabilities?.configured ? 'border-t border-slate-800' : ''}>
          <SettingsVoiceField
            lang={lang}
            langLabel={ttsLanguageLabel(lang)}
            voices={voices}
            activeValue={settingsState.draft.ttsVoices[lang] ?? ''}
            defaultVoice={capabilities?.defaultVoices[lang] ?? null}
            onSelect={value => settingsState.setTtsVoice(lang, value || null)} />
        </div>
      {/each}
    {/if}
  </div>
{/snippet}

{#if loading}
  <div class="flex h-full items-center justify-center">
    <Spinner className="h-6 w-6" />
  </div>
{:else}
  <Tabs tabs={[{ label: t('settings.readAloud.title'), path: 'voices', content: voicesContent }]} state={{}} ariaLabel={t('settings.readAloud.title')} />
{/if}
