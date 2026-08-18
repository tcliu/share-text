import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { getSupportedTtsLanguages, isTtsConfigured } from '$lib/server/tts'
import { getSettingValue } from '$lib/server/settings'

export const GET: RequestHandler = async () => {
  const maxSegmentLength = await getSettingValue('tts_max_segment_length')
  const synthesisConcurrency = await getSettingValue('tts_synthesis_concurrency')
  if (!(await isTtsConfigured())) {
    return json({ configured: false, languages: [], maxSegmentLength, synthesisConcurrency })
  }
  const languages = await getSupportedTtsLanguages()
  return json({ configured: true, languages, maxSegmentLength, synthesisConcurrency })
}
