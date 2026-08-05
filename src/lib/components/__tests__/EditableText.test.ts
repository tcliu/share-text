// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'
import EditableText from '../EditableText.svelte'

describe('EditableText', () => {
  it('renders the text', () => {
    render(EditableText, { text: 'Hello World', onChange: vi.fn() })
    expect(screen.getByText('Hello World')).toBeTruthy()
  })

  it('enters edit mode on double-click', async () => {
    render(EditableText, { text: 'Test', onChange: vi.fn() })
    await fireEvent.dblClick(screen.getByText('Test'))
    const input = screen.getByLabelText('Edit text')
    expect(input).toBeTruthy()
    expect((input as HTMLInputElement).value).toBe('Test')
  })

  it('enters edit mode via the edit button', async () => {
    render(EditableText, { text: 'Test', onChange: vi.fn() })
    await fireEvent.click(screen.getByLabelText('Edit'))
    expect(screen.getByLabelText('Edit text')).toBeTruthy()
  })

  it('commits on Enter and calls onChange', async () => {
    const onChange = vi.fn()
    render(EditableText, { text: 'Original', onChange })
    await fireEvent.dblClick(screen.getByText('Original'))
    const input = screen.getByLabelText('Edit text') as HTMLInputElement
    await fireEvent.input(input, { target: { value: 'Updated' } })
    await fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith('Updated')
  })

  it('cancels on Escape without calling onChange', async () => {
    const onChange = vi.fn()
    render(EditableText, { text: 'Original', onChange })
    await fireEvent.dblClick(screen.getByText('Original'))
    const input = screen.getByLabelText('Edit text') as HTMLInputElement
    await fireEvent.input(input, { target: { value: 'Changed' } })
    await fireEvent.keyDown(input, { key: 'Escape' })
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.queryByLabelText('Edit text')).toBeNull()
  })

  it('commits on blur', async () => {
    const onChange = vi.fn()
    render(EditableText, { text: 'Original', onChange })
    await fireEvent.dblClick(screen.getByText('Original'))
    const input = screen.getByLabelText('Edit text') as HTMLInputElement
    await fireEvent.input(input, { target: { value: 'Blurred' } })
    await fireEvent.blur(input)
    expect(onChange).toHaveBeenCalledWith('Blurred')
  })

  it('cancels without onChange when trimmed value is empty', async () => {
    const onChange = vi.fn()
    render(EditableText, { text: 'Original', onChange })
    await fireEvent.dblClick(screen.getByText('Original'))
    const input = screen.getByLabelText('Edit text') as HTMLInputElement
    await fireEvent.input(input, { target: { value: '  ' } })
    await fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('sizes the input to match the label width when editing starts', async () => {
    render(EditableText, { text: 'Test', onChange: vi.fn() })
    await fireEvent.dblClick(screen.getByText('Test'))
    const input = screen.getByLabelText('Edit text') as HTMLInputElement
    expect(input.style.getPropertyValue('width')).toBeTruthy()
  })

  it('cancels without onChange when value is unchanged', async () => {
    const onChange = vi.fn()
    render(EditableText, { text: 'Same', onChange })
    await fireEvent.dblClick(screen.getByText('Same'))
    const input = screen.getByLabelText('Edit text') as HTMLInputElement
    await fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).not.toHaveBeenCalled()
  })
})
