// @vitest-environment jsdom
import { render, screen } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'
import PreviewPane from '../PreviewPane.svelte'
import PreviewStub from './PreviewStub.svelte'

function contentText() {
  return screen.getByTestId('preview-content').textContent ?? ''
}

describe('PreviewPane', () => {
  it('renders the initial content through the preview component', async () => {
    const preview = vi.fn().mockResolvedValue(PreviewStub)
    render(PreviewPane, { preview, content: 'initial' })
    await vi.waitFor(() => expect(contentText()).toBe('initial'))
  })

  it('renders updated content immediately when the content prop changes', async () => {
    const preview = vi.fn().mockResolvedValue(PreviewStub)
    const { rerender } = render(PreviewPane, { preview, content: 'first' })
    await vi.waitFor(() => expect(contentText()).toBe('first'))

    rerender({ preview, content: 'second' })
    await vi.waitFor(() => expect(contentText()).toBe('second'), { timeout: 1000, interval: 50 })
  })
})
