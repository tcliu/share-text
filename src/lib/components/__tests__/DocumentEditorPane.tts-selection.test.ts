// @vitest-environment jsdom
import { render, fireEvent, waitFor } from '@testing-library/svelte'
import { EditorView } from '@codemirror/view'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const ttsMocks = vi.hoisted(() => ({
  loadTtsCapabilities: vi.fn(),
  synthesizeTtsStreaming: vi.fn(),
}))

vi.mock('$lib/tts-client', async () => {
  const actual = await vi.importActual<typeof import('$lib/tts-client')>('$lib/tts-client')
  return {
    ...actual,
    loadTtsCapabilities: ttsMocks.loadTtsCapabilities,
    synthesizeTtsStreaming: ttsMocks.synthesizeTtsStreaming,
  }
})

vi.mock('$lib/user-settings', () => ({
  fetchUserPreferences: vi.fn().mockResolvedValue({ preferredLanguage: 'en', ttsVoices: {} }),
}))

import MobileEditorHost from './MobileEditorHost.svelte'
import ReadOnlyHost from './ReadOnlyHost.svelte'

describe('DocumentEditorPane read-aloud selection', () => {
  beforeEach(() => {
    localStorage.clear()
    class ResizeObserverStub {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    vi.stubGlobal('ResizeObserver', ResizeObserverStub)
    Object.defineProperty(Range.prototype, 'getClientRects', {
      configurable: true,
      value: () => [],
    })
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function (this: HTMLMediaElement) {
      Object.defineProperty(this, 'paused', { configurable: true, value: false })
      return Promise.resolve()
    })
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(function (this: HTMLMediaElement) {
      Object.defineProperty(this, 'paused', { configurable: true, value: true })
    })
    ttsMocks.loadTtsCapabilities.mockResolvedValue({
      configured: true,
      languages: ['en'],
      voices: {},
      defaultVoices: {},
      maxSegmentLength: 500,
      synthesisConcurrency: 4,
    })
    ttsMocks.synthesizeTtsStreaming.mockImplementation(async function* () {
      yield new Blob(['audio'])
    })
  })

  it('selects the spoken segment in the editor during playback', async () => {
    render(MobileEditorHost, { docType: 'markdown', initialContent: 'Hello world' })

    await waitFor(() => expect(document.querySelector('.cm-content')).toBeTruthy())
    const editor = document.querySelector<HTMLElement>('.cm-content')!
    const view = EditorView.findFromDOM(editor)!
    const readAloud = document.querySelector('[aria-label="Read aloud"]') as HTMLButtonElement | null
    expect(readAloud).toBeTruthy()

    await fireEvent.click(readAloud!)

    await waitFor(() => {
      expect(view.state.selection.main.from).toBe(0)
      expect(view.state.selection.main.to).toBe(11)
    })
  })

  it('restores the original selection after playback when reading a selected range', async () => {
    render(MobileEditorHost, { docType: 'markdown', initialContent: 'Hello world and more' })

    await waitFor(() => expect(document.querySelector('.cm-content')).toBeTruthy())
    const editor = document.querySelector<HTMLElement>('.cm-content')!
    const view = EditorView.findFromDOM(editor)!
    view.dispatch({ selection: { anchor: 0, head: 11 } })

    const readAloud = document.querySelector('[aria-label="Read aloud"]') as HTMLButtonElement | null
    expect(readAloud).toBeTruthy()

    await fireEvent.click(readAloud!)

    await waitFor(() => {
      expect(view.state.selection.main.from).toBe(0)
      expect(view.state.selection.main.to).toBe(11)
    })
  })

  it('keeps a drawn selection layer available during playback when the editor is read-only', async () => {
    render(ReadOnlyHost)

    await waitFor(() => expect(document.querySelector('.cm-content')).toBeTruthy())
    const editor = document.querySelector<HTMLElement>('.cm-content')!
    const view = EditorView.findFromDOM(editor)!
    expect(document.querySelector('.cm-selectionLayer')).toBeTruthy()

    const readAloud = document.querySelector('[aria-label="Read aloud"]') as HTMLButtonElement | null
    expect(readAloud).toBeTruthy()

    await fireEvent.click(readAloud!)

    await waitFor(() => {
      expect(view.state.selection.main.from).toBe(0)
      expect(view.state.selection.main.to).toBe(5)
    })
  })
})
