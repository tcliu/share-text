import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { getSupportedTtsLanguages, getSupportedTtsVoices, isTtsConfigured } from '$lib/server/tts'
import { getSettingValue } from '$lib/server/settings'

export const GET: RequestHandler = async () => {
  const maxSegmentLength = await getSettingValue('tts_max_segment_length')
  const synthesisConcurrency = await getSettingValue('tts_synthesis_concurrency')
  if (!(await isTtsConfigured())) {
    return json({ configured: false, languages: [], voices: {}, maxSegmentLength, synthesisConcurrency })
  }
  const [languages, voices] = await Promise.all([getSupportedTtsLanguages(), getSupportedTtsVoices()])
  return json({ configured: true, languages, voices, maxSegmentLength, synthesisConcurrency })
}
