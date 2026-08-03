import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { deleteSettingValue, listSettings, setSettingValue } from '$lib/server/settings'
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

  for (const item of body.settings) {
    if (!isBodyRecord(item) || typeof item.key !== 'string') {
      return json({ error: 'Each setting must include a key and value' }, { status: 400 })
    }
    if (item.value === null) {
      try {
        await deleteSettingValue(item.key)
        logEvent({
          ip,
          action: 'admin_setting_reset',
          details: { key: item.key, old_value: beforeValues.get(item.key) ?? null },
        })
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : 'Invalid setting' }, { status: 400 })
      }
      continue
    }
    try {
      const normalized = await setSettingValue(item.key, item.value)
      logEvent({
        ip,
        action: 'admin_setting_update',
        details: {
          key: item.key,
          old_value: beforeValues.get(item.key) ?? null,
          new_value: normalized,
        },
      })
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : 'Invalid setting' }, { status: 400 })
    }
  }

  return json({ settings: await listSettings() })
}
