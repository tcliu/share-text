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

  it('renders an always-visible copy button in top-right position', async () => {
    render(Copyable, {
      text: 'hello world',
      copyPosition: 'top-right',
      copyAriaLabel: 'Copy top-right',
      containerClass: 'rounded-lg border',
    })

    const button = screen.getByLabelText('Copy top-right') as HTMLButtonElement
    expect(button).toBeTruthy()
    expect(button.closest('.opacity-0')).toBeNull()
    expect(button.closest('div.group')).not.toBeNull()
  })

  it('hides the copy button in top-right position when there is nothing to copy', () => {
    render(Copyable, { text: '   ', copyPosition: 'top-right', copyAriaLabel: 'Copy top-right' })

    expect(screen.queryByLabelText('Copy top-right')).toBeNull()
  })
})