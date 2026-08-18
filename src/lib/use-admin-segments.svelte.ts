import { MAX_SEGMENT_LENGTH, splitTtsSegments } from '$lib/tts-language'
import { loadTtsCapabilities } from '$lib/tts-client'

export function useAdminSegments() {
  let input = $state('')
  let maxSegmentLength = $state(MAX_SEGMENT_LENGTH)
  let loaded = $state(false)

  const segments = $derived(splitTtsSegments(input, maxSegmentLength))

  async function reload() {
    try {
      const capabilities = await loadTtsCapabilities()
      maxSegmentLength = capabilities.maxSegmentLength
      loaded = true
    } catch {
      // Keep the default when capabilities are unreachable.
      loaded = true
    }
  }

  function reset() {
    input = ''
    maxSegmentLength = MAX_SEGMENT_LENGTH
    loaded = false
  }

  return {
    get input() {
      return input
    },
    set input(value: string) {
      input = value
    },
    get maxSegmentLength() {
      return maxSegmentLength
    },
    get segments() {
      return segments
    },
    get loaded() {
      return loaded
    },
    reload,
    reset,
  }
}

export type AdminSegments = ReturnType<typeof useAdminSegments>
