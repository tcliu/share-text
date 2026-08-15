import { toast } from 'svelte-sonner'
import { AdminAuthError, fetchAdminSettings, resetAdminSetting, updateAdminSettings, type AdminSetting } from '$lib/admin'
import { parseProperties } from '$lib/document-type-utils'

export function useAdminSettings(onSignedOut: () => void) {
  let settings = $state<AdminSetting[]>([])
  let draftValues = $state<Record<string, string>>({})
  let pending = $state(false)
  let batchOpen = $state(false)
  let batchPending = $state(false)

  const hasUnsavedChanges = $derived(
    settings.some(setting => (draftValues[setting.key] ?? String(setting.value)) !== String(setting.value)),
  )

  function handleAuthError(error: unknown) {
    if (error instanceof AdminAuthError) {
      onSignedOut()
      return true
    }
    return false
  }

  function validateSettingNumber(
    setting: AdminSetting,
    raw: string,
  ): { ok: true; value: number } | { ok: false; error: string } {
    const parsed = Number(raw)
    if (!Number.isInteger(parsed)) {
      return { ok: false, error: `${setting.label} must be an integer` }
    }
    if (parsed < setting.min || parsed > setting.max) {
      return { ok: false, error: `${setting.label} must be between ${setting.min} and ${setting.max}` }
    }
    return { ok: true, value: parsed }
  }

  async function load() {
    try {
      const loaded = await fetchAdminSettings()
      settings = loaded
      draftValues = Object.fromEntries(loaded.map(setting => [setting.key, String(setting.value)]))
      return true
    } catch (error) {
      if (!handleAuthError(error)) {
        toast.error(error instanceof Error ? error.message : 'Failed to load settings')
      }
      return false
    }
  }

  function apply() {
    const changed = settings.filter(
      setting => (draftValues[setting.key] ?? String(setting.value)) !== String(setting.value),
    )
    if (changed.length === 0) {
      return
    }
    for (const setting of changed) {
      const raw = draftValues[setting.key]?.trim() ?? ''
      const validated = validateSettingNumber(setting, raw)
      if (!validated.ok) {
        toast.error(validated.error)
        return
      }
    }
    pending = true
    void updateAdminSettings(changed.map(setting => ({ key: setting.key, value: Number(draftValues[setting.key]) })))
      .then(updated => {
        settings = updated
        draftValues = Object.fromEntries(updated.map(setting => [setting.key, String(setting.value)]))
        toast.success('Settings updated')
      })
      .catch(error => {
        if (!handleAuthError(error)) {
          toast.error(error instanceof Error ? error.message : 'Failed to save settings')
        }
      })
      .finally(() => {
        pending = false
      })
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
    draftValues = Object.fromEntries(settings.map(setting => [setting.key, String(setting.value)]))
  }

  function reset() {
    settings = []
    draftValues = {}
    pending = false
    batchOpen = false
    batchPending = false
  }

  async function resetSetting(setting: AdminSetting) {
    pending = true
    try {
      const updated = await resetAdminSetting(setting.key)
      settings = updated
      draftValues = Object.fromEntries(updated.map(item => [item.key, String(item.value)]))
      toast.success(`${setting.label} reverted to environment/default`)
    } catch (error) {
      if (!handleAuthError(error)) {
        toast.error(error instanceof Error ? error.message : 'Failed to reset setting')
      }
    } finally {
      pending = false
    }
  }

  function openBatch() {
    batchOpen = true
  }

  function closeBatch() {
    if (batchPending) {
      return
    }
    batchOpen = false
  }

  async function submitBatch(content: string) {
    const parsed = parseProperties(content)
    if (!parsed.ok) {
      toast.error(parsed.error ?? 'Invalid properties')
      return
    }
    const values = parsed.value ?? {}
    const byKey = new Map(Object.entries(values))
    for (const key of byKey.keys()) {
      if (!settings.some(setting => setting.key === key)) {
        toast.error(`Unknown setting: ${key}`)
        return
      }
    }
    const changes: Array<{ key: string; value: number | null }> = []
    for (const setting of settings) {
      if (!byKey.has(setting.key)) continue
      const raw = (byKey.get(setting.key) ?? '').trim()
      const validated = validateSettingNumber(setting, raw)
      if (!validated.ok) {
        toast.error(validated.error)
        return
      }
      if (validated.value !== setting.value) {
        changes.push({ key: setting.key, value: validated.value })
      }
    }
    if (changes.length === 0) {
      toast.error('No settings changed')
      return
    }
    batchPending = true
    try {
      const updated = await updateAdminSettings(changes)
      settings = updated
      draftValues = Object.fromEntries(updated.map(item => [item.key, String(item.value)]))
      toast.success(`${changes.length} setting${changes.length === 1 ? '' : 's'} updated`)
      batchOpen = false
    } catch (error) {
      if (!handleAuthError(error)) {
        toast.error(error instanceof Error ? error.message : 'Failed to save settings')
      }
    } finally {
      batchPending = false
    }
  }

  return {
    get settings() {
      return settings
    },
    get draftValues() {
      return draftValues
    },
    get pending() {
      return pending
    },
    get hasUnsavedChanges() {
      return hasUnsavedChanges
    },
    get batchOpen() {
      return batchOpen
    },
    get batchPending() {
      return batchPending
    },
    load,
    apply,
    reload,
    resetDraft,
    reset,
    resetSetting,
    openBatch,
    closeBatch,
    submitBatch,
    updateDraftValue(key: string, value: string) {
      draftValues[key] = value
    },
  }
}
