import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { getSupportedTtsLanguages, isTtsConfigured } from '$lib/server/tts'

export const GET: RequestHandler = async () => {
  if (!(await isTtsConfigured())) {
    return json({ configured: false, languages: [] })
  }
  const languages = await getSupportedTtsLanguages()
  return json({ configured: true, languages })
}