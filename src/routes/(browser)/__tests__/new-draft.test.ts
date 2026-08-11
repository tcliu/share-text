// @vitest-environment jsdom
import { render, waitFor } from '@testing-library/svelte'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import NewPageHost from '../../../test/NewPageHost.svelte'

describe('new document draft', () => {
  beforeEach(() => {
    localStorage.clear()
    class ResizeObserverStub {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    vi.stubGlobal('ResizeObserver', ResizeObserverStub)
  })

  it('populates content, doc type, and name from a saved new-document draft', async () => {
    localStorage.setItem(
      'share-text:draft:new',
      JSON.stringify({ content: '{"a":1}', docType: 'json', name: 'My Doc (copy)' }),
    )

    const { getByLabelText, queryByText, container } = render(NewPageHost)

    await waitFor(() => {
      expect(queryByText('My Doc (copy)')).toBeTruthy()
    })
    expect((getByLabelText('Document type') as HTMLInputElement).value).toBe('JSON')
    expect(localStorage.getItem('share-text:draft:new')).not.toBeNull()

    // The editor mounts CodeMirror asynchronously after a dynamic language
    // import; wait for its DOM before asserting the populated content.
    await waitFor(
      () => {
        expect(container.querySelector('.cm-content')?.textContent).toBe('{"a":1}')
      },
      { timeout: 3000 },
    )
  })
})
