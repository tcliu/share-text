// @vitest-environment jsdom
import { render, screen } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'
import PreviewContentHost from './PreviewContentHost.svelte'

function contentText() {
  return screen.getByTestId('preview-content').textContent ?? ''
}

describe('usePreviewContent', () => {
  it('updates immediately when the document id changes', async () => {
    const { rerender } = render(PreviewContentHost, {
      content: 'first',
      documentId: 'a',
    })
    await vi.waitFor(() => expect(contentText()).toBe('first'))

    rerender({ content: 'second', documentId: 'b' })
    await vi.waitFor(() => expect(contentText()).toBe('second'))
  })

  it('debounces updates for the same document id', async () => {
    const { rerender } = render(PreviewContentHost, {
      content: 'first',
      documentId: 'a',
    })
    await vi.waitFor(() => expect(contentText()).toBe('first'))

    rerender({ content: 'second', documentId: 'a' })
    expect(contentText()).toBe('first')
    await vi.waitFor(() => expect(contentText()).toBe('second'), { timeout: 1000, interval: 50 })
  })
})
