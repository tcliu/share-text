// @vitest-environment jsdom
import { render, waitFor } from '@testing-library/svelte'
import { describe, expect, it, beforeEach } from 'vitest'
import ReadOnlyHost from './ReadOnlyHost.svelte'

describe('DocumentEditorPane read-only document name', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('shows the name as a copyable label for users without edit access', () => {
    const { getByText, getByLabelText } = render(ReadOnlyHost)

    expect(getByText('My Document')).toBeTruthy()
    expect(getByLabelText('Copy document name My Document')).toBeTruthy()
  })

  it('hides upload, reset, and save buttons for read-only documents', async () => {
    const { queryByLabelText } = render(ReadOnlyHost)

    await waitFor(() => {
      expect(queryByLabelText('Upload')).toBeNull()
      expect(queryByLabelText('Reset')).toBeNull()
      expect(queryByLabelText('Save')).toBeNull()
    })
  })
})
