import { toast } from 'svelte-sonner'
import {
  deleteAdminTtsVoice,
  fetchAdminTtsVoices,
  saveAdminTtsDefaultVoices,
  uploadAdminTtsVoice,
  type AdminTtsVoicesState,
} from './admin'
import { t } from './i18n.svelte'
import { clearCapabilitiesCache, clearSynthesisCache } from './tts-client'

function equalRecord(a: Record<string, string>, b: Record<string, string>) {
  const aKeys = Object.keys(a)
  if (aKeys.length !== Object.keys(b).length) return false
  return aKeys.every(key => a[key] === b[key])
}

export function useAdminTtsVoices(onSignedOut: () => void) {
  let loaded = $state(false)
  let loading = $state(false)
  let pending = $state(false)
  let actionPendingKey = $state('')
  let configured = $state(false)
  let languages = $state<string[]>([])
  let voices = $state<Record<string, string[]>>({})
  let savedDefaults = $state<Record<string, string>>({})
  let draftDefaults = $state<Record<string, string>>({})

  const hasUnsavedChanges = $derived(!equalRecord(savedDefaults, draftDefaults))

  function handleError(error: unknown, fallback: string) {
    if (error instanceof Error && error.message === 'Admin authentication required') {
      onSignedOut()
      return true
    }
    toast.error(error instanceof Error ? error.message : fallback)
    return false
  }

  function applyState(state: AdminTtsVoicesState) {
    configured = state.configured
    languages = [...state.languages]
    voices = Object.fromEntries(Object.entries(state.voices).map(([lang, items]) => [lang, [...items]]))
    savedDefaults = { ...state.defaultVoices }
    draftDefaults = { ...state.defaultVoices }
    loaded = true
  }

  function clearTtsCaches() {
    clearCapabilitiesCache()
    clearSynthesisCache()
  }

  async function load() {
    loading = true
    try {
      applyState(await fetchAdminTtsVoices())
      return true
    } catch (error) {
      handleError(error, t('admin.auth.toast.loadTtsVoices'))
      return false
    } finally {
      loading = false
    }
  }

  async function apply() {
    if (!loaded || !hasUnsavedChanges) return
    pending = true
    try {
      const payload = Object.fromEntries(languages.map(lang => [lang, draftDefaults[lang] ?? null]))
      applyState(await saveAdminTtsDefaultVoices(payload))
      clearTtsCaches()
      toast.success(t('admin.tts.defaultSaved'))
    } catch (error) {
      handleError(error, t('admin.auth.toast.saveTtsVoices'))
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
    draftDefaults = { ...savedDefaults }
  }

  function reset() {
    loaded = false
    loading = false
    pending = false
    actionPendingKey = ''
    configured = false
    languages = []
    voices = {}
    savedDefaults = {}
    draftDefaults = {}
  }

  function setDefaultVoice(lang: string, voice: string | null) {
    const next = { ...draftDefaults }
    if (voice) {
      next[lang] = voice
    } else {
      delete next[lang]
    }
    draftDefaults = next
  }

  async function upload(lang: string, model: File, config: File) {
    actionPendingKey = `upload:${lang}`
    try {
      applyState(await uploadAdminTtsVoice(lang, model, config))
      clearTtsCaches()
      toast.success(t('admin.tts.uploaded'))
      return true
    } catch (error) {
      handleError(error, t('admin.auth.toast.uploadTtsVoice'))
      return false
    } finally {
      actionPendingKey = ''
    }
  }

  async function remove(lang: string, voice: string) {
    actionPendingKey = `remove:${lang}:${voice}`
    try {
      applyState(await deleteAdminTtsVoice(lang, voice))
      clearTtsCaches()
      toast.success(t('admin.tts.deleted'))
      return true
    } catch (error) {
      handleError(error, t('admin.auth.toast.deleteTtsVoice'))
      return false
    } finally {
      actionPendingKey = ''
    }
  }

  return {
    get loaded() {
      return loaded
    },
    get loading() {
      return loading
    },
    get pending() {
      return pending
    },
    get actionPendingKey() {
      return actionPendingKey
    },
    get configured() {
      return configured
    },
    get languages() {
      return languages
    },
    get voices() {
      return voices
    },
    get draftDefaults() {
      return draftDefaults
    },
    get hasUnsavedChanges() {
      return hasUnsavedChanges
    },
    load,
    apply,
    reload,
    resetDraft,
    reset,
    setDefaultVoice,
    upload,
    remove,
  }
}
