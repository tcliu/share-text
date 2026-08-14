// @vitest-environment jsdom
import { render, waitFor } from '@testing-library/svelte'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Snippet } from 'svelte'
import Layout from '../+layout.svelte'
import { setPage } from '../../../test/mocks/app-stores'

const SPLIT_PANE_STORAGE_KEY = 'share-text:split-pane-width'

function stubDesktop() {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
}

function asideStyle(container: HTMLElement) {
  return container.querySelector('aside')?.getAttribute('style')
}

describe('Split pane width on load', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    stubDesktop()
    localStorage.clear()
    setPage({ params: {}, url: new URL('http://localhost/'), route: { id: '/' } })
  })

  it('renders the document list at the saved width', async () => {
    localStorage.setItem(SPLIT_PANE_STORAGE_KEY, '300')
    const { container } = render(Layout, {
      children: (() => '') as unknown as Snippet,
    })
    await waitFor(() => {
      expect(asideStyle(container)).toContain('--aside-w: 300px')
    })
  })
})
