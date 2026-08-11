// @vitest-environment jsdom
import { render } from '@testing-library/svelte'
import { describe, expect, it, beforeEach } from 'vitest'
import HistoryHost from './HistoryHost.svelte'

describe('DocumentEditorPane version history button', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('hides the version history button when the document has fewer than two versions', () => {
    const { queryByLabelText } = render(HistoryHost, { props: { versionCount: 1 } })

    expect(queryByLabelText('Version history')).toBeNull()
  })

  it('shows the version history button when the document has multiple versions', () => {
    const { getByLabelText } = render(HistoryHost, { props: { versionCount: 3 } })

    expect(getByLabelText('Version history')).toBeTruthy()
  })
})
