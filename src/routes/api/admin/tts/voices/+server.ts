import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { logEvent } from '$lib/server/logging'
import {
  TtsServiceError,
  deleteAdminTtsVoice,
  getAdminTtsVoicesState,
  saveAdminTtsDefaultVoices,
  uploadAdminTtsVoice,
} from '$lib/server/tts'

function ttsErrorResponse(error: unknown, fallback: string) {
  if (error instanceof TtsServiceError) {
    return json({ error: error.message }, { status: error.status >= 500 ? 502 : error.status })
  }
  return json({ error: error instanceof Error ? error.message : fallback }, { status: 502 })
}

export const GET: RequestHandler = async () => {
  try {
    return json(await getAdminTtsVoicesState())
  } catch (error) {
    return ttsErrorResponse(error, 'Failed to load TTS voices')
  }
}

export const PUT: RequestHandler = async ({ request, getClientAddress }) => {
  const ip = getClientAddress()
  const body = await request.json().catch(() => ({})) as { defaultVoices?: unknown }
  if (!body.defaultVoices || typeof body.defaultVoices !== 'object' || Array.isArray(body.defaultVoices)) {
    return json({ error: 'Request body must include a defaultVoices object' }, { status: 400 })
  }
  const defaults: Record<string, string | null> = {}
  for (const [lang, voice] of Object.entries(body.defaultVoices as Record<string, unknown>)) {
    if (typeof voice === 'string' && voice.trim()) {
      defaults[lang] = voice.trim()
    } else {
      defaults[lang] = null
    }
  }
  try {
    const startedAt = Date.now()
    const state = await saveAdminTtsDefaultVoices(defaults)
    logEvent({
      ip,
      action: 'admin_tts_default_voices_save',
      details: { languages: Object.keys(defaults).join(','), elapsed_ms: Date.now() - startedAt },
    })
    return json(state)
  } catch (error) {
    return ttsErrorResponse(error, 'Failed to save TTS default voices')
  }
}

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
  const ip = getClientAddress()
  const formData = await request.formData()
  try {
    const startedAt = Date.now()
    const state = await uploadAdminTtsVoice(formData)
    const model = formData.get('model')
    logEvent({
      ip,
      action: 'admin_tts_voice_upload',
      details: {
        lang: String(formData.get('lang') ?? ''),
        voice: model instanceof File ? model.name : null,
        elapsed_ms: Date.now() - startedAt,
      },
    })
    return json(state)
  } catch (error) {
    return ttsErrorResponse(error, 'Failed to upload TTS voice')
  }
}

export const DELETE: RequestHandler = async ({ url, getClientAddress }) => {
  const ip = getClientAddress()
  const lang = url.searchParams.get('lang')?.trim() ?? ''
  const voice = url.searchParams.get('voice')?.trim() ?? ''
  if (!lang || !voice) {
    return json({ error: 'lang and voice are required' }, { status: 400 })
  }
  try {
    const startedAt = Date.now()
    const state = await deleteAdminTtsVoice(lang, voice)
    logEvent({
      ip,
      action: 'admin_tts_voice_delete',
      details: { lang, voice, elapsed_ms: Date.now() - startedAt },
    })
    return json(state)
  } catch (error) {
    return ttsErrorResponse(error, 'Failed to delete TTS voice')
  }
}
