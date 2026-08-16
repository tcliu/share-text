// @vitest-environment jsdom
import { render } from '@testing-library/svelte'
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
})
