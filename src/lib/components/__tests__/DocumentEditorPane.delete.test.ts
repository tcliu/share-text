// @vitest-environment jsdom
import { render, fireEvent } from '@testing-library/svelte'
import { describe, expect, it, beforeEach, vi } from 'vitest'
import DeleteHost from './DeleteHost.svelte'

describe('DocumentEditorPane delete button', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('hides the delete button when no onDelete handler is provided', () => {
    const { queryByLabelText } = render(DeleteHost)

    expect(queryByLabelText('Delete document')).toBeNull()
  })

  it('shows the delete button and calls onDelete with the document id', () => {
    const onDelete = vi.fn()
    const { getByLabelText } = render(DeleteHost, { props: { onDelete } })

    fireEvent.click(getByLabelText('Delete document'))

    expect(onDelete).toHaveBeenCalledWith('aaaaaa')
  })
})
