import type { RequestHandler } from './$types'
import {
  assertKnownPropertyKey,
  deletePropertyValue,
  listProperties,
  setPropertyValue,
  validatePropertyValue,
} from '#lib/server/admin-properties.js'
import { logEvent } from '#lib/server/logging.js'
import { isBodyRecord } from '#lib/server/request-utils.js'

export const GET: RequestHandler = async () => {
  return Response.json({ settings: await listProperties() })
}

export const PUT: RequestHandler = async ({ request, getClientAddress }) => {
  const body = await request.json().catch(() => ({}))
  if (!isBodyRecord(body) || !Array.isArray(body.settings)) {
    return Response.json({ error: 'Request body must include a settings array' }, { status: 400 })
  }

  const before = await listProperties()
  const beforeValues = new Map(before.map(setting => [setting.key, setting.value]))
  const ip = getClientAddress()
  const updates: Array<{ key: string; value: number | string | boolean | null }> = []

  for (const item of body.settings) {
    if (!isBodyRecord(item) || typeof item.key !== 'string') {
      return Response.json({ error: 'Each setting must include a key and value' }, { status: 400 })
    }
    if (item.value === null) {
      try {
        assertKnownPropertyKey(item.key)
        updates.push({ key: item.key, value: null })
      } catch (error) {
        return Response.json({ error: error instanceof Error ? error.message : 'Invalid setting' }, { status: 400 })
      }
      continue
    }
    try {
      updates.push({ key: item.key, value: validatePropertyValue(item.key, item.value) })
    } catch (error) {
      return Response.json({ error: error instanceof Error ? error.message : 'Invalid setting' }, { status: 400 })
    }
  }

  for (const update of updates) {
    const opStartedAt = Date.now()
    if (update.value === null) {
      await deletePropertyValue(update.key)
      logEvent({
        ip,
        action: 'admin_setting_reset',
        details: {
          key: update.key,
          old_value: beforeValues.get(update.key) ?? null,
          elapsed_ms: Date.now() - opStartedAt,
        },
      })
      continue
    }

    await setPropertyValue(update.key, update.value)
    logEvent({
      ip,
      action: 'admin_setting_update',
      details: {
        key: update.key,
        old_value: beforeValues.get(update.key) ?? null,
        new_value: update.value,
        elapsed_ms: Date.now() - opStartedAt,
      },
    })
  }

  return Response.json({ settings: await listProperties() })
}
