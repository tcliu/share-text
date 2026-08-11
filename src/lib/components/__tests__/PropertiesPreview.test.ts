// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'
import PropertiesPreview from '../PropertiesPreview.svelte'

function gridCell(root: HTMLElement, ri: number, ci: number): HTMLElement {
  const cell = root.querySelector(`[data-row="${ri}"][data-col="${ci}"]`) as HTMLElement | null
  if (!cell) throw new Error(`cell ${ri},${ci} not found`)
  return cell
}

function boxOf(root: HTMLElement, ri: number, ci: number): HTMLElement {
  const box = gridCell(root, ri, ci).closest('td, th') as HTMLElement | null
  if (!box) throw new Error(`box ${ri},${ci} not found`)
  return box
}

function selectorCellOfRow(root: HTMLElement, cellText: string): HTMLElement {
  const rows = Array.from(root.querySelectorAll('thead tr, tbody tr') as NodeListOf<HTMLElement>)
  const row = rows.find(r =>
    Array.from(r.querySelectorAll('input')).some(i => (i as HTMLInputElement).value === cellText),
  )
  if (!row) throw new Error(`row with "${cellText}" not found`)
  return row.querySelector('td, th') as HTMLElement
}

function cellInput(root: HTMLElement, value: string): HTMLInputElement {
  const input = Array.from(root.querySelectorAll('input')).find(i => (i as HTMLInputElement).value === value)
  if (!input) throw new Error(`input with value "${value}" not found`)
  return input as HTMLInputElement
}

function hasCellValue(root: HTMLElement, value: string): boolean {
  return Array.from(root.querySelectorAll('input')).some(i => (i as HTMLInputElement).value === value)
}

function counter(root: HTMLElement): string {
  const match = root.textContent?.match(/(\d+) rows\s·\s(\d+) columns/)
  return match ? `${match[1]} rows · ${match[2]} columns` : ''
}

