import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { assertKnownSettingKey, deleteSettingValue, listSettings, setSettingValue, validateSettingValue } from '$lib/server/settings'
import { logEvent } from '$lib/server/logging'

function isBodyRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export const GET: RequestHandler = async () => {
  return json({ settings: await listSettings() })
}

export const PUT: RequestHandler = async ({ request, getClientAddress }) => {
  const body = await request.json().catch(() => ({}))
  if (!isBodyRecord(body) || !Array.isArray(body.settings)) {
    return json({ error: 'Request body must include a settings array' }, { status: 400 })
  }

  const before = await listSettings()
  const beforeValues = new Map(before.map(setting => [setting.key, setting.value]))
  const ip = getClientAddress()
  const startedAt = Date.now()
  const updates: Array<{ key: string; value: number | null }> = []

  for (const item of body.settings) {
    if (!isBodyRecord(item) || typeof item.key !== 'string') {
      return json({ error: 'Each setting must include a key and value' }, { status: 400 })
    }
    if (item.value === null) {
      try {
        assertKnownSettingKey(item.key)
        updates.push({ key: item.key, value: null })
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : 'Invalid setting' }, { status: 400 })
      }
      continue
    }
    try {
      updates.push({ key: item.key, value: validateSettingValue(item.key, item.value) })
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : 'Invalid setting' }, { status: 400 })
    }
  }

  for (const update of updates) {
    if (update.value === null) {
      await deleteSettingValue(update.key)
      logEvent({
        ip,
        action: 'admin_setting_reset',
        details: {
          key: update.key,
          old_value: beforeValues.get(update.key) ?? null,
          elapsed_ms: Date.now() - startedAt,
        },
      })
      continue
    }

    await setSettingValue(update.key, update.value)
    logEvent({
      ip,
      action: 'admin_setting_update',
      details: {
        key: update.key,
        old_value: beforeValues.get(update.key) ?? null,
        new_value: update.value,
        elapsed_ms: Date.now() - startedAt,
      },
    })
  }

  return json({ settings: await listSettings() })
}
