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
    expect(preview).toHaveBeenCalledTimes(1)
  })

  it('clears the stale preview while a replacement preview is loading', async () => {
    let releaseNext!: () => void
    const gate = new Promise<void>(resolve => {
      releaseNext = resolve
    })
    const firstPreview = vi.fn().mockResolvedValue(PreviewStub)
    const secondPreview = vi.fn(async () => {
        await gate
        return PreviewStub
      })
    const { rerender } = render(PreviewPane, { preview: firstPreview, content: 'first' })
    await vi.waitFor(() => expect(contentText()).toBe('first'))

    rerender({ preview: secondPreview, content: 'second' })
    await vi.waitFor(() => expect(screen.getByText('Loading preview...')).toBeTruthy())

    releaseNext()
    await vi.waitFor(() => expect(contentText()).toBe('second'))
  })

  it('drops onContentChange in read-only mode', async () => {
    const preview = vi.fn().mockResolvedValue(PreviewStub)
    const onContentChange = vi.fn()
    render(PreviewPane, { preview, content: 'initial', editable: false, onContentChange })

    await vi.waitFor(() => expect(preview).toHaveBeenCalled())
    const component = preview.mock.results[0]
    expect(component).toBeTruthy()
    expect(onContentChange).not.toHaveBeenCalled()
  })
})
