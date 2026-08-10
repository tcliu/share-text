// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'
import CsvPreview from '../CsvPreview.svelte'

function counter(root: HTMLElement): string {
  const match = root.textContent?.match(/(\d+) rows\s·\s(\d+) columns/)
  return match ? `${match[1]} rows · ${match[2]} columns` : ''
}

function headerCell(root: HTMLElement, text: string): HTMLElement {
  const rows = Array.from(root.querySelectorAll('thead tr, tbody tr') as NodeListOf<HTMLElement>)
  for (const row of rows) {
    const cell = Array.from(row.querySelectorAll('td, th') as NodeListOf<HTMLElement>).find(
      t => (t.querySelector('input') as HTMLInputElement)?.value === text,
    )
    if (cell) return cell
  }
  throw new Error(`header cell with "${text}" not found`)
}

function selectorCellOfRow(root: HTMLElement, rowText: string): HTMLElement {
  const rows = Array.from(root.querySelectorAll('thead tr, tbody tr') as NodeListOf<HTMLElement>)
  const row = rows.find(r =>
    Array.from(r.querySelectorAll('input')).some(i => (i as HTMLInputElement).value === rowText),
  )
  if (!row) throw new Error(`row with "${rowText}" not found`)
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

function allRows(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll('thead tr, tbody tr') as NodeListOf<HTMLElement>)
}

function gridCell(root: HTMLElement, ri: number, ci: number): HTMLElement {
  const cell = root.querySelector(`[data-row="${ri}"][data-col="${ci}"]`) as HTMLElement | null
  if (!cell) throw new Error(`cell ${ri},${ci} not found`)
  return cell
}

function boxOf(root: HTMLElement, ri: number, ci: number): HTMLElement {
  return gridCell(root, ri, ci).closest('td, th') as HTMLElement
}

function colSelector(root: HTMLElement, ci: number): HTMLElement {
  const cell = root.querySelector(`[data-col-selector="${ci}"]`) as HTMLElement | null
  if (!cell) throw new Error(`column selector ${ci} not found`)
  return cell
}

