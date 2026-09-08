import { toast } from 'svelte-sonner'
import type { Locale } from './i18n.svelte'
import { getI18nContext } from './i18n.svelte'
import {
  fetchAdminPreferences,
  saveAdminPreferences,
  type AdminPreferences,
} from './admin-preferences'

export function useAdminPreferences(onSignedOut: () => void) {
  const i18n = getI18nContext()
  let saved = $state<AdminPreferences | null>(null)
  let draft = $state<AdminPreferences>({ preferredLanguage: 'en' })
  let pending = $state(false)

  const hasUnsavedChanges = $derived(saved !== null && draft.preferredLanguage !== saved.preferredLanguage)

  function handleError(error: unknown, fallback: string) {
    if (error instanceof Error && error.message === 'Admin authentication required') {
      onSignedOut()
      return true
    }
    toast.error(error instanceof Error ? error.message : fallback)
    return false
  }

  async function load() {
    try {
      const preferences = await fetchAdminPreferences()
      saved = preferences
      draft = { preferredLanguage: preferences.preferredLanguage }
      i18n.setLocale(preferences.preferredLanguage)
      return true
    } catch (error) {
      handleError(error, i18n.t('settings.toast.loadFailed'))
      return false
    }
  }

  async function apply() {
    if (!saved || !hasUnsavedChanges) {
      return
    }
    pending = true
    try {
      const updated = await saveAdminPreferences(draft)
      saved = updated
      draft = { preferredLanguage: updated.preferredLanguage }
      i18n.setLocale(updated.preferredLanguage)
      toast.success(i18n.t('settings.toast.saved'))
    } catch (error) {
      handleError(error, i18n.t('settings.toast.saveFailed'))
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

  function reset() {
    saved = null
    draft = { preferredLanguage: 'en' }
    pending = false
  }

  function setPreferredLanguage(locale: Locale) {
    draft = { preferredLanguage: locale }
  }

  return {
    get draft() {
      return draft
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
    reset,
    setPreferredLanguage,
  }
}
