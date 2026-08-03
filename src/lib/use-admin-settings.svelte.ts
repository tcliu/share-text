import { toast } from 'svelte-sonner'
import { AdminAuthError, fetchAdminSettings, resetAdminSetting, updateAdminSettings, type AdminSetting } from '$lib/admin'

export function useAdminSettings(onSignedOut: () => void) {
  let settings = $state<AdminSetting[]>([])
  let draftValues = $state<Record<string, string>>({})
  let pending = $state(false)

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

  async function load() {
    const loaded = await fetchAdminSettings()
    settings = loaded
    draftValues = Object.fromEntries(loaded.map(setting => [setting.key, String(setting.value)]))
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
      const parsed = Number(raw)
      if (!Number.isInteger(parsed)) {
        toast.error(`${setting.label} must be an integer`)
        return
      }
      if (parsed < setting.min || parsed > setting.max) {
        toast.error(`${setting.label} must be between ${setting.min} and ${setting.max}`)
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
    } catch (error) {
      if (!handleAuthError(error)) {
        toast.error(error instanceof Error ? error.message : 'Failed to reload settings')
      }
    } finally {
      pending = false
    }
  }

  function resetDraft() {
    draftValues = Object.fromEntries(settings.map(setting => [setting.key, String(setting.value)]))
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
    load,
    apply,
    reload,
    resetDraft,
    resetSetting,
    updateDraftValue(key: string, value: string) {
      draftValues[key] = value
    },
  }
}
