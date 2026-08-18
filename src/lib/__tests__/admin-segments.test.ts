// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAdminSegments } from '$lib/use-admin-segments.svelte'
import { MAX_SEGMENT_LENGTH } from '$lib/tts-language'

describe('useAdminSegments', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  it('derives segments with index ranges from the input text', () => {
    const state = useAdminSegments()
    state.input = 'Hello world 你好世界'
    expect(state.segments).toEqual([
      { text: 'Hello world', lang: 'en', indexStart: 0, indexEnd: 10 },
      { text: '你好世界', lang: 'zh', indexStart: 12, indexEnd: 15 },
    ])
  })

  it('splits long input using the runtime max segment length', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ configured: true, languages: ['en'], maxSegmentLength: 120, synthesisConcurrency: 4 }),
      }),
    )
    const state = useAdminSegments()
    await state.reload()
    expect(state.maxSegmentLength).toBe(120)

    state.input = 'word '.repeat(30).trim()
    expect(state.segments.every(segment => segment.text.length <= 120)).toBe(true)
    expect(state.segments.length).toBeGreaterThan(1)
  })

  it('resets the input and the max length', async () => {
    const state = useAdminSegments()
    state.input = 'some text'
    await state.reload()
    state.reset()
    expect(state.input).toBe('')
    expect(state.maxSegmentLength).toBe(MAX_SEGMENT_LENGTH)
    expect(state.segments).toEqual([])
  })
})
