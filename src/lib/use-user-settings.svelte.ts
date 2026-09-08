import { toast } from 'svelte-sonner'
import type { Locale, MessageKey } from './i18n.svelte'
import { getI18nContext } from './i18n.svelte'
import {
  fetchUserPreferences,
  saveUserPreferences,
  UserSettingsAuthError,
  type UserPreferences,
} from './user-settings'

export function useUserSettings(onSignedOut: () => void) {
  const i18n = getI18nContext()
  let saved = $state<UserPreferences | null>(null)
  let draft = $state<UserPreferences>({ preferredLanguage: 'en' })
  let loading = $state(false)
  let pending = $state(false)

  const hasUnsavedChanges = $derived(
    saved !== null && draft.preferredLanguage !== saved.preferredLanguage,
  )


  function handleError(error: unknown, fallbackKey: MessageKey): boolean {
    if (error instanceof UserSettingsAuthError) {
      onSignedOut()
      return true
    }
    toast.error(error instanceof Error ? error.message : i18n.t(fallbackKey))
    return false
  }

  async function load() {
    loading = true
    try {
      const preferences = await fetchUserPreferences()
      saved = preferences
      draft = { preferredLanguage: preferences.preferredLanguage }
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
      draft = { preferredLanguage: updated.preferredLanguage }
      toast.success(i18n.t('settings.toast.saved'))
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
      draft = { preferredLanguage: saved.preferredLanguage }
    }
  }

  function setPreferredLanguage(locale: Locale) {
    draft = { ...draft, preferredLanguage: locale }
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
  }
}