describe('CsvPreview (custom grid)', () => {
  it('renders the option panel and an editable grid', async () => {
    render(CsvPreview, { content: 'name,age\nAlice,30\nBob,25' })
    const root = await screen.findByTestId('csv-preview')
    expect(within(root).getByRole('button', { name: 'Toggle header' })).not.toBeNull()
    expect(hasCellValue(root, 'Alice')).toBe(true)
    expect(hasCellValue(root, 'Bob')).toBe(true)
  })

  it('edits a cell and reports the change', async () => {
    const onChange = vi.fn()
    render(CsvPreview, { content: 'name,age\nAlice,30', onContentChange: onChange })
    const root = await screen.findByTestId('csv-preview')
    const input = cellInput(root, 'Alice')
    input.focus()
    await fireEvent.input(input, { target: { value: 'Alicia' } })
    await fireEvent.blur(input)
    await vi.waitFor(() => expect(onChange).toHaveBeenCalled())
    expect(onChange.mock.calls[0][0]).toContain('Alicia')
  })

  it('renders the header row as <thead> with <th> cells', async () => {
    render(CsvPreview, { content: 'name,age\nAlice,30' })
    const root = await screen.findByTestId('csv-preview')
    expect(root.querySelector('thead')).not.toBeNull()
    const headerCellVal = root.querySelector('thead th') as HTMLElement
    expect(headerCellVal.tagName).toBe('TH')
  })

  it('does not loop when content does not round-trip (e.g. JSON shown in a CSV preview)', async () => {
    const { rerender } = render(CsvPreview, { content: '{"name": "John", "age": 30}' })
    let root = await screen.findByTestId('csv-preview')
    expect(root).toBeTruthy()
    await rerender({ content: 'a,b\n1,2' })
    root = await screen.findByTestId('csv-preview')
    expect(hasCellValue(root, '1')).toBe(true)
    await rerender({ content: '{"nested": {"a": 1}, "list": [1, 2]}' })
    root = await screen.findByTestId('csv-preview')
    expect(root).toBeTruthy()
  })

  it('keeps the header row sticky and uses single-edge borders (no overlap)', async () => {
    render(CsvPreview, { content: 'name,age\nAlice,30' })
    const root = await screen.findByTestId('csv-preview')
    const headerRow = root.querySelector('thead tr') as HTMLElement
    expect(headerRow.className).toContain('sticky')
    const headerCells = root.querySelectorAll('thead th')
    for (const cell of Array.from(headerCells)) {
      expect(cell.className).toContain('border-r')
      expect(cell.className).toContain('border-b')
      expect(cell.className).not.toContain('border-l')
    }
  })

  it('exposes row/column insert buttons in the toolbar', async () => {
    render(CsvPreview, { content: 'name,age\nAlice,30' })
    const root = await screen.findByTestId('csv-preview')
    for (const label of ['Insert row above', 'Insert row below', 'Insert column before', 'Insert column after']) {
      expect(within(root).getByRole('button', { name: label })).not.toBeNull()
    }
  })

  it('Delete columns toolbar button removes the selected column', async () => {
    const onChange = vi.fn()
    render(CsvPreview, { content: 'name,age\nAlice,30', onContentChange: onChange })
    const root = await screen.findByTestId('csv-preview')
    expect(counter(root)).toBe('2 rows · 2 columns')
    await fireEvent.mouseDown(colSelector(root, 0))
    await fireEvent.click(within(root).getByRole('button', { name: 'Delete columns' }))
    await vi.waitFor(() => expect(counter(root)).toBe('2 rows · 1 columns'))
    expect(onChange).toHaveBeenCalled()
  })

  it('Insert column before toolbar button inserts an empty column before the active column', async () => {
    const onChange = vi.fn()
    render(CsvPreview, { content: 'name,age\nAlice,30', onContentChange: onChange })
    const root = await screen.findByTestId('csv-preview')
    await fireEvent.mouseDown(colSelector(root, 0))
    await fireEvent.click(within(root).getByRole('button', { name: 'Insert column before' }))
    await vi.waitFor(() => expect(counter(root)).toBe('2 rows · 3 columns'))
    expect(onChange.mock.calls[0][0].startsWith(',')).toBe(true)
  })

  it('Insert column after toolbar button inserts an empty column after the active column', async () => {
    const onChange = vi.fn()
    render(CsvPreview, { content: 'name,age\nAlice,30', onContentChange: onChange })
    const root = await screen.findByTestId('csv-preview')
    await fireEvent.mouseDown(colSelector(root, 0))
    await fireEvent.click(within(root).getByRole('button', { name: 'Insert column after' }))
    expect(onChange.mock.calls[0][0].startsWith(',name')).toBe(false)
  })

  it('Delete rows toolbar button removes a selected row', async () => {
    const onChange = vi.fn()
    render(CsvPreview, { content: 'name,age\nAlice,30\nBob,25', onContentChange: onChange })
    const root = await screen.findByTestId('csv-preview')
    expect(counter(root)).toBe('3 rows · 2 columns')
    await fireEvent.mouseDown(selectorCellOfRow(root, 'Alice'))
    await fireEvent.click(within(root).getByRole('button', { name: 'Delete rows' }))
    await vi.waitFor(() => expect(counter(root)).toBe('2 rows · 2 columns'))
    expect(hasCellValue(root, 'Alice')).toBe(false)
    expect(onChange).toHaveBeenCalled()
  })

  it('Insert row below toolbar button inserts a row after the active row', async () => {
    const onChange = vi.fn()
    render(CsvPreview, { content: 'name,age\nAlice,30', onContentChange: onChange })
    const root = await screen.findByTestId('csv-preview')
    await fireEvent.mouseDown(selectorCellOfRow(root, 'Alice'))
    await fireEvent.click(within(root).getByRole('button', { name: 'Insert row below' }))
    await vi.waitFor(() => expect(counter(root)).toBe('3 rows · 2 columns'))
    expect(onChange).toHaveBeenCalled()
  })

  it('Insert row above toolbar button inserts a row before the active row', async () => {
    const onChange = vi.fn()
    render(CsvPreview, { content: 'name,age\nAlice,30', onContentChange: onChange })
    const root = await screen.findByTestId('csv-preview')
    await fireEvent.mouseDown(selectorCellOfRow(root, 'Alice'))
    await fireEvent.click(within(root).getByRole('button', { name: 'Insert row above' }))
    await vi.waitFor(() => expect(counter(root)).toBe('3 rows · 2 columns'))
    expect(onChange).toHaveBeenCalled()
  })

  it('does not emit while an appended row is still empty, only after typing into it', async () => {
    let emitted = ''
    const { rerender } = render(CsvPreview, {
      content: 'name,age\nAlice,30',
      onContentChange: (v: string) => {
        emitted = v
      },
    })
    const root = await screen.findByTestId('csv-preview')
    const box = boxOf(root, 1, 1)
    box.focus()
    await fireEvent.keyDown(box, { key: 'ArrowDown' })
    await vi.waitFor(() => expect(counter(root)).toBe('3 rows · 2 columns'))
    expect(emitted).toBe('')
    const newCell = gridCell(root, 2, 0) as HTMLInputElement
    newCell.focus()
    await fireEvent.input(newCell, { target: { value: 'Charlie' } })
    await fireEvent.blur(newCell)
    await vi.waitFor(() => expect(emitted).toContain('Charlie'))
    await rerender({ content: emitted })
    await vi.waitFor(() => expect(counter(root)).toBe('3 rows · 2 columns'))
    expect(hasCellValue(root, 'Charlie')).toBe(true)
  })

  it('keeps cells when a row is appended by typing then fed back as the serialized content', async () => {
    let emitted = ''
    const { rerender } = render(CsvPreview, {
      content: 'name,age\nAlice,30',
      onContentChange: (v: string) => {
        emitted = v
      },
    })
    const root = await screen.findByTestId('csv-preview')
    const box = boxOf(root, 1, 1)
    box.focus()
    await fireEvent.keyDown(box, { key: 'ArrowDown' })
    await vi.waitFor(() => expect(counter(root)).toBe('3 rows · 2 columns'))
    const newCell = gridCell(root, 2, 0) as HTMLInputElement
    newCell.focus()
    await fireEvent.input(newCell, { target: { value: 'Charlie' } })
    await fireEvent.blur(newCell)
    await vi.waitFor(() => expect(emitted).toContain('Charlie'))
    await rerender({ content: emitted })
    await vi.waitFor(() => expect(counter(root)).toBe('3 rows · 2 columns'))
    expect(hasCellValue(root, 'Charlie')).toBe(true)
  })

  it('ArrowRight appends a virtual column that is only serialized after typing into it', async () => {
    let emitted = ''
    render(CsvPreview, {
      content: 'name,age\nAlice,30',
      onContentChange: (v: string) => {
        emitted = v
      },
    })
    const root = await screen.findByTestId('csv-preview')
    const box = boxOf(root, 0, 1)
    box.focus()
    await fireEvent.keyDown(box, { key: 'ArrowRight' })
    await vi.waitFor(() => expect(counter(root)).toBe('2 rows · 3 columns'))
    expect(emitted).toBe('')
  })

  it('toggles Show headers without throwing', async () => {
    render(CsvPreview, { content: 'a,b\n1,2' })
    const root = await screen.findByTestId('csv-preview')
    const toggle = within(root).getByRole('button', { name: 'Toggle header' })
    const headerRows = () => root.querySelectorAll('thead tr').length
    expect(headerRows()).toBe(2)
    expect(root.querySelectorAll('tbody tr').length).toBe(1)
    await fireEvent.click(toggle)
    expect(headerRows()).toBe(1)
    expect(root.querySelectorAll('tbody tr').length).toBe(2)
    await fireEvent.click(toggle)
    expect(headerRows()).toBe(2)
    expect(root.querySelectorAll('tbody tr').length).toBe(1)
  })

  it('shows an empty state and allows adding a row', async () => {
    render(CsvPreview, { content: '' })
    const root = await screen.findByTestId('csv-preview')
    expect(root.textContent).toContain('No content to preview')
    await fireEvent.click(within(root).getByRole('button', { name: /Add row/i }))
    await vi.waitFor(() => expect(counter(root)).toBe('1 rows · 1 columns'))
  })

  it('Insert row below toolbar button appends a row and focuses its first cell when nothing is selected', async () => {
    render(CsvPreview, { content: 'name,age\nAlice,30' })
    const root = await screen.findByTestId('csv-preview')
    await fireEvent.click(within(root).getByRole('button', { name: 'Insert row below' }))
    await vi.waitFor(() => expect(counter(root)).toBe('3 rows · 2 columns'))
    const newRow = gridCell(root, 2, 0) as HTMLInputElement
    await vi.waitFor(() => expect(document.activeElement).toBe(newRow))
  })

  it('Insert column after toolbar button appends a column and focuses its header cell when nothing is selected', async () => {
    render(CsvPreview, { content: 'name,age\nAlice,30' })
    const root = await screen.findByTestId('csv-preview')
    await fireEvent.click(within(root).getByRole('button', { name: 'Insert column after' }))
    await vi.waitFor(() => expect(counter(root)).toBe('2 rows · 3 columns'))
    const newHeader = gridCell(root, 0, 2) as HTMLInputElement
    await vi.waitFor(() => expect(document.activeElement).toBe(newHeader))
  })

  it('Delete rows toolbar button is disabled without a selection and enabled with one', async () => {
    render(CsvPreview, { content: 'name,age\nAlice,30\nBob,25' })
    const root = await screen.findByTestId('csv-preview')
    const deleteBtn = within(root).getByRole('button', { name: 'Delete rows' }) as HTMLButtonElement
    expect(deleteBtn.disabled).toBe(true)
    const aliceSelector = selectorCellOfRow(root, 'Alice') as HTMLElement
    await fireEvent.mouseDown(aliceSelector)
    expect((within(root).getByRole('button', { name: 'Delete rows' }) as HTMLButtonElement).disabled).toBe(false)
    await fireEvent.click(within(root).getByRole('button', { name: 'Delete rows' }))
    await vi.waitFor(() => expect(counter(root)).toBe('2 rows · 2 columns'))
    expect(hasCellValue(root, 'Alice')).toBe(false)
  })

  it('navigates between cells with Tab / Shift+Tab', async () => {
    render(CsvPreview, { content: 'a,b,c\n1,2,3\n4,5,6' })
    const root = await screen.findByTestId('csv-preview')
    const cell = (r: number, c: number) => root.querySelector(`[data-row="${r}"][data-col="${c}"]`) as HTMLInputElement

    cell(0, 0).focus()
    fireEvent.keyDown(cell(0, 0), { key: 'Tab' })
    expect(document.activeElement).toBe(cell(0, 1))
    fireEvent.keyDown(cell(0, 1), { key: 'Tab' })
    expect(document.activeElement).toBe(cell(0, 2))
    fireEvent.keyDown(cell(0, 2), { key: 'Tab' })
    expect(document.activeElement).toBe(cell(1, 0))
  })

  it('Enter finishes editing, moves the selection to (r+1, c) as non-editing cell', async () => {
    render(CsvPreview, { content: 'a,b\n1,2' })
    const root = await screen.findByTestId('csv-preview')
    const c00 = gridCell(root, 0, 0) as HTMLInputElement
    c00.focus()
    await fireEvent.input(c00, { target: { value: 'edited' } })
    await fireEvent.keyDown(c00, { key: 'Enter' })
    await vi.waitFor(() => expect(document.activeElement).toBe(boxOf(root, 1, 0)))
    expect(c00.value).toBe('edited')
    expect(boxOf(root, 1, 0).className).toContain('ring-cyan-500/60')
  })

  it('Enter on a selected (non-editing) cell switches to edit mode, Enter again finishes', async () => {
    render(CsvPreview, { content: 'a,b\n1,2' })
    const root = await screen.findByTestId('csv-preview')
    const c00Box = boxOf(root, 0, 0)
    c00Box.focus()
    await fireEvent.keyDown(c00Box, { key: 'Enter' })
    const c00 = gridCell(root, 0, 0) as HTMLInputElement
    expect(document.activeElement).toBe(c00)
    await fireEvent.input(c00, { target: { value: 'done' } })
    await fireEvent.keyDown(c00, { key: 'Enter' })
    await vi.waitFor(() => expect(document.activeElement).toBe(boxOf(root, 1, 0)))
    expect(c00.value).toBe('done')
  })

  it('Enter on the last row just confirms and stays non-editing', async () => {
    render(CsvPreview, { content: 'a,b\n1,2' })
    const root = await screen.findByTestId('csv-preview')
    const last = gridCell(root, 1, 0) as HTMLInputElement
    last.focus()
    await fireEvent.input(last, { target: { value: 'edited' } })
    await fireEvent.keyDown(last, { key: 'Enter' })
    await vi.waitFor(() => expect(document.activeElement).toBe(boxOf(root, 1, 0)))
    expect(last.value).toBe('edited')
    expect(boxOf(root, 1, 0).className).toContain('ring-cyan-500/60')
  })

  it('typing on a highlighted cell switches to edit mode and updates the value', async () => {
    render(CsvPreview, { content: 'a,b\n1,2' })
    const root = await screen.findByTestId('csv-preview')
    const box = boxOf(root, 0, 0)
    box.focus()
    await fireEvent.keyDown(box, { key: 'x' })
    const c00 = gridCell(root, 0, 0) as HTMLInputElement
    expect(c00.value).toBe('x')
    expect(document.activeElement).toBe(c00)
  })

  it('pasting into a highlighted cell switches to edit mode and updates the value', async () => {
    render(CsvPreview, { content: 'a,b\n1,2' })
    const root = await screen.findByTestId('csv-preview')
    const box = boxOf(root, 0, 0)
    const text = 'hello'
    await fireEvent.paste(box, { clipboardData: { getData: () => text } })
    const c00 = gridCell(root, 0, 0) as HTMLInputElement
    expect(c00.value).toBe('hello')
    expect(document.activeElement).toBe(c00)
  })

  it('Esc in edit mode discards the change and returns to non-editing', async () => {
    render(CsvPreview, { content: 'a,b\n1,2' })
    const root = await screen.findByTestId('csv-preview')
    const c00 = gridCell(root, 0, 0) as HTMLInputElement
    c00.focus()
    await fireEvent.input(c00, { target: { value: 'changed' } })
    expect(c00.value).toBe('changed')
    await fireEvent.keyDown(c00, { key: 'Escape' })
    await vi.waitFor(() => expect(document.activeElement).toBe(boxOf(root, 0, 0)))
    expect(c00.value).toBe('a')
    expect(boxOf(root, 0, 0).className).toContain('ring-cyan-500/60')
  })

  it('arrow keys navigate the selection highlight across cells without typing', async () => {
    render(CsvPreview, { content: 'a,b\n1,2\n3,4' })
    const root = await screen.findByTestId('csv-preview')
    const c10Box = boxOf(root, 1, 0)
    c10Box.focus()
    await fireEvent.keyDown(c10Box, { key: 'ArrowRight' })
    await vi.waitFor(() => expect(document.activeElement).toBe(boxOf(root, 1, 1)))
    expect(boxOf(root, 1, 1).className).toContain('ring-cyan-500/60')

    await fireEvent.keyDown(boxOf(root, 1, 1), { key: 'ArrowDown' })
    await vi.waitFor(() => expect(document.activeElement).toBe(boxOf(root, 2, 1)))
    expect(boxOf(root, 2, 1).className).toContain('ring-cyan-500/60')
  })

  it('deletes all selected rows when the clicked row is selected', async () => {
    render(CsvPreview, { content: 'h1,h2\na1,a2\nb1,b2\nc1,c2' })
    const root = await screen.findByTestId('csv-preview')
    const aSelector = selectorCellOfRow(root, 'a1') as HTMLElement
    const bSelector = selectorCellOfRow(root, 'b1') as HTMLElement
    await fireEvent.mouseDown(aSelector)
    await fireEvent.mouseDown(bSelector, { ctrlKey: true })
    await fireEvent.click(within(root).getByRole('button', { name: 'Delete rows' }))
    await vi.waitFor(() => expect(counter(root)).toBe('2 rows · 2 columns'))
    expect(hasCellValue(root, 'a1')).toBe(false)
    expect(hasCellValue(root, 'b1')).toBe(false)
    expect(hasCellValue(root, 'c1')).toBe(true)
  })

  it('pads ragged columns to uniform column count', async () => {
    render(CsvPreview, { content: 'a,b,c\n1,2' })
    const root = await screen.findByTestId('csv-preview')
    expect(counter(root)).toBe('2 rows · 3 columns')
    for (const tr of allRows(root)) {
      expect(tr.querySelectorAll('td, th').length).toBe(4) // 1 selector + 3 data cells
    }
  })

  it('focuses the new header cell after inserting a column', async () => {
    render(CsvPreview, { content: 'name,age\nAlice,30' })
    const root = await screen.findByTestId('csv-preview')
    await fireEvent.mouseDown(headerCell(root, 'name'))
    await fireEvent.click(within(root).getByRole('button', { name: 'Insert column before' }))
    const newInput = gridCell(root, 0, 0) as HTMLInputElement
    await vi.waitFor(() => expect(document.activeElement).toBe(newInput))
  })

  it('keeps a column when a header cell is cleared and blurred', async () => {
    render(CsvPreview, { content: 'name,age\nAlice,30' })
    const root = await screen.findByTestId('csv-preview')
    const input = cellInput(root, 'name')
    input.focus()
    await fireEvent.input(input, { target: { value: '' } })
    await fireEvent.blur(input)
    expect(counter(root)).toBe('2 rows · 2 columns')
  })

  it('undo and redo toolbar buttons are disabled without history', async () => {
    render(CsvPreview, { content: 'name,age\nAlice,30' })
    const root = await screen.findByTestId('csv-preview')
    const undoButton = within(root).getByRole('button', { name: 'Undo' }) as HTMLButtonElement
    const redoButton = within(root).getByRole('button', { name: 'Redo' }) as HTMLButtonElement
    expect(undoButton.disabled).toBe(true)
    expect(redoButton.disabled).toBe(true)
  })

  it('undo button reverts a cell edit and redo reapplies it', async () => {
    const onChange = vi.fn()
    render(CsvPreview, { content: 'name,age\nAlice,30', onContentChange: onChange })
    const root = await screen.findByTestId('csv-preview')
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

  it('undoes row inserts through the undo button', async () => {
    const onChange = vi.fn()
    render(CsvPreview, { content: 'name,age\nAlice,30', onContentChange: onChange })
    const root = await screen.findByTestId('csv-preview')
    await fireEvent.click(within(root).getByRole('button', { name: 'Insert column after' }))
    await vi.waitFor(() => expect(counter(root)).toBe('2 rows · 3 columns'))

    await fireEvent.click(within(root).getByRole('button', { name: 'Undo' }))
    await vi.waitFor(() => expect(counter(root)).toBe('2 rows · 2 columns'))
  })

  it('supports Ctrl+Z undo and Ctrl+Shift+Z redo', async () => {
    const onChange = vi.fn()
    render(CsvPreview, { content: 'name,age\nAlice,30', onContentChange: onChange })
    const root = await screen.findByTestId('csv-preview')
    const input = cellInput(root, 'Alice')
    input.focus()
    await fireEvent.input(input, { target: { value: 'Alicia' } })
    await fireEvent.blur(input)
    await vi.waitFor(() => expect(hasCellValue(root, 'Alicia')).toBe(true))

    await fireEvent.keyDown(root, { key: 'z', ctrlKey: true })
    await vi.waitFor(() => expect(hasCellValue(root, 'Alice')).toBe(true))

    await fireEvent.keyDown(root, { key: 'Z', ctrlKey: true, shiftKey: true })
    await vi.waitFor(() => expect(hasCellValue(root, 'Alicia')).toBe(true))
  })

  it('redo via Ctrl+Shift+Z works after undo rebuilt the grid and dropped focus', async () => {
    const onChange = vi.fn()
    render(CsvPreview, { content: 'name,age\nAlice,30', onContentChange: onChange })
    const root = await screen.findByTestId('csv-preview')
    const input = cellInput(root, 'Alice')
    input.focus()
    await fireEvent.input(input, { target: { value: 'Alicia' } })
    await fireEvent.blur(input)
    await vi.waitFor(() => expect(hasCellValue(root, 'Alicia')).toBe(true))

    // A real keydown lands on the focused input and bubbles to the grid.
    const undoInput = cellInput(root, 'Alicia')
    undoInput.focus()
    await fireEvent.keyDown(undoInput, { key: 'z', ctrlKey: true })
    await vi.waitFor(() => expect(hasCellValue(root, 'Alice')).toBe(true))

    // Undo rebuilt every row/cell (new ids), so focus must be restored onto the
    // grid; the next keydown goes to the active element (the cell box).
    expect((document.activeElement as HTMLElement | null)?.tagName).toBe('TD')
    await fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'Z', ctrlKey: true, shiftKey: true })
    await vi.waitFor(() => expect(hasCellValue(root, 'Alicia')).toBe(true))
  })
})
