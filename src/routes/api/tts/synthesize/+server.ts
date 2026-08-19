import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { getTtsServiceUrl, getSupportedTtsLanguages, isTtsConfigured } from '$lib/server/tts'
import { isBodyRecord } from '$lib/server/request-utils'

export const POST: RequestHandler = async ({ request }) => {
  if (!(await isTtsConfigured())) {
    return json({ error: 'Text-to-speech is not configured' }, { status: 503 })
  }
  const body = await request.json().catch(() => ({}))
  if (!isBodyRecord(body)) {
    return json({ error: 'Invalid request body' }, { status: 400 })
  }
  const text = typeof body.text === 'string' ? body.text.trim() : ''
  const lang = typeof body.lang === 'string' ? body.lang.trim() : ''
  const voice = typeof body.voice === 'string' ? body.voice.trim() : ''
  if (!text) {
    return json({ error: 'Text must not be empty' }, { status: 400 })
  }
  if (!(await getSupportedTtsLanguages()).includes(lang)) {
    return json({ error: `Unsupported language '${lang}'` }, { status: 400 })
  }
  const forwarded: Record<string, string | number> = { text, lang }
  if (voice) {
    forwarded.voice = voice
  }
  for (const [camel, snake] of [
    ['segmentIndex', 'segment_index'],
    ['indexStart', 'index_start'],
    ['indexEnd', 'index_end'],
  ] as const) {
    if (typeof body[camel] === 'number') {
      forwarded[snake] = body[camel]
    }
  }
  try {
    const response = await fetch(`${await getTtsServiceUrl()}/api/synthesize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(forwarded),
    })
    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      const detail = typeof data.detail === 'string' ? data.detail : 'Synthesis failed'
      return json({ error: detail }, { status: response.status >= 500 ? 502 : 400 })
    }
    return new Response(response.body, {
      headers: { 'Content-Type': response.headers.get('Content-Type') ?? 'audio/wav' },
    })
  } catch {
    return json({ error: 'TTS service is unreachable' }, { status: 502 })
  }
}
