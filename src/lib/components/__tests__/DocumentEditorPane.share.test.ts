// @vitest-environment jsdom
import { render, fireEvent } from '@testing-library/svelte'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import HistoryHost from './HistoryHost.svelte'

describe('DocumentEditorPane share link button', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal('navigator', {
      ...navigator,
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('copies a clean link to the current document URL', async () => {
    vi.stubGlobal('location', new URL('https://sharetext.example/old-name?preview=editor#frag'))
    const { getByLabelText } = render(HistoryHost)

    await fireEvent.click(getByLabelText('Copy sharable link'))

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://sharetext.example/aaaaaa')
  })
})