describe('PropertiesPreview', () => {
  it('renders key/value pairs in a two-column grid', async () => {
    render(PropertiesPreview, { content: 'name=Alice\ncount=3' })
    const root = await screen.findByTestId('properties-preview')
    expect(counter(root)).toBe('2 rows · 2 columns')
    expect(hasCellValue(root, 'name')).toBe(true)
    expect(hasCellValue(root, 'Alice')).toBe(true)
    expect(hasCellValue(root, 'count')).toBe(true)
    expect(hasCellValue(root, '3')).toBe(true)
  })

  it('labels the two columns Key and Value', async () => {
    render(PropertiesPreview, { content: 'a=1' })
    const root = await screen.findByTestId('properties-preview')
    const selectorRow = root.querySelector('thead tr') as HTMLElement
    const headers = Array.from(selectorRow.querySelectorAll('th')) as HTMLElement[]
    expect(headers[0].textContent?.trim()).toBe('')
    expect(headers[1].textContent?.trim()).toBe('Key')
    expect(headers[2].textContent?.trim()).toBe('Value')
  })

  it('does not offer the Toggle header control for the properties grid', async () => {
    render(PropertiesPreview, { content: 'a=1' })
    const root = await screen.findByTestId('properties-preview')
    expect(within(root).queryByRole('button', { name: 'Toggle header' })).toBeNull()
  })

  it('shows an error for unparseable content', async () => {
    render(PropertiesPreview, { content: 'name=\\uZZZZ' })
    const root = await screen.findByTestId('properties-preview')
    await vi.waitFor(() => expect(root.textContent).toMatch(/Unable to parse/))
  })

  it('shows a placeholder for empty content and allows adding a row', async () => {
    const onChange = vi.fn()
    render(PropertiesPreview, { content: '', onContentChange: onChange })
    const root = await screen.findByTestId('properties-preview')
    expect(root.textContent).toContain('No content to preview')
    await fireEvent.click(within(root).getByRole('button', { name: /Add row/i }))
    await vi.waitFor(() => expect(counter(root)).toBe('1 rows · 2 columns'))
  })

  it('edits a value via the grid input and reports the change', async () => {
    const onChange = vi.fn()
    render(PropertiesPreview, { content: 'name=Alice\ncount=3', onContentChange: onChange })
    const root = await screen.findByTestId('properties-preview')
    const input = cellInput(root, 'Alice')
    input.focus()
    await fireEvent.input(input, { target: { value: 'Bob' } })
    await fireEvent.blur(input)
    await vi.waitFor(() => expect(onChange).toHaveBeenCalled())
    expect(onChange.mock.calls[0][0]).toContain('name=Bob')
  })

  it('renames a key via the grid input and reports the change', async () => {
    const onChange = vi.fn()
    render(PropertiesPreview, { content: 'name=Alice', onContentChange: onChange })
    const root = await screen.findByTestId('properties-preview')
    const input = cellInput(root, 'name')
    input.focus()
    await fireEvent.input(input, { target: { value: 'person' } })
    await fireEvent.blur(input)
    await vi.waitFor(() => expect(onChange).toHaveBeenCalled())
    expect(onChange.mock.calls[0][0]).toBe('person=Alice')
  })

  it('adds an entry with a typed key and value via Insert row below', async () => {
    const onChange = vi.fn()
    render(PropertiesPreview, { content: 'a=1', onContentChange: onChange })
    const root = await screen.findByTestId('properties-preview')
    await fireEvent.click(within(root).getByRole('button', { name: 'Insert row below' }))
    await vi.waitFor(() => expect(counter(root)).toBe('2 rows · 2 columns'))
    const keyInput = gridCell(root, 1, 0) as HTMLInputElement
    keyInput.focus()
    await fireEvent.input(keyInput, { target: { value: 'newKey' } })
    await fireEvent.blur(keyInput)
    await vi.waitFor(() => expect(onChange).toHaveBeenCalled())
    expect(onChange.mock.calls.at(-1)?.[0]).toContain('newKey=')

    const valueInput = gridCell(root, 1, 1) as HTMLInputElement
    valueInput.focus()
    await fireEvent.input(valueInput, { target: { value: 'changed' } })
    await fireEvent.blur(valueInput)
    await vi.waitFor(() => expect(onChange.mock.calls.length).toBeGreaterThan(1))
    expect(onChange.mock.calls.at(-1)?.[0]).toContain('newKey=changed')
    expect(onChange.mock.calls.at(-1)?.[0]).toContain('a=1')
  })

  it('removes an entry via the Delete rows toolbar button', async () => {
    const onChange = vi.fn()
    render(PropertiesPreview, { content: 'name=Alice\ncount=3', onContentChange: onChange })
    const root = await screen.findByTestId('properties-preview')
    await fireEvent.mouseDown(selectorCellOfRow(root, 'Alice'))
    await fireEvent.click(within(root).getByRole('button', { name: 'Delete rows' }))
    await vi.waitFor(() => expect(onChange).toHaveBeenCalled())
    expect(onChange.mock.calls[0][0]).toBe('count=3')
  })

  it('supports undo and redo for cell edits', async () => {
    const onChange = vi.fn()
    render(PropertiesPreview, { content: 'name=Alice', onContentChange: onChange })
    const root = await screen.findByTestId('properties-preview')
    const input = cellInput(root, 'Alice')
    input.focus()
    await fireEvent.input(input, { target: { value: 'Alicia' } })
    await fireEvent.blur(input)
    await vi.waitFor(() => expect(hasCellValue(root, 'Alicia')).toBe(true))

    const undoButton = within(root).getByRole('button', { name: 'Undo' }) as HTMLButtonElement
    expect(undoButton.disabled).toBe(false)
    await fireEvent.click(undoButton)
    await vi.waitFor(() => expect(hasCellValue(root, 'Alice')).toBe(true))
    expect(hasCellValue(root, 'Alicia')).toBe(false)

    const redoButton = within(root).getByRole('button', { name: 'Redo' }) as HTMLButtonElement
    expect(redoButton.disabled).toBe(false)
    await fireEvent.click(redoButton)
    await vi.waitFor(() => expect(hasCellValue(root, 'Alicia')).toBe(true))
    expect(hasCellValue(root, 'Alice')).toBe(false)
  })

  it('supports range selection by dragging across cells', async () => {
    render(PropertiesPreview, { content: 'a=1\nb=2' })
    const root = await screen.findByTestId('properties-preview')
    await fireEvent.mouseDown(boxOf(root, 0, 0))
    await fireEvent.mouseEnter(boxOf(root, 1, 1))
    await fireEvent.mouseUp(window)
    expect(boxOf(root, 0, 0).className).toContain('bg-slate-800')
    expect(boxOf(root, 1, 1).className).toContain('bg-slate-800')
  })

  it('locks the grid to two columns: no column insert/delete or growth', async () => {
    const onChange = vi.fn()
    render(PropertiesPreview, { content: 'a=1\nb=2', onContentChange: onChange })
    const root = await screen.findByTestId('properties-preview')
    expect(within(root).queryByRole('button', { name: 'Insert column before' })).toBeNull()
    expect(within(root).queryByRole('button', { name: 'Insert column after' })).toBeNull()
    expect(within(root).queryByRole('button', { name: 'Delete columns' })).toBeNull()

    const boxLast = boxOf(root, 1, 1)
    boxLast.focus()
    await fireEvent.keyDown(boxLast, { key: 'ArrowRight' })
    await vi.waitFor(() => expect(counter(root)).toBe('2 rows · 2 columns'))
  })

  it('does not loop when content does not round-trip (e.g. comments) and re-parses on change', async () => {
    const { rerender } = render(PropertiesPreview, { content: '# comment\nname=Alice' })
    let root = await screen.findByTestId('properties-preview')
    expect(hasCellValue(root, 'Alice')).toBe(true)
    await rerender({ content: 'other=1\n# ignored' })
    root = await screen.findByTestId('properties-preview')
    await vi.waitFor(() => expect(hasCellValue(root, '1')).toBe(true))
  })

  it('keeps edits when the serialized content is fed back', async () => {
    let emitted = ''
    const { rerender } = render(PropertiesPreview, {
      content: 'name=Alice',
      onContentChange: (v: string) => {
        emitted = v
      },
    })
    const root = await screen.findByTestId('properties-preview')
    const input = cellInput(root, 'Alice')
    input.focus()
    await fireEvent.input(input, { target: { value: 'Bob' } })
    await fireEvent.blur(input)
    await vi.waitFor(() => expect(emitted).toContain('Bob'))
    await rerender({ content: emitted })
    await vi.waitFor(() => expect(hasCellValue(root, 'Bob')).toBe(true))
  })
})