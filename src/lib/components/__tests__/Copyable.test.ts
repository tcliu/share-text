// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Copyable from '../Copyable.svelte'

describe('Copyable', () => {
  beforeEach(() => {
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders the text', () => {
    render(Copyable, { text: 'hello world' })
    expect(screen.getByText('hello world')).toBeTruthy()
  })

  it('copies the text when the copy button is clicked', async () => {
    render(Copyable, { text: 'aaaaaa', copyAriaLabel: 'Copy document ID' })
    await fireEvent.click(screen.getByLabelText('Copy document ID'))
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('aaaaaa')
  })

  it('copies copyText when provided instead of text', async () => {
    render(Copyable, { text: 'shown', copyText: 'copied value', copyAriaLabel: 'Copy' })
    await fireEvent.click(screen.getByLabelText('Copy'))
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('copied value')
  })
})