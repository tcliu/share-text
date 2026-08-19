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

  it('shows the version history action when the document has multiple versions', async () => {
    const { getByLabelText, findByText } = render(HistoryHost, { props: { versionCount: 3 } })

    const trigger = getByLabelText('More actions')
    expect(trigger).toBeTruthy()
    trigger.click()
    expect(await findByText('History')).toBeTruthy()
  })
})
