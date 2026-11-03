import { toast } from 'svelte-sonner'
import { untrack } from 'svelte'
import {
  AdminAuthError,
  fetchAdminProperties,
  resetAdminProperty,
  updateAdminProperties,
  type AdminProperty,
} from '#lib/admin.js'
import { parseProperties, serializeProperties } from '#lib/document-type-utils.js'
import { getI18nContext, type MessageKey } from '#lib/i18n.svelte.js'

function parseNumberWithSeparators(raw: string): number {
  return Number(raw.replace(/,/g, ''))
}

export function useAdminProperties(onSignedOut: () => void) {
  const i18n = getI18nContext()
  let settings = $state<AdminProperty[]>([])
  let draftValues = $state<Record<string, string>>({})
  let pending = $state(false)
  let propertiesText = $state('')
  let lastPushedProperties = $state<Record<string, string> | null>(null)

  function hasDraftValue(key: string): boolean {
    return Object.prototype.hasOwnProperty.call(draftValues, key)
  }

  const hasUnsavedChanges = $derived(
    settings.some(setting => !hasDraftValue(setting.key) || draftValues[setting.key] !== String(setting.value)),
  )

  function handleAuthError(error: unknown) {
    if (error instanceof AdminAuthError) {
      onSignedOut()
      return true
    }
    return false
  }

  function validateSettingNumber(
    setting: AdminProperty,
    raw: string,
  ): { ok: true; value: number } | { ok: false; error: string } {
    const parsed = parseNumberWithSeparators(raw)
    if (!Number.isInteger(parsed)) {
      return {
        ok: false,
        error: i18n.t('admin.settingMustBeInteger', { name: i18n.t(setting.labelKey as MessageKey) }),
      }
    }
    if (parsed < (setting.min ?? Number.NEGATIVE_INFINITY) || parsed > (setting.max ?? Number.POSITIVE_INFINITY)) {
      return {
        ok: false,
        error: i18n.t('admin.settingMustBeBetween', {
          name: i18n.t(setting.labelKey as MessageKey),
          min: setting.min ?? 0,
          max: setting.max ?? Number.MAX_SAFE_INTEGER,
        }),
      }
    }
    return { ok: true, value: parsed }
  }

  function pickKnownSettings(record: Record<string, string>): Record<string, string> {
    const known = new Set(settings.map(setting => setting.key))
    const picked: Record<string, string> = {}
    for (const [key, value] of Object.entries(record)) {
      if (known.has(key)) {
        picked[key] = value
      }
    }
    return picked
  }

  function recordsEqual(a: Record<string, string>, b: Record<string, string>): boolean {
    const keys = Object.keys(a)
    if (keys.length !== Object.keys(b).length) return false
    return keys.every(key => a[key] === b[key])
  }

  // Draft -> properties editor: form edits, Apply, Reload, and Reset resync the
  // editor text; a draft already explained by the editor's own last push is a
  // self-echo and must not rewrite the text the user is typing. The reverse
  // direction (editor -> draft) is explicit in `updatePropertiesText`, so this
  // effect never reads the editor text.
  $effect(() => {
    const draft = draftValues
    const lastPushed = untrack(() => lastPushedProperties)
    if (lastPushed && recordsEqual(lastPushed, pickKnownSettings(draft))) return
    lastPushedProperties = null
    propertiesText = serializeProperties(draft)
  })

  const propertiesProblems = $derived.by(() => {
    const parsed = parseProperties(propertiesText)
    if (!parsed.ok) {
      return parsed.error ? [parsed.error] : []
    }
    const problems: string[] = []
    for (const [key, value] of Object.entries(parsed.value ?? {})) {
      const setting = settings.find(item => item.key === key)
      if (!setting) {
        problems.push(i18n.t('admin.unknownSetting', { key }))
        continue
      }
      if (setting.kind !== 'number') continue
      const validated = validateSettingNumber(setting, value)
      if (!validated.ok) {
        problems.push(validated.error)
      }
    }
    return problems
  })

  async function load() {
    try {
      const loaded = await fetchAdminProperties(i18n)
      settings = loaded
      draftValues = Object.fromEntries(loaded.map(setting => [setting.key, String(setting.value)]))
      return true
    } catch (error) {
      if (!handleAuthError(error)) {
        toast.error(error instanceof Error ? error.message : i18n.t('admin.auth.toast.loadSettings'))
      }
      return false
    }
  }

  function apply() {
    const changed = settings.filter(
      setting => !hasDraftValue(setting.key) || draftValues[setting.key] !== String(setting.value),
    )
    if (changed.length === 0) {
      return
    }
    for (const setting of changed) {
      if (!hasDraftValue(setting.key)) {
        continue
      }
      const raw = draftValues[setting.key]?.trim() ?? ''
      if (setting.kind === 'number') {
        const validated = validateSettingNumber(setting, raw)
        if (!validated.ok) {
          toast.error(validated.error)
          return
        }
      }
    }
    pending = true
    void updateAdminProperties(
      changed.map(setting => ({
        key: setting.key,
        value: !hasDraftValue(setting.key)
          ? null
          : setting.kind === 'string'
            ? (draftValues[setting.key]?.trim() ?? '')
            : setting.kind === 'boolean'
              ? draftValues[setting.key] === 'true'
              : setting.kind === 'cron'
                ? (draftValues[setting.key]?.trim() ?? '')
                : parseNumberWithSeparators(draftValues[setting.key] ?? ''),
      })),
      i18n,
    )
      .then(updated => {
        settings = updated
        draftValues = Object.fromEntries(updated.map(setting => [setting.key, String(setting.value)]))
        toast.success(i18n.t('admin.settingsUpdated'))
      })
      .catch(error => {
        if (!handleAuthError(error)) {
          toast.error(error instanceof Error ? error.message : i18n.t('admin.auth.toast.saveSettings'))
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
    propertiesText = ''
    lastPushedProperties = null
    pending = false
  }

  async function resetSetting(setting: AdminProperty) {
    pending = true
    try {
      const updated = await resetAdminProperty(setting.key, i18n)
      settings = updated
      draftValues = Object.fromEntries(updated.map(item => [item.key, String(item.value)]))
      toast.success(i18n.t('admin.settingReverted', { name: i18n.t(setting.labelKey as MessageKey) }))
    } catch (error) {
      if (!handleAuthError(error)) {
        toast.error(error instanceof Error ? error.message : i18n.t('admin.auth.toast.resetSetting'))
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
    get propertiesProblems() {
      return propertiesProblems
    },
    get propertiesText() {
      return propertiesText
    },
    setDraftValue(key: string, value: string) {
      draftValues = { ...draftValues, [key]: value }
    },
    updatePropertiesText(next: string) {
      propertiesText = next
      const parsed = parseProperties(next)
      if (!parsed.ok || !parsed.value) return
      const known = pickKnownSettings(parsed.value)
      if (recordsEqual(known, pickKnownSettings(draftValues))) return
      lastPushedProperties = known
      const nextDraft = { ...draftValues }
      const knownKeys = new Set(settings.map(setting => setting.key))
      for (const key of knownKeys) {
        delete nextDraft[key]
      }
      for (const [key, value] of Object.entries(known)) {
        nextDraft[key] = value
      }
      draftValues = nextDraft
    },
    load,
    apply,
    reload,
    resetDraft,
    reset,
    resetSetting,
  }
}
