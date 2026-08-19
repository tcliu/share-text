import { toast } from 'svelte-sonner'
import type { Locale, MessageKey } from './i18n.svelte'
import { t } from './i18n.svelte'
import {
  fetchUserPreferences,
  saveUserPreferences,
  UserSettingsAuthError,
  type UserPreferences,
} from './user-settings'

export function useUserSettings(onSignedOut: () => void) {
  let saved = $state<UserPreferences | null>(null)
  let draft = $state<UserPreferences>({ preferredLanguage: 'en', ttsVoices: {} })
  let loading = $state(false)
  let pending = $state(false)

  const hasUnsavedChanges = $derived(
    saved !== null &&
      (draft.preferredLanguage !== saved.preferredLanguage ||
        !ttsVoicesEqual(draft.ttsVoices, saved.ttsVoices)),
  )

  function ttsVoicesEqual(a: Record<string, string>, b: Record<string, string>): boolean {
    const aKeys = Object.keys(a)
    if (aKeys.length !== Object.keys(b).length) return false
    return aKeys.every(key => a[key] === b[key])
  }

  function handleError(error: unknown, fallbackKey: MessageKey): boolean {
    if (error instanceof UserSettingsAuthError) {
      onSignedOut()
      return true
    }
    toast.error(error instanceof Error ? error.message : t(fallbackKey))
    return false
  }

  async function load() {
    loading = true
    try {
      const preferences = await fetchUserPreferences()
      saved = preferences
      draft = { preferredLanguage: preferences.preferredLanguage, ttsVoices: { ...preferences.ttsVoices } }
      return true
    } catch (error) {
      handleError(error, 'settings.toast.loadFailed')
      return false
    } finally {
      loading = false
    }
  }

  async function apply() {
    if (!saved || !hasUnsavedChanges) return
    pending = true
    try {
      const updated = await saveUserPreferences(draft)
      saved = updated
      draft = { preferredLanguage: updated.preferredLanguage, ttsVoices: { ...updated.ttsVoices } }
      toast.success(t('settings.toast.saved'))
    } catch (error) {
      handleError(error, 'settings.toast.saveFailed')
    } finally {
      pending = false
    }
  }

  async function reload() {
    pending = true
    try {
      await load()
    } finally {
      pending = false
    }
  }

  function resetDraft() {
    if (saved) {
      draft = { preferredLanguage: saved.preferredLanguage, ttsVoices: { ...saved.ttsVoices } }
    }
  }

  function setPreferredLanguage(locale: Locale) {
    draft = { ...draft, preferredLanguage: locale }
  }

  function setTtsVoice(lang: string, voice: string | null) {
    const next = { ...draft.ttsVoices }
    if (voice) {
      next[lang] = voice
    } else {
      delete next[lang]
    }
    draft = { ...draft, ttsVoices: next }
  }

  return {
    get saved() {
      return saved
    },
    get draft() {
      return draft
    },
    get loading() {
      return loading
    },
    get pending() {
      return pending
    },
    get hasUnsavedChanges() {
      return hasUnsavedChanges
    },
    load,
    apply,
    reload,
    resetDraft,
    setPreferredLanguage,
    setTtsVoice,
  }
}
