// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'
import DataGrid from '../DataGrid.svelte'

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

function rowSelector(root: HTMLElement, ri: number): HTMLElement {
  const cell = root.querySelector(`[data-row-selector="${ri}"]`) as HTMLElement | null
  if (!cell) throw new Error(`row selector ${ri} not found`)
  return cell
}

function colSelector(root: HTMLElement, ci: number): HTMLElement {
  const cell = root.querySelector(`[data-col-selector="${ci}"]`) as HTMLElement | null
  if (!cell) throw new Error(`column selector ${ci} not found`)
  return cell
}

function hasCellValue(root: HTMLElement, value: string): boolean {
  return Array.from(root.querySelectorAll('input')).some(i => (i as HTMLInputElement).value === value)
}

function expectRangeHighlight(root: HTMLElement, r1: number, c1: number, r2: number, c2: number) {
  const borderColor = 'rgba(34, 211, 238, 0.6)'
  for (let r = r1; r <= r2; r++) {
    for (let c = c1; c <= c2; c++) {
      const box = boxOf(root, r, c)
      expect(box.className).toContain('bg-slate-800')
      expect(box.className).not.toContain('ring-cyan-500/60')
      const shadow = box.style.boxShadow
      if (r === r1) expect(shadow).toContain(`inset 0 1px 0 0 ${borderColor}`)
      if (r === r2) expect(shadow).toContain(`inset 0 -1px 0 0 ${borderColor}`)
      if (c === c1) expect(shadow).toContain(`inset 1px 0 0 0 ${borderColor}`)
      if (c === c2) expect(shadow).toContain(`inset -1px 0 0 0 ${borderColor}`)
    }
  }
}

describe('DataGrid (reusable grid)', () => {
  it('renders a grid from a raw 2D matrix', async () => {
    render(DataGrid, {
      value: [
        ['a', 'b'],
        ['1', '2'],
      ],
    })
    const root = await screen.findByTestId('data-grid')
    expect(root.textContent).toContain('2 rows · 2 columns')
    expect(root.querySelector('thead')).not.toBeNull()
  })

  it('uses a lighter bottom border on header cells than on body cells', async () => {
    render(DataGrid, {
      value: [
        ['a', 'b'],
        ['1', '2'],
      ],
    })
    const root = await screen.findByTestId('data-grid')
    const headerBox = boxOf(root, 0, 0)
    expect(headerBox.className).toContain('border-b-slate-600')
    const bodyBox = boxOf(root, 1, 0)
    expect(bodyBox.className).toContain('border-slate-800')
    expect(bodyBox.className).not.toContain('border-b-slate-600')
  })

  it('keeps the top-left cell padding unchanged when a range is selected', async () => {
    render(DataGrid, {
      value: [
        ['a', 'b', 'c'],
        ['1', '2', '3'],
      ],
    })
    const root = await screen.findByTestId('data-grid')
    await fireEvent.mouseDown(boxOf(root, 0, 0))
    await fireEvent.mouseEnter(boxOf(root, 1, 1))
    await fireEvent.mouseUp(window)
    const topLeft = boxOf(root, 0, 0)
    expect(topLeft.className).not.toMatch(/\bborder-t\b|\bborder-l\b/)
    expect(topLeft.className).toContain('p-0')
    expect(topLeft.style.boxShadow).toContain('inset 0 1px 0 0')
    expect(topLeft.style.boxShadow).toContain('inset 1px 0 0 0')
  })

  it('emits the edited matrix via onChange', async () => {
    const onChange = vi.fn()
    render(DataGrid, { value: [['a'], ['1']], onChange })
    const root = await screen.findByTestId('data-grid')
    const input = Array.from(root.querySelectorAll('input')).find(
      i => (i as HTMLInputElement).value === '1',
    ) as HTMLInputElement
    input.focus()
    await fireEvent.input(input, { target: { value: '9' } })
    await fireEvent.blur(input)
    await vi.waitFor(() => expect(onChange).toHaveBeenCalled())
    expect(onChange.mock.calls[0][0]).toEqual([['a'], ['9']])
  })

  it('renders an empty state when value is empty', async () => {
    render(DataGrid, { value: [] })
    const root = await screen.findByTestId('data-grid')
    expect(root.textContent).toContain('No content to preview')
  })

  it('clicking a different cell only highlights it and blurs the previous input', async () => {
    render(DataGrid, {
      value: [
        ['a', 'b'],
        ['1', '2'],
      ],
    })
    const root = await screen.findByTestId('data-grid')
    const first = gridCell(root, 0, 0) as HTMLInputElement
    first.focus()
    expect(document.activeElement).toBe(first)
    await fireEvent.mouseDown(boxOf(root, 1, 0))
    expect(document.activeElement).not.toBe(first)
    expect(boxOf(root, 1, 0).className).toContain('ring-cyan-500/60')
  })

  it('clicking the same cell keeps the input focused for editing', async () => {
    render(DataGrid, {
      value: [
        ['a', 'b'],
        ['1', '2'],
      ],
    })
    const root = await screen.findByTestId('data-grid')
    await fireEvent.mouseDown(boxOf(root, 1, 0))
    const input = gridCell(root, 1, 0) as HTMLInputElement
    input.focus()
    await fireEvent.mouseDown(boxOf(root, 1, 0))
    expect(document.activeElement).toBe(input)
    expect(boxOf(root, 1, 0).className).toContain('ring-cyan-500/60')
  })

  it('top-left checkbox selects all rows via row selectors and toggles them off again', async () => {
    render(DataGrid, { value: [['h'], ['a'], ['b']] })
    const root = await screen.findByTestId('data-grid')
    const selectAll = root.querySelector('thead tr') as HTMLElement
    expect(selectAll).not.toBeNull()
    await fireEvent.mouseDown(rowSelector(root, 1))
    expect(boxOf(root, 1, 0).className).toContain('bg-slate-800')
    expect(boxOf(root, 2, 0).className).not.toContain('bg-slate-800')
    await fireEvent.mouseDown(rowSelector(root, 2))
    expect(boxOf(root, 1, 0).className).not.toContain('bg-slate-800')
    expect(boxOf(root, 2, 0).className).toContain('bg-slate-800')
  })

  it('Delete columns is disabled without a column selection and deletes a column when one is selected', async () => {
    render(DataGrid, {
      value: [
        ['a', 'b'],
        ['1', '2'],
      ],
    })
    const root = await screen.findByTestId('data-grid')
    const deleteBtn = within(root).getByRole('button', { name: 'Delete columns' }) as HTMLButtonElement
    expect(deleteBtn.disabled).toBe(true)
    await fireEvent.mouseDown(colSelector(root, 1))
    expect((root.querySelector('button[aria-label="Delete columns"]') as HTMLButtonElement).disabled).toBe(false)
    await within(root).getByRole('button', { name: 'Delete columns' }).click()
    await vi.waitFor(() => expect(root.textContent).toContain('2 rows · 1 columns'))
    expect(hasCellValue(root, 'b')).toBe(false)
  })

  it('Ctrl+click selects multiple columns and Delete columns removes them all', async () => {
    render(DataGrid, {
      value: [
        ['a', 'b', 'c'],
        ['1', '2', '3'],
      ],
    })
    const root = await screen.findByTestId('data-grid')
    await fireEvent.mouseDown(colSelector(root, 1))
    await fireEvent.mouseDown(colSelector(root, 2), { ctrlKey: true })
    expect(boxOf(root, 0, 1).className).toContain('bg-slate-800')
    expect(boxOf(root, 0, 2).className).toContain('bg-slate-800')
    await within(root).getByRole('button', { name: 'Delete columns' }).click()
    await vi.waitFor(() => expect(root.textContent).toContain('2 rows · 1 columns'))
    expect(hasCellValue(root, 'a')).toBe(true)
    expect(hasCellValue(root, 'b')).toBe(false)
    expect(hasCellValue(root, 'c')).toBe(false)
  })

  it('Shift+click selects a contiguous range of rows', async () => {
    render(DataGrid, {
      value: [
        ['h1', 'h2'],
        ['a1', 'a2'],
        ['b1', 'b2'],
        ['c1', 'c2'],
        ['d1', 'd2'],
      ],
    })
    const root = await screen.findByTestId('data-grid')
    await fireEvent.mouseDown(rowSelector(root, 2))
    await fireEvent.mouseDown(rowSelector(root, 3), { shiftKey: true })
    expect(boxOf(root, 2, 0).className).toContain('bg-slate-800')
    expect(boxOf(root, 3, 0).className).toContain('bg-slate-800')
    expect(boxOf(root, 1, 0).className).not.toContain('bg-slate-800')
    expect(boxOf(root, 4, 0).className).not.toContain('bg-slate-800')
    const btn = root.querySelector('button[aria-label="Delete rows"]') as HTMLButtonElement
    expect(btn.disabled).toBe(false)
    await btn.click()
    await vi.waitFor(() => expect(root.textContent).toContain('3 rows · 2 columns'))
    expect(hasCellValue(root, 'a1')).toBe(true)
    expect(hasCellValue(root, 'b1')).toBe(false)
    expect(hasCellValue(root, 'c1')).toBe(false)
    expect(hasCellValue(root, 'd1')).toBe(true)
  })

  it('drag across row selectors selects a contiguous range of rows', async () => {
    render(DataGrid, {
      value: [
        ['h1', 'h2'],
        ['a1', 'a2'],
        ['b1', 'b2'],
        ['c1', 'c2'],
        ['d1', 'd2'],
      ],
    })
    const root = await screen.findByTestId('data-grid')
    await fireEvent.mouseDown(rowSelector(root, 2))
    await fireEvent.mouseEnter(rowSelector(root, 4))
    await fireEvent.mouseUp(window)
    expect(boxOf(root, 2, 0).className).toContain('bg-slate-800')
    expect(boxOf(root, 3, 0).className).toContain('bg-slate-800')
    expect(boxOf(root, 4, 0).className).toContain('bg-slate-800')
    expect(boxOf(root, 1, 0).className).not.toContain('bg-slate-800')
  })

  it('Ctrl+drag across rows adds a second disjoint row range', async () => {
    render(DataGrid, {
      value: [
        ['h1', 'h2'],
        ['a1', 'a2'],
        ['b1', 'b2'],
        ['c1', 'c2'],
        ['d1', 'd2'],
      ],
    })
    const root = await screen.findByTestId('data-grid')
    await fireEvent.mouseDown(rowSelector(root, 2))
    await fireEvent.mouseEnter(rowSelector(root, 3))
    await fireEvent.mouseUp(window)
    await fireEvent.mouseDown(rowSelector(root, 4), { ctrlKey: true })
    await fireEvent.mouseEnter(rowSelector(root, 4), { ctrlKey: true })
    await fireEvent.mouseUp(window)
    expect(boxOf(root, 2, 0).className).toContain('bg-slate-800')
    expect(boxOf(root, 4, 0).className).toContain('bg-slate-800')
    expect(boxOf(root, 1, 0).className).not.toContain('bg-slate-800')
  })

  it('drag across columns selects a contiguous range of columns', async () => {
    render(DataGrid, {
      value: [
        ['a', 'b', 'c', 'd', 'e'],
        ['1', '2', '3', '4', '5'],
      ],
    })
    const root = await screen.findByTestId('data-grid')
    await fireEvent.mouseDown(colSelector(root, 1))
    await fireEvent.mouseEnter(colSelector(root, 3))
    await fireEvent.mouseUp(window)
    expect(boxOf(root, 0, 1).className).toContain('bg-slate-800')
    expect(boxOf(root, 0, 2).className).toContain('bg-slate-800')
    expect(boxOf(root, 0, 3).className).toContain('bg-slate-800')
    expect(boxOf(root, 0, 0).className).not.toContain('bg-slate-800')
  })

  it('Ctrl+drag across columns adds a second disjoint column range', async () => {
    render(DataGrid, {
      value: [
        ['a', 'b', 'c', 'd', 'e'],
        ['1', '2', '3', '4', '5'],
        ['p', 'q', 'r', 's', 't'],
      ],
    })
    const root = await screen.findByTestId('data-grid')
    await fireEvent.mouseDown(colSelector(root, 1))
    await fireEvent.mouseEnter(colSelector(root, 2))
    await fireEvent.mouseUp(window)
    await fireEvent.mouseDown(colSelector(root, 4), { ctrlKey: true })
    await fireEvent.mouseEnter(colSelector(root, 4), { ctrlKey: true })
    await fireEvent.mouseUp(window)
    expect(boxOf(root, 0, 1).className).toContain('bg-slate-800')
    expect(boxOf(root, 0, 4).className).toContain('bg-slate-800')
    expect(boxOf(root, 0, 3).className).not.toContain('bg-slate-800')
    await (root.querySelector('button[aria-label="Delete columns"]') as HTMLButtonElement).click()
    await vi.waitFor(() => expect(root.textContent).toContain('3 rows · 2 columns'))
    expect(hasCellValue(root, 'q')).toBe(false)
    expect(hasCellValue(root, 'e')).toBe(false)
    expect(hasCellValue(root, 's')).toBe(true)
    expect(hasCellValue(root, 'a')).toBe(true)
  })

  it('Shift+ArrowDown extends a selected row range', async () => {
    render(DataGrid, {
      value: [
        ['h1', 'h2'],
        ['a1', 'a2'],
        ['b1', 'b2'],
        ['c1', 'c2'],
        ['d1', 'd2'],
      ],
    })
    const root = await screen.findByTestId('data-grid')
    await fireEvent.mouseDown(rowSelector(root, 2))
    await fireEvent.keyDown(rowSelector(root, 2), { key: 'ArrowDown', shiftKey: true })
    expect(boxOf(root, 2, 0).className).toContain('bg-slate-800')
    expect(boxOf(root, 3, 0).className).toContain('bg-slate-800')
    expect(boxOf(root, 1, 0).className).not.toContain('bg-slate-800')
    expect(boxOf(root, 4, 0).className).not.toContain('bg-slate-800')
  })

  it('Shift+ArrowDown then Shift+ArrowUp grows and shrinks the row selection', async () => {
    render(DataGrid, { value: [['h1'], ['a1'], ['b1'], ['c1'], ['d1']] })
    const root = await screen.findByTestId('data-grid')
    await fireEvent.mouseDown(rowSelector(root, 2))
    await fireEvent.keyDown(rowSelector(root, 2), { key: 'ArrowDown', shiftKey: true })
    expect(boxOf(root, 3, 0).className).toContain('bg-slate-800')
    await fireEvent.keyDown(rowSelector(root, 2), { key: 'ArrowDown', shiftKey: true })
    expect(boxOf(root, 4, 0).className).toContain('bg-slate-800')
    await fireEvent.keyDown(rowSelector(root, 2), { key: 'ArrowUp', shiftKey: true })
    expect(boxOf(root, 2, 0).className).toContain('bg-slate-800')
    expect(boxOf(root, 4, 0).className).not.toContain('bg-slate-800')
    expect(boxOf(root, 1, 0).className).not.toContain('bg-slate-800')
  })

  it('Shift+ArrowRight extends a selected column range', async () => {
    render(DataGrid, {
      value: [
        ['a', 'b', 'c', 'd'],
        ['1', '2', '3', '4'],
      ],
    })
    const root = await screen.findByTestId('data-grid')
    await fireEvent.mouseDown(colSelector(root, 1))
    await fireEvent.keyDown(colSelector(root, 1), { key: 'ArrowRight', shiftKey: true })
    expect(boxOf(root, 0, 1).className).toContain('bg-slate-800')
    expect(boxOf(root, 0, 2).className).toContain('bg-slate-800')
    expect(boxOf(root, 0, 3).className).not.toContain('bg-slate-800')
    expect(boxOf(root, 0, 0).className).not.toContain('bg-slate-800')
    await fireEvent.keyDown(colSelector(root, 1), { key: 'ArrowRight', shiftKey: true })
    expect(boxOf(root, 0, 3).className).toContain('bg-slate-800')
    await fireEvent.keyDown(colSelector(root, 1), { key: 'ArrowLeft', shiftKey: true })
    expect(boxOf(root, 0, 2).className).toContain('bg-slate-800')
    expect(boxOf(root, 0, 3).className).not.toContain('bg-slate-800')
  })

  it('Shift+ArrowRight inside the focused header input does not extend a column selection', async () => {
    render(DataGrid, {
      value: [
        ['a', 'b', 'c', 'd'],
        ['1', '2', '3', '4'],
      ],
    })
    const root = await screen.findByTestId('data-grid')
    await fireEvent.mouseDown(boxOf(root, 0, 1))
    await fireEvent.mouseDown(boxOf(root, 0, 1))
    const input = gridCell(root, 0, 1) as HTMLInputElement
    expect(document.activeElement).toBe(input)
    await fireEvent.keyDown(input, { key: 'ArrowRight', shiftKey: true })
    expect(boxOf(root, 0, 1).className).toContain('bg-slate-800')
    expect(boxOf(root, 0, 2).className).not.toContain('bg-slate-800')
    expect(boxOf(root, 1, 1).className).not.toContain('bg-slate-800')
  })

  it('Shift+ArrowLeft on the last selected column shrinks the selection', async () => {
    render(DataGrid, {
      value: [
        ['a', 'b', 'c'],
        ['1', '2', '3'],
      ],
    })
    const root = await screen.findByTestId('data-grid')
    await fireEvent.mouseDown(colSelector(root, 1))
    await fireEvent.keyDown(colSelector(root, 1), { key: 'ArrowRight', shiftKey: true })
    expect(boxOf(root, 0, 2).className).toContain('bg-slate-800')
    await fireEvent.keyDown(colSelector(root, 1), { key: 'ArrowLeft', shiftKey: true })
    expect(boxOf(root, 0, 1).className).toContain('bg-slate-800')
    expect(boxOf(root, 0, 2).className).not.toContain('bg-slate-800')
    expect(boxOf(root, 0, 0).className).not.toContain('bg-slate-800')
  })

  it('without Ctrl, selecting a row clears a previous column selection and vice versa', async () => {
    render(DataGrid, {
      value: [
        ['a', 'b', 'c'],
        ['1', '2', '3'],
        ['4', '5', '6'],
      ],
    })
    const root = await screen.findByTestId('data-grid')
    await fireEvent.mouseDown(colSelector(root, 1))
    expect(boxOf(root, 0, 1).className).toContain('bg-slate-800')
    expect(boxOf(root, 1, 1).className).toContain('bg-slate-800')
    await fireEvent.mouseDown(rowSelector(root, 1))
    expect(boxOf(root, 1, 0).className).toContain('bg-slate-800')
    expect(boxOf(root, 1, 1).className).toContain('bg-slate-800')
    expect(boxOf(root, 0, 1).className).not.toContain('bg-slate-800')
    expect(boxOf(root, 2, 1).className).not.toContain('bg-slate-800')
    await fireEvent.mouseDown(colSelector(root, 1))
    expect(boxOf(root, 0, 1).className).toContain('bg-slate-800')
    expect(boxOf(root, 1, 1).className).toContain('bg-slate-800')
    expect(boxOf(root, 1, 0).className).not.toContain('bg-slate-800')
  })

  it('selecting a row or column clears the current cell selection first', async () => {
    render(DataGrid, {
      value: [
        ['a', 'b', 'c'],
        ['1', '2', '3'],
      ],
    })
    const root = await screen.findByTestId('data-grid')
    await fireEvent.mouseDown(boxOf(root, 1, 1))
    expect(boxOf(root, 1, 1).className).toContain('ring-cyan-500/60')
    await fireEvent.mouseDown(rowSelector(root, 1))
    expect(boxOf(root, 1, 1).className).not.toContain('ring-cyan-500/60')
    expect(boxOf(root, 1, 0).className).toContain('bg-slate-800')
  })

  it('Ctrl+click keeps both row and column selections active', async () => {
    render(DataGrid, {
      value: [
        ['a', 'b', 'c'],
        ['1', '2', '3'],
        ['4', '5', '6'],
      ],
    })
    const root = await screen.findByTestId('data-grid')
    await fireEvent.mouseDown(rowSelector(root, 1))
    await fireEvent.mouseDown(colSelector(root, 2), { ctrlKey: true })
    expect(boxOf(root, 1, 0).className).toContain('bg-slate-800')
    expect(boxOf(root, 0, 2).className).toContain('bg-slate-800')
    expect(boxOf(root, 2, 2).className).toContain('bg-slate-800')
  })

  it('clicking the top-left corner cell selects all cells', async () => {
    render(DataGrid, {
      value: [
        ['a', 'b', 'c'],
        ['1', '2', '3'],
        ['x', 'y', 'z'],
      ],
    })
    const root = await screen.findByTestId('data-grid')
    const corner = root.querySelector('[data-select-all]') as HTMLElement
    await fireEvent.mouseDown(corner)
    expect(boxOf(root, 0, 0).className).toContain('bg-slate-800')
    expect(boxOf(root, 0, 2).className).toContain('bg-slate-800')
    expect(boxOf(root, 1, 1).className).toContain('bg-slate-800')
    expect(boxOf(root, 2, 2).className).toContain('bg-slate-800')
    expect(boxOf(root, 1, 0).className).not.toContain('ring-cyan-500/60')
    expect(colSelector(root, 0).className).not.toContain('bg-slate-800')
    expect(colSelector(root, 2).className).not.toContain('bg-slate-800')
    await fireEvent.keyDown(corner, { key: 'Delete' })
    expect(hasCellValue(root, 'a')).toBe(false)
    expect(hasCellValue(root, 'z')).toBe(false)
  })

  it('Ctrl+A selects all cells in the grid', async () => {
    render(DataGrid, {
      value: [
        ['a', 'b'],
        ['1', '2'],
      ],
    })
    const root = await screen.findByTestId('data-grid')
    const box = boxOf(root, 1, 0)
    box.focus()
    await fireEvent.keyDown(box, { key: 'a', ctrlKey: true })
    expect(boxOf(root, 1, 0).className).toContain('bg-slate-800')
    expect(boxOf(root, 0, 1).className).toContain('bg-slate-800')
    expect(colSelector(root, 0).className).not.toContain('bg-slate-800')
    await fireEvent.keyDown(box, { key: 'Delete' })
    expect(hasCellValue(root, 'a')).toBe(false)
    expect(hasCellValue(root, '2')).toBe(false)
  })

  it('Ctrl+click selects multiple rows and toggles them off again', async () => {
    render(DataGrid, { value: [['h'], ['a'], ['b'], ['c']] })
    const root = await screen.findByTestId('data-grid')
    await fireEvent.mouseDown(rowSelector(root, 1))
    await fireEvent.mouseDown(rowSelector(root, 2), { ctrlKey: true })
    expect(boxOf(root, 1, 0).className).toContain('bg-slate-800')
    expect(boxOf(root, 2, 0).className).toContain('bg-slate-800')
    expect(boxOf(root, 3, 0).className).not.toContain('bg-slate-800')
    await fireEvent.mouseDown(rowSelector(root, 2), { ctrlKey: true })
    expect(boxOf(root, 2, 0).className).not.toContain('bg-slate-800')
    expect(boxOf(root, 1, 0).className).toContain('bg-slate-800')
  })

  it('Shift+click selects a contiguous range of columns', async () => {
    render(DataGrid, {
      value: [
        ['a', 'b', 'c', 'd', 'e'],
        ['1', '2', '3', '4', '5'],
      ],
    })
    const root = await screen.findByTestId('data-grid')
    await fireEvent.mouseDown(colSelector(root, 1))
    await fireEvent.mouseDown(colSelector(root, 3), { shiftKey: true })
    expect((root.querySelector('button[aria-label="Delete columns"]') as HTMLButtonElement).disabled).toBe(false)
    await (root.querySelector('button[aria-label="Delete columns"]') as HTMLButtonElement).click()
    await vi.waitFor(() => expect(root.textContent).toContain('2 rows · 2 columns'))
    expect(hasCellValue(root, 'a')).toBe(true)
    expect(hasCellValue(root, 'b')).toBe(false)
    expect(hasCellValue(root, 'c')).toBe(false)
    expect(hasCellValue(root, 'd')).toBe(false)
    expect(hasCellValue(root, 'e')).toBe(true)
  })

  it('clicking a header cell selects only that header cell without selecting a column', async () => {
    render(DataGrid, {
      value: [
        ['a', 'b'],
        ['1', '2'],
      ],
    })
    const root = await screen.findByTestId('data-grid')
    await fireEvent.mouseDown(boxOf(root, 0, 1))
    expect(boxOf(root, 0, 1).className).toContain('bg-slate-800')
    expect(boxOf(root, 1, 1).className).not.toContain('bg-slate-800')
    expect(boxOf(root, 1, 0).className).not.toContain('bg-slate-800')
  })

  it('shows right-aligned row numbers in the first column and a distinct border', async () => {
    render(DataGrid, { value: [['a'], ['1'], ['2']] })
    const root = await screen.findByTestId('data-grid')
    const sel1 = rowSelector(root, 1)
    expect(sel1.textContent).toContain('1')
    expect(sel1.className).toContain('text-right')
    expect(sel1.className).toContain('border-r-slate-500')
    const sel2 = rowSelector(root, 2)
    expect(sel2.textContent).toContain('2')
  })

  it('keeps the row-number column and header row sticky', async () => {
    render(DataGrid, {
      value: [
        ['a', 'b'],
        ['1', '2'],
      ],
    })
    const root = await screen.findByTestId('data-grid')
    expect(root.querySelector('thead th')!.className).toContain('sticky')
    const headerRow = root.querySelector('thead tr') as HTMLElement
    expect(headerRow.className).toContain('sticky top-0')
    const sel = rowSelector(root, 1)
    expect(sel.className).toContain('sticky left-0')
    const corner = root.querySelector('thead th') as HTMLElement
    expect(corner.className).toContain('sticky left-0')
  })

  it('when headers are disabled the first row shows centered column letters (A, B, AA)', async () => {
    const cols = Array.from({ length: 27 }, (_, i) => `c${i + 1}`)
    render(DataGrid, { value: [cols, ['x']], showHeaders: false })
    const root = await screen.findByTestId('data-grid')
    const selectorRow = root.querySelector('thead tr') as HTMLElement
    const headers = Array.from(selectorRow.querySelectorAll('th')) as HTMLElement[]
    expect(headers[1].textContent?.trim()).toBe('A')
    expect(headers[2].textContent?.trim()).toBe('B')
    expect(headers[27].textContent?.trim()).toBe('AA')
    expect(headers[1].className).toContain('text-center')
  })

  it('a plain click resets the row selection anchor', async () => {
    render(DataGrid, {
      value: [
        ['h1', 'h2'],
        ['a1', 'a2'],
        ['b1', 'b2'],
        ['c1', 'c2'],
      ],
    })
    const root = await screen.findByTestId('data-grid')
    await fireEvent.mouseDown(rowSelector(root, 2))
    await fireEvent.mouseDown(rowSelector(root, 3), { shiftKey: true })
    expect(boxOf(root, 2, 0).className).toContain('bg-slate-800')
    expect(boxOf(root, 3, 0).className).toContain('bg-slate-800')
    await fireEvent.mouseDown(rowSelector(root, 1))
    expect(boxOf(root, 1, 0).className).toContain('bg-slate-800')
    expect(boxOf(root, 2, 0).className).not.toContain('bg-slate-800')
    expect(boxOf(root, 3, 0).className).not.toContain('bg-slate-800')
  })

  it('selects a range by dragging across cells', async () => {
    render(DataGrid, {
      value: [
        ['a', 'b'],
        ['1', '2'],
      ],
    })
    const root = await screen.findByTestId('data-grid')
    await fireEvent.mouseDown(boxOf(root, 1, 0))
    await fireEvent.mouseEnter(boxOf(root, 1, 1))
    await fireEvent.mouseUp(window)
    expectRangeHighlight(root, 1, 0, 1, 1)
  })

  it('auto-scrolls the container when dragging toward the bottom edge', async () => {
    render(DataGrid, {
      value: Array.from({ length: 200 }, (_, r) => [String(r), 'x']),
      showHeaders: false,
    })
    const root = await screen.findByTestId('data-grid')
    const container = root.querySelector('.overflow-auto') as HTMLElement
    container.scrollTop = 0
    const rect = {
      top: 0,
      left: 0,
      right: 400,
      bottom: 300,
      width: 400,
      height: 300,
      x: 0,
      y: 0,
      toJSON: () => {},
    }
    vi.spyOn(container, 'getBoundingClientRect').mockReturnValue(rect as DOMRect)
    await fireEvent.mouseDown(boxOf(root, 1, 0))
    await fireEvent.mouseMove(window, { clientX: 200, clientY: 299 })
    await vi.waitFor(() => expect(container.scrollTop).toBeGreaterThan(0))
    await fireEvent.mouseUp(window)
    expect(container.scrollTop).toBeGreaterThan(0)
  })

  it('auto-scrolls upward when dragging toward the top edge', async () => {
    render(DataGrid, {
      value: Array.from({ length: 200 }, (_, r) => [String(r), 'x']),
      showHeaders: false,
    })
    const root = await screen.findByTestId('data-grid')
    const container = root.querySelector('.overflow-auto') as HTMLElement
    container.scrollTop = 1000
    const rect = {
      top: 0,
      left: 0,
      right: 400,
      bottom: 300,
      width: 400,
      height: 300,
      x: 0,
      y: 0,
      toJSON: () => {},
    }
    vi.spyOn(container, 'getBoundingClientRect').mockReturnValue(rect as DOMRect)
    await fireEvent.mouseDown(boxOf(root, 5, 0))
    await fireEvent.mouseMove(window, { clientX: 200, clientY: 5 })
    const initial = container.scrollTop
    await vi.waitFor(() => expect(container.scrollTop).toBeLessThan(initial))
    await fireEvent.mouseUp(window)
  })

  it('auto-scrolls rightward when dragging over a selected row toward the right edge', async () => {
    render(DataGrid, {
      value: Array.from({ length: 10 }, (_, r) => Array.from({ length: 200 }, (_, c) => `r${r}c${c}`)),
      showHeaders: false,
    })
    const root = await screen.findByTestId('data-grid')
    const container = root.querySelector('.overflow-auto') as HTMLElement
    container.scrollLeft = 0
    const rect = {
      top: 0,
      left: 0,
      right: 400,
      bottom: 300,
      width: 400,
      height: 300,
      x: 0,
      y: 0,
      toJSON: () => {},
    }
    vi.spyOn(container, 'getBoundingClientRect').mockReturnValue(rect as DOMRect)
    await fireEvent.mouseDown(rowSelector(root, 1))
    await fireEvent.mouseMove(window, { clientX: 399, clientY: 150 })
    await vi.waitFor(() => expect(container.scrollLeft).toBeGreaterThan(0))
    await fireEvent.mouseUp(window)
  })

  it('navigates with arrow keys when only a single cell is highlighted', async () => {
    render(DataGrid, {
      value: [
        ['a', 'b'],
        ['1', '2'],
      ],
    })
    const root = await screen.findByTestId('data-grid')
    await fireEvent.mouseDown(boxOf(root, 1, 0))
    expect(document.activeElement).toBe(boxOf(root, 1, 0))
    await fireEvent.keyDown(boxOf(root, 1, 0), { key: 'ArrowRight' })
    await vi.waitFor(() => expect(document.activeElement).toBe(boxOf(root, 1, 1)))
    expect(boxOf(root, 1, 1).className).toContain('ring-cyan-500/60')
  })

  it('supports drag range selection while a cell is in edit mode', async () => {
    render(DataGrid, {
      value: [
        ['a', 'b'],
        ['1', '2'],
      ],
    })
    const root = await screen.findByTestId('data-grid')
    const input = gridCell(root, 1, 0) as HTMLInputElement
    input.focus()
    await fireEvent.mouseDown(boxOf(root, 1, 0))
    await fireEvent.mouseEnter(boxOf(root, 1, 1))
    await fireEvent.mouseUp(window)
    expectRangeHighlight(root, 1, 0, 1, 1)
  })

  it('supports shift+click range selection', async () => {
    render(DataGrid, {
      value: [
        ['a', 'b', 'c'],
        ['1', '2', '3'],
      ],
      showHeaders: false,
    })
    const root = await screen.findByTestId('data-grid')
    await fireEvent.mouseDown(boxOf(root, 0, 0))
    await fireEvent.mouseDown(boxOf(root, 1, 2), { shiftKey: true })
    expectRangeHighlight(root, 0, 0, 1, 2)
  })

  it('supports shift+arrow range selection', async () => {
    render(DataGrid, {
      value: [
        ['a', 'b'],
        ['1', '2'],
      ],
    })
    const root = await screen.findByTestId('data-grid')
    boxOf(root, 1, 0).focus()
    await fireEvent.keyDown(boxOf(root, 1, 0), { key: 'ArrowRight', shiftKey: true })
    await vi.waitFor(() => expect(document.activeElement).toBe(boxOf(root, 1, 1)))
    expectRangeHighlight(root, 1, 0, 1, 1)
  })

  it('Delete on a highlighted cell clears its value', async () => {
    render(DataGrid, {
      value: [
        ['a', 'b'],
        ['1', '2'],
      ],
    })
    const root = await screen.findByTestId('data-grid')
    await fireEvent.mouseDown(boxOf(root, 1, 0))
    await fireEvent.keyDown(boxOf(root, 1, 0), { key: 'Delete' })
    expect((gridCell(root, 1, 0) as HTMLInputElement).value).toBe('')
    expect((gridCell(root, 1, 1) as HTMLInputElement).value).toBe('2')
  })

  it('Delete clears every cell in a selected range', async () => {
    render(DataGrid, {
      value: [
        ['a', 'b'],
        ['1', '2'],
      ],
    })
    const root = await screen.findByTestId('data-grid')
    await fireEvent.mouseDown(boxOf(root, 1, 0))
    await fireEvent.mouseEnter(boxOf(root, 1, 1))
    await fireEvent.mouseUp(window)
    await fireEvent.keyDown(boxOf(root, 1, 1), { key: 'Delete' })
    expect((gridCell(root, 1, 0) as HTMLInputElement).value).toBe('')
    expect((gridCell(root, 1, 1) as HTMLInputElement).value).toBe('')
  })

  it('keeps an empty appended row after Escape', async () => {
    render(DataGrid, { value: [['a'], ['1']] })
    const root = await screen.findByTestId('data-grid')
    boxOf(root, 1, 0).focus()
    await fireEvent.keyDown(boxOf(root, 1, 0), { key: 'ArrowDown' })
    await vi.waitFor(() => expect(root.textContent).toContain('3 rows · 1 columns'))
    const blank = gridCell(root, 2, 0) as HTMLInputElement
    blank.focus()
    await fireEvent.keyDown(blank, { key: 'Escape' })
    expect(root.textContent).toContain('3 rows · 1 columns')
  })

  it('keeps an emptied header column when the header is blurred', async () => {
    render(DataGrid, {
      value: [
        ['a', 'b'],
        ['1', '2'],
      ],
    })
    const root = await screen.findByTestId('data-grid')
    const input = gridCell(root, 0, 1) as HTMLInputElement
    input.focus()
    await fireEvent.input(input, { target: { value: '' } })
    await fireEvent.blur(input)
    expect(root.textContent).toContain('2 rows · 2 columns')
  })

  it('keeps an emptied row when arrowing away', async () => {
    render(DataGrid, { value: [['a'], ['1'], ['2']] })
    const root = await screen.findByTestId('data-grid')
    const box = boxOf(root, 1, 0)
    box.focus()
    await fireEvent.input(gridCell(root, 1, 0) as HTMLInputElement, { target: { value: '' } })
    await fireEvent.keyDown(box, { key: 'ArrowDown' })
    expect(root.textContent).toContain('3 rows · 1 columns')
    expect(hasCellValue(root, '2')).toBe(true)
  })

  it('keeps an emptied row when the input is blurred', async () => {
    render(DataGrid, { value: [['a'], ['1'], ['2']] })
    const root = await screen.findByTestId('data-grid')
    const input = gridCell(root, 1, 0) as HTMLInputElement
    input.focus()
    await fireEvent.input(input, { target: { value: '' } })
    await fireEvent.blur(input)
    expect(root.textContent).toContain('3 rows · 1 columns')
  })

  it('Delete rows works when a row is selected via the row selector', async () => {
    render(DataGrid, {
      value: [
        ['h1', 'h2'],
        ['a1', 'a2'],
        ['b1', 'b2'],
      ],
    })
    const root = await screen.findByTestId('data-grid')
    const btn = root.querySelector('button[aria-label="Delete rows"]') as HTMLButtonElement
    expect(btn.disabled).toBe(true)
    await fireEvent.mouseDown(rowSelector(root, 1))
    expect((root.querySelector('button[aria-label="Delete rows"]') as HTMLButtonElement).disabled).toBe(false)
    await (root.querySelector('button[aria-label="Delete rows"]') as HTMLButtonElement).click()
    await vi.waitFor(() => expect(root.textContent).toContain('2 rows · 2 columns'))
    expect(hasCellValue(root, 'a1')).toBe(false)
  })

  it('Delete columns works when a column is selected via the column selector', async () => {
    render(DataGrid, {
      value: [
        ['a', 'b'],
        ['1', '2'],
      ],
    })
    const root = await screen.findByTestId('data-grid')
    const del = root.querySelector('button[aria-label="Delete columns"]') as HTMLButtonElement
    expect(del.disabled).toBe(true)
    await fireEvent.mouseDown(colSelector(root, 0))
    expect((root.querySelector('button[aria-label="Delete columns"]') as HTMLButtonElement).disabled).toBe(false)
    await (root.querySelector('button[aria-label="Delete columns"]') as HTMLButtonElement).click()
    await vi.waitFor(() => expect(root.textContent).toContain('2 rows · 1 columns'))
    expect(hasCellValue(root, 'a')).toBe(false)
    expect(hasCellValue(root, 'b')).toBe(true)
  })

  it('ArrowRight on the last header cell appends a column and selects the new cell without editing', async () => {
    render(DataGrid, {
      value: [
        ['a', 'b'],
        ['1', '2'],
      ],
    })
    const root = await screen.findByTestId('data-grid')
    boxOf(root, 0, 1).focus()
    await fireEvent.keyDown(boxOf(root, 0, 1), { key: 'ArrowRight' })
    await vi.waitFor(() => expect(root.textContent).toContain('2 rows · 3 columns'))
    expect(boxOf(root, 0, 2).className).toContain('ring-cyan-500/60')
    await vi.waitFor(() => expect(document.activeElement).toBe(boxOf(root, 0, 2)))
  })

  it('ArrowDown on the last row appends a new blank row and selects its cell without editing', async () => {
    render(DataGrid, {
      value: [
        ['a', 'b'],
        ['1', '2'],
      ],
    })
    const root = await screen.findByTestId('data-grid')
    const box = boxOf(root, 1, 1)
    box.focus()
    await fireEvent.keyDown(box, { key: 'ArrowDown' })
    await vi.waitFor(() => expect(root.textContent).toContain('3 rows · 2 columns'))
    expect(boxOf(root, 2, 1).className).toContain('ring-cyan-500/60')
    await vi.waitFor(() => expect(document.activeElement).toBe(boxOf(root, 2, 1)))
  })

  it('clicking an already selected cell focuses its input for editing', async () => {
    render(DataGrid, {
      value: [
        ['a', 'b'],
        ['1', '2'],
      ],
    })
    const root = await screen.findByTestId('data-grid')
    await fireEvent.mouseDown(boxOf(root, 1, 0))
    expect(document.activeElement).toBe(boxOf(root, 1, 0))
    await fireEvent.mouseDown(boxOf(root, 1, 0))
    const input = gridCell(root, 1, 0) as HTMLInputElement
    await vi.waitFor(() => expect(document.activeElement).toBe(input))
  })

  it('arrowing away from a row with content does not remove it', async () => {
    render(DataGrid, { value: [['a'], ['1'], ['2']] })
    const root = await screen.findByTestId('data-grid')
    const box = boxOf(root, 1, 0)
    box.focus()
    await fireEvent.keyDown(box, { key: 'ArrowDown' })
    expect(root.textContent).toContain('3 rows · 1 columns')
    expect(document.activeElement).toBe(boxOf(root, 2, 0))
  })

  it('copies and pastes a single cell with Ctrl+C / Ctrl+V', async () => {
    render(DataGrid, {
      value: [
        ['a', 'b'],
        ['1', '2'],
      ],
    })
    const root = await screen.findByTestId('data-grid')
    await fireEvent.mouseDown(boxOf(root, 1, 1))
    await fireEvent.keyDown(boxOf(root, 1, 1), { key: 'c', ctrlKey: true })
    await fireEvent.mouseDown(boxOf(root, 1, 0))
    await fireEvent.keyDown(boxOf(root, 1, 0), { key: 'v', ctrlKey: true })
    expect((gridCell(root, 1, 0) as HTMLInputElement).value).toBe('2')
    expect((gridCell(root, 1, 1) as HTMLInputElement).value).toBe('2')
  })

  it('copies and pastes a selected range with Ctrl+C / Ctrl+V', async () => {
    render(DataGrid, {
      value: [
        ['a', 'b'],
        ['1', '2'],
      ],
      showHeaders: false,
    })
    const root = await screen.findByTestId('data-grid')
    await fireEvent.mouseDown(boxOf(root, 0, 0))
    await fireEvent.mouseEnter(boxOf(root, 1, 0))
    await fireEvent.mouseUp(window)
    await fireEvent.keyDown(boxOf(root, 1, 0), { key: 'c', ctrlKey: true })
    await fireEvent.mouseDown(boxOf(root, 0, 1))
    await fireEvent.keyDown(boxOf(root, 0, 1), { key: 'v', ctrlKey: true })
    expect((gridCell(root, 0, 1) as HTMLInputElement).value).toBe('a')
    expect((gridCell(root, 1, 1) as HTMLInputElement).value).toBe('1')
    expect((gridCell(root, 0, 0) as HTMLInputElement).value).toBe('a')
    expect((gridCell(root, 1, 0) as HTMLInputElement).value).toBe('1')
  })

  it('paste of a copied range into the last row appends a new row', async () => {
    render(DataGrid, {
      value: [
        ['a', 'b'],
        ['1', '2'],
      ],
      showHeaders: false,
    })
    const root = await screen.findByTestId('data-grid')
    await fireEvent.mouseDown(boxOf(root, 0, 0))
    await fireEvent.mouseEnter(boxOf(root, 1, 0))
    await fireEvent.mouseUp(window)
    await fireEvent.keyDown(boxOf(root, 1, 0), { key: 'c', ctrlKey: true })
    await fireEvent.mouseDown(boxOf(root, 1, 0))
    await fireEvent.keyDown(boxOf(root, 1, 0), { key: 'v', ctrlKey: true })
    await vi.waitFor(() => expect(root.textContent).toContain('3 rows · 2 columns'))
    expect((gridCell(root, 1, 0) as HTMLInputElement).value).toBe('a')
    expect((gridCell(root, 2, 0) as HTMLInputElement).value).toBe('1')
  })

  it('paste auto-expands columns when the pasted range would overflow the last column', async () => {
    render(DataGrid, {
      value: [
        ['a', 'b'],
        ['1', '2'],
      ],
      showHeaders: false,
    })
    const root = await screen.findByTestId('data-grid')
    await fireEvent.mouseDown(boxOf(root, 0, 0))
    await fireEvent.mouseDown(boxOf(root, 1, 1), { shiftKey: true })
    await fireEvent.keyDown(boxOf(root, 1, 1), { key: 'c', ctrlKey: true })
    await fireEvent.mouseDown(boxOf(root, 0, 1))
    await fireEvent.keyDown(boxOf(root, 0, 1), { key: 'v', ctrlKey: true })
    expect(root.textContent).toContain('2 rows · 3 columns')
    expect((gridCell(root, 0, 1) as HTMLInputElement).value).toBe('a')
    expect((gridCell(root, 0, 2) as HTMLInputElement).value).toBe('b')
    expect((gridCell(root, 1, 1) as HTMLInputElement).value).toBe('1')
    expect((gridCell(root, 1, 2) as HTMLInputElement).value).toBe('2')
  })

  it('copying a disjoint multi-region selection emits the full bounding box and pastes with auto-expansion', async () => {
    render(DataGrid, {
      value: [
        ['a', 'b', 'c'],
        ['1', '2', '3'],
        ['x', 'y', 'z'],
      ],
      showHeaders: false,
    })
    const root = await screen.findByTestId('data-grid')
    await fireEvent.mouseDown(boxOf(root, 0, 0), { ctrlKey: true })
    await fireEvent.mouseDown(boxOf(root, 2, 2), { ctrlKey: true })
    expect(boxOf(root, 0, 0).className).toContain('bg-slate-800')
    expect(boxOf(root, 2, 2).className).toContain('bg-slate-800')
    expect(boxOf(root, 0, 1).className).not.toContain('bg-slate-800')
    await fireEvent.keyDown(boxOf(root, 2, 2), { key: 'c', ctrlKey: true })
    await fireEvent.mouseDown(boxOf(root, 1, 1))
    await fireEvent.keyDown(boxOf(root, 1, 1), { key: 'v', ctrlKey: true })
    expect(root.textContent).toContain('4 rows · 4 columns')
    expect((gridCell(root, 1, 1) as HTMLInputElement).value).toBe('a')
    expect((gridCell(root, 1, 2) as HTMLInputElement).value).toBe('b')
    expect((gridCell(root, 1, 3) as HTMLInputElement).value).toBe('c')
    expect((gridCell(root, 2, 1) as HTMLInputElement).value).toBe('1')
    expect((gridCell(root, 2, 3) as HTMLInputElement).value).toBe('3')
    expect((gridCell(root, 3, 1) as HTMLInputElement).value).toBe('x')
    expect((gridCell(root, 3, 3) as HTMLInputElement).value).toBe('z')
  })

  it('selecting a row in a single-column grid shows no single-cell ring', async () => {
    render(DataGrid, { value: [['h'], ['a'], ['b']] })
    const root = await screen.findByTestId('data-grid')
    await fireEvent.mouseDown(rowSelector(root, 1))
    expect(boxOf(root, 1, 0).className).toContain('bg-slate-800')
    expect(boxOf(root, 1, 0).className).not.toContain('ring-cyan-500/60')
  })

  it('the focused row-number cell of a selected row has no focus ring', async () => {
    render(DataGrid, { value: [['h'], ['a'], ['b']] })
    const root = await screen.findByTestId('data-grid')
    await fireEvent.mouseDown(rowSelector(root, 1))
    expect(document.activeElement).toBe(rowSelector(root, 1))
    expect(rowSelector(root, 1).className).toContain('outline-none')
  })

  it('clicking a row selector focuses it for keyboard navigation, and a column selector keeps the grid focused on repeat clicks', async () => {
    render(DataGrid, {
      value: [
        ['a', 'b'],
        ['1', '2'],
      ],
    })
    const root = await screen.findByTestId('data-grid')
    const rSel = rowSelector(root, 1)
    await fireEvent.mouseDown(rSel)
    expect(document.activeElement).toBe(rSel)
    const cSel = colSelector(root, 1)
    await fireEvent.mouseDown(cSel)
    expect(document.activeElement).toBe(cSel)
    expect(boxOf(root, 0, 1).className).toContain('bg-slate-800')
    await fireEvent.mouseDown(cSel)
    expect(document.activeElement).toBe(cSel)
  })

  it('Insert row above and Insert column before are disabled without a selection; below/after are enabled', async () => {
    render(DataGrid, {
      value: [
        ['a', 'b'],
        ['1', '2'],
      ],
    })
    const root = await screen.findByTestId('data-grid')
    expect((root.querySelector('button[aria-label="Insert row above"]') as HTMLButtonElement).disabled).toBe(true)
    expect((root.querySelector('button[aria-label="Insert row below"]') as HTMLButtonElement).disabled).toBe(false)
    expect((root.querySelector('button[aria-label="Insert column before"]') as HTMLButtonElement).disabled).toBe(true)
    expect((root.querySelector('button[aria-label="Insert column after"]') as HTMLButtonElement).disabled).toBe(false)
  })

  it('trim button removes trailing empty rows and columns', async () => {
    render(DataGrid, {
      value: [
        ['a', 'b'],
        ['1', '2'],
        ['', ''],
      ],
      showHeaders: false,
    })
    const root = await screen.findByTestId('data-grid')
    const trimBtn = root.querySelector('button[aria-label="Remove empty trailing rows/columns"]') as HTMLButtonElement
    expect(trimBtn.disabled).toBe(false)
    await fireEvent.click(trimBtn)
    await vi.waitFor(() => expect(root.textContent).toContain('2 rows · 2 columns'))
    expect(hasCellValue(root, 'a')).toBe(true)
    expect(hasCellValue(root, '2')).toBe(true)
  })

  it('trim button stays disabled when there is nothing to trim', async () => {
    render(DataGrid, {
      value: [
        ['a', 'b'],
        ['1', '2'],
      ],
      showHeaders: false,
    })
    const root = await screen.findByTestId('data-grid')
    const trimBtn = root.querySelector('button[aria-label="Remove empty trailing rows/columns"]') as HTMLButtonElement
    expect(trimBtn.disabled).toBe(true)
  })

  it('trim button removes trailing empty columns but keeps a single column', async () => {
    render(DataGrid, {
      value: [
        ['a', 'b', ''],
        ['1', '2', ''],
      ],
      showHeaders: false,
    })
    const root = await screen.findByTestId('data-grid')
    const trimBtn = root.querySelector('button[aria-label="Remove empty trailing rows/columns"]') as HTMLButtonElement
    await fireEvent.click(trimBtn)
    await vi.waitFor(() => expect(root.textContent).toContain('2 rows · 2 columns'))
    expect(hasCellValue(root, 'b')).toBe(true)
  })

  it('Insert row below with no selection appends a row at the end and focuses its first cell', async () => {
    render(DataGrid, { value: [['h'], ['a']] })
    const root = await screen.findByTestId('data-grid')
    await fireEvent.click(root.querySelector('button[aria-label="Insert row below"]') as HTMLButtonElement)
    await vi.waitFor(() => expect(root.textContent).toContain('3 rows · 1 columns'))
    const newRow = gridCell(root, 2, 0) as HTMLInputElement
    expect(newRow.value).toBe('')
    await vi.waitFor(() => expect(document.activeElement).toBe(newRow))
  })

  it('Insert column after with no selection appends a column at the end and focuses its header cell', async () => {
    render(DataGrid, { value: [['a'], ['1']] })
    const root = await screen.findByTestId('data-grid')
    await fireEvent.click(root.querySelector('button[aria-label="Insert column after"]') as HTMLButtonElement)
    await vi.waitFor(() => expect(root.textContent).toContain('2 rows · 2 columns'))
    const newHeader = gridCell(root, 0, 1) as HTMLInputElement
    expect(newHeader.value).toBe('')
    await vi.waitFor(() => expect(document.activeElement).toBe(newHeader))
  })

  it('Insert row buttons enable after a row selection and column buttons after a column selection', async () => {
    render(DataGrid, { value: [['h'], ['a'], ['b']] })
    const root = await screen.findByTestId('data-grid')
    await fireEvent.mouseDown(rowSelector(root, 1))
    expect((root.querySelector('button[aria-label="Insert row above"]') as HTMLButtonElement).disabled).toBe(false)
    await fireEvent.mouseDown(colSelector(root, 0))
    expect((root.querySelector('button[aria-label="Insert column before"]') as HTMLButtonElement).disabled).toBe(false)
  })

  it('Insert row buttons enable after selecting a data cell and insert relative to its row', async () => {
    render(DataGrid, { value: [['h'], ['a'], ['b']] })
    const root = await screen.findByTestId('data-grid')
    await fireEvent.mouseDown(boxOf(root, 2, 0))
    const above = root.querySelector('button[aria-label="Insert row above"]') as HTMLButtonElement
    const below = root.querySelector('button[aria-label="Insert row below"]') as HTMLButtonElement
    expect(above.disabled).toBe(false)
    expect(below.disabled).toBe(false)
    await fireEvent.click(above)
    expect((gridCell(root, 2, 0) as HTMLInputElement).value).toBe('')
    expect((gridCell(root, 3, 0) as HTMLInputElement).value).toBe('b')
  })

  it('Insert row buttons stay enabled for a data cell selection while a header cell selection keeps them disabled', async () => {
    render(DataGrid, { value: [['h'], ['a']] })
    const root = await screen.findByTestId('data-grid')
    await fireEvent.mouseDown(boxOf(root, 0, 0))
    expect((root.querySelector('button[aria-label="Insert row above"]') as HTMLButtonElement).disabled).toBe(true)
    await fireEvent.mouseDown(boxOf(root, 1, 0))
    expect((root.querySelector('button[aria-label="Insert row above"]') as HTMLButtonElement).disabled).toBe(false)
  })

  it('clicking a header cell selects it in non-edit mode; clicking it again focuses the input with the cursor at the end', async () => {
    render(DataGrid, {
      value: [
        ['name', 'age'],
        ['1', '2'],
      ],
    })
    const root = await screen.findByTestId('data-grid')
    await fireEvent.mouseDown(boxOf(root, 0, 0))
    expect(document.activeElement).toBe(boxOf(root, 0, 0))
    expect(boxOf(root, 0, 0).className).toContain('bg-slate-800')
    await fireEvent.mouseDown(boxOf(root, 0, 0))
    const input = gridCell(root, 0, 0) as HTMLInputElement
    expect(document.activeElement).toBe(input)
    expect(input.selectionStart).toBe(input.value.length)
    expect(input.selectionEnd).toBe(input.value.length)
    expect(input.selectionStart).not.toBe(0)
  })

  it('plain ArrowDown on a selected row moves the row selection down', async () => {
    render(DataGrid, {
      value: [
        ['h1', 'h2'],
        ['a1', 'a2'],
        ['b1', 'b2'],
        ['c1', 'c2'],
      ],
    })
    const root = await screen.findByTestId('data-grid')
    await fireEvent.mouseDown(rowSelector(root, 1))
    expect(boxOf(root, 1, 0).className).toContain('bg-slate-800')
    await fireEvent.keyDown(rowSelector(root, 1), { key: 'ArrowDown' })
    expect(boxOf(root, 1, 0).className).not.toContain('bg-slate-800')
    expect(boxOf(root, 2, 0).className).toContain('bg-slate-800')
    expect(document.activeElement).toBe(rowSelector(root, 2))
  })

  it('plain ArrowUp on a selected row moves the row selection up', async () => {
    render(DataGrid, {
      value: [
        ['h1', 'h2'],
        ['a1', 'a2'],
        ['b1', 'b2'],
      ],
    })
    const root = await screen.findByTestId('data-grid')
    await fireEvent.mouseDown(rowSelector(root, 2))
    await fireEvent.keyDown(rowSelector(root, 2), { key: 'ArrowUp' })
    expect(boxOf(root, 1, 0).className).toContain('bg-slate-800')
    expect(boxOf(root, 2, 0).className).not.toContain('bg-slate-800')
  })

  it('ArrowUp on the selected first data row has no effect', async () => {
    render(DataGrid, {
      value: [
        ['h1', 'h2'],
        ['a1', 'a2'],
        ['b1', 'b2'],
      ],
    })
    const root = await screen.findByTestId('data-grid')
    await fireEvent.mouseDown(rowSelector(root, 1))
    await fireEvent.keyDown(rowSelector(root, 1), { key: 'ArrowUp' })
    expect(boxOf(root, 0, 0).className).not.toContain('bg-slate-800')
    expect(boxOf(root, 1, 0).className).toContain('bg-slate-800')
    expect(document.activeElement).toBe(rowSelector(root, 1))
  })

  it('Shift+ArrowUp on the selected first data row does not expand into the header row', async () => {
    render(DataGrid, {
      value: [
        ['h1', 'h2'],
        ['a1', 'a2'],
      ],
    })
    const root = await screen.findByTestId('data-grid')
    await fireEvent.mouseDown(rowSelector(root, 1))
    await fireEvent.keyDown(rowSelector(root, 1), { key: 'ArrowUp', shiftKey: true })
    expect(boxOf(root, 0, 0).className).not.toContain('bg-slate-800')
    expect(boxOf(root, 1, 0).className).toContain('bg-slate-800')
    expect(document.activeElement).toBe(rowSelector(root, 1))
  })

  it('plain ArrowRight on a selected header cell moves the column selection right', async () => {
    render(DataGrid, {
      value: [
        ['a', 'b', 'c'],
        ['1', '2', '3'],
      ],
    })
    const root = await screen.findByTestId('data-grid')
    await fireEvent.mouseDown(colSelector(root, 0))
    expect(boxOf(root, 0, 0).className).toContain('bg-slate-800')
    await fireEvent.keyDown(colSelector(root, 0), { key: 'ArrowRight' })
    expect(boxOf(root, 0, 0).className).not.toContain('bg-slate-800')
    expect(boxOf(root, 0, 1).className).toContain('bg-slate-800')
  })

  it('plain ArrowLeft on a selected header cell moves the column selection left', async () => {
    render(DataGrid, {
      value: [
        ['a', 'b', 'c'],
        ['1', '2', '3'],
      ],
    })
    const root = await screen.findByTestId('data-grid')
    await fireEvent.mouseDown(colSelector(root, 1))
    await fireEvent.keyDown(colSelector(root, 1), { key: 'ArrowLeft' })
    expect(boxOf(root, 0, 0).className).toContain('bg-slate-800')
    expect(boxOf(root, 0, 1).className).not.toContain('bg-slate-800')
  })

  it('ArrowLeft at the first data column selects the row and focuses its row selector', async () => {
    render(DataGrid, {
      value: [
        ['h1', 'h2'],
        ['a1', 'a2'],
        ['b1', 'b2'],
      ],
    })
    const root = await screen.findByTestId('data-grid')
    const box = boxOf(root, 1, 0)
    box.focus()
    await fireEvent.keyDown(box, { key: 'ArrowLeft' })
    expect(boxOf(root, 1, 0).className).toContain('bg-slate-800')
    expect(boxOf(root, 1, 1).className).toContain('bg-slate-800')
    expect(boxOf(root, 2, 0).className).not.toContain('bg-slate-800')
    expect(boxOf(root, 0, 1).className).not.toContain('bg-slate-800')
    expect(document.activeElement).toBe(rowSelector(root, 1))
  })

  it('ArrowLeft at the first data column works in non-header mode too', async () => {
    render(DataGrid, {
      value: [
        ['a', 'b'],
        ['1', '2'],
      ],
      showHeaders: false,
    })
    const root = await screen.findByTestId('data-grid')
    const box = boxOf(root, 1, 0)
    box.focus()
    await fireEvent.keyDown(box, { key: 'ArrowLeft' })
    expect(boxOf(root, 1, 0).className).toContain('bg-slate-800')
    expect(boxOf(root, 1, 1).className).toContain('bg-slate-800')
    expect(document.activeElement).toBe(rowSelector(root, 1))
  })

  it('ArrowRight from a focused row selector returns to the first data cell', async () => {
    render(DataGrid, {
      value: [
        ['h1', 'h2'],
        ['a1', 'a2'],
      ],
    })
    const root = await screen.findByTestId('data-grid')
    await fireEvent.mouseDown(rowSelector(root, 1))
    expect(document.activeElement).toBe(rowSelector(root, 1))
    await fireEvent.keyDown(rowSelector(root, 1), { key: 'ArrowRight' })
    expect(document.activeElement).toBe(boxOf(root, 1, 0))
    expect(boxOf(root, 1, 0).className).toContain('ring-cyan-500/60')
  })

  it('ArrowUp at the first data row moves to the header cell above without selecting the column', async () => {
    render(DataGrid, {
      value: [
        ['h1', 'h2'],
        ['a1', 'a2'],
      ],
    })
    const root = await screen.findByTestId('data-grid')
    const box = boxOf(root, 1, 1)
    box.focus()
    await fireEvent.keyDown(box, { key: 'ArrowUp' })
    expect(boxOf(root, 0, 1).className).toContain('bg-slate-800')
    expect(boxOf(root, 1, 1).className).not.toContain('bg-slate-800')
    expect(boxOf(root, 1, 0).className).not.toContain('bg-slate-800')
    expect(document.activeElement).toBe(boxOf(root, 0, 1))
  })

  it('ArrowUp at a header cell selects the column', async () => {
    render(DataGrid, {
      value: [
        ['h1', 'h2'],
        ['a1', 'a2'],
      ],
    })
    const root = await screen.findByTestId('data-grid')
    const box = boxOf(root, 0, 1)
    box.focus()
    await fireEvent.keyDown(box, { key: 'ArrowUp' })
    expect(boxOf(root, 0, 1).className).toContain('bg-slate-800')
    expect(boxOf(root, 1, 1).className).toContain('bg-slate-800')
    expect(boxOf(root, 1, 0).className).not.toContain('bg-slate-800')
  })

  it('ArrowUp at the first row in non-header mode selects the column and focuses the letter header', async () => {
    render(DataGrid, {
      value: [
        ['a', 'b'],
        ['1', '2'],
      ],
      showHeaders: false,
    })
    const root = await screen.findByTestId('data-grid')
    const box = boxOf(root, 0, 0)
    box.focus()
    await fireEvent.keyDown(box, { key: 'ArrowUp' })
    expect(boxOf(root, 0, 0).className).toContain('bg-slate-800')
    expect(boxOf(root, 1, 0).className).toContain('bg-slate-800')
    expect(boxOf(root, 0, 1).className).not.toContain('bg-slate-800')
    expect(document.activeElement).toBe(colSelector(root, 0))
  })

  it('ArrowDown from a focused letter header returns to the first data cell', async () => {
    render(DataGrid, {
      value: [
        ['a', 'b'],
        ['1', '2'],
      ],
      showHeaders: false,
    })
    const root = await screen.findByTestId('data-grid')
    await fireEvent.mouseDown(colSelector(root, 1))
    await fireEvent.keyDown(colSelector(root, 1), { key: 'ArrowDown' })
    expect(document.activeElement).toBe(boxOf(root, 0, 1))
    expect(boxOf(root, 0, 1).className).toContain('ring-cyan-500/60')
  })

  it('Ctrl+clicking two separated columns draws a complete border around each column region', async () => {
    render(DataGrid, {
      value: [
        ['a', 'b', 'c'],
        ['1', '2', '3'],
        ['4', '5', '6'],
      ],
      showHeaders: false,
    })
    const root = await screen.findByTestId('data-grid')
    await fireEvent.mouseDown(colSelector(root, 0))
    await fireEvent.mouseDown(colSelector(root, 2), { ctrlKey: true })
    const color = 'rgba(34, 211, 238, 0.6)'
    const c0Top = boxOf(root, 0, 0)
    expect(c0Top.style.boxShadow).toContain(`inset 0 1px 0 0 ${color}`)
    expect(c0Top.style.boxShadow).toContain(`inset 1px 0 0 0 ${color}`)
    expect(c0Top.style.boxShadow).toContain(`inset -1px 0 0 0 ${color}`)
    const c0Bottom = boxOf(root, 2, 0)
    expect(c0Bottom.style.boxShadow).toContain(`inset 0 -1px 0 0 ${color}`)
    expect(c0Bottom.style.boxShadow).toContain(`inset 1px 0 0 0 ${color}`)
    expect(c0Bottom.style.boxShadow).toContain(`inset -1px 0 0 0 ${color}`)
    const c2Top = boxOf(root, 0, 2)
    expect(c2Top.style.boxShadow).toContain(`inset 0 1px 0 0 ${color}`)
    expect(c2Top.style.boxShadow).toContain(`inset 1px 0 0 0 ${color}`)
    expect(c2Top.style.boxShadow).toContain(`inset -1px 0 0 0 ${color}`)
    const c2Bottom = boxOf(root, 2, 2)
    expect(c2Bottom.style.boxShadow).toContain(`inset 0 -1px 0 0 ${color}`)
    expect(boxOf(root, 1, 1).style.boxShadow).toBe('')
  })

  it('Ctrl+clicking two separated rows draws a complete border around each row region', async () => {
    render(DataGrid, {
      value: [
        ['a', 'b'],
        ['1', '2'],
        ['3', '4'],
        ['5', '6'],
      ],
      showHeaders: false,
    })
    const root = await screen.findByTestId('data-grid')
    await fireEvent.mouseDown(rowSelector(root, 0))
    await fireEvent.mouseDown(rowSelector(root, 2), { ctrlKey: true })
    const color = 'rgba(34, 211, 238, 0.6)'
    const r0c0 = boxOf(root, 0, 0)
    expect(r0c0.style.boxShadow).toContain(`inset 0 1px 0 0 ${color}`)
    expect(r0c0.style.boxShadow).toContain(`inset 0 -1px 0 0 ${color}`)
    expect(r0c0.style.boxShadow).toContain(`inset 1px 0 0 0 ${color}`)
    const r0c1 = boxOf(root, 0, 1)
    expect(r0c1.style.boxShadow).toContain(`inset 0 1px 0 0 ${color}`)
    expect(r0c1.style.boxShadow).toContain(`inset 0 -1px 0 0 ${color}`)
    expect(r0c1.style.boxShadow).toContain(`inset -1px 0 0 0 ${color}`)
    const r2c0 = boxOf(root, 2, 0)
    expect(r2c0.style.boxShadow).toContain(`inset 0 1px 0 0 ${color}`)
    expect(r2c0.style.boxShadow).toContain(`inset 0 -1px 0 0 ${color}`)
    expect(r2c0.style.boxShadow).toContain(`inset 1px 0 0 0 ${color}`)
    expect(boxOf(root, 1, 0).style.boxShadow).toBe('')
  })

  it('Delete on a selected row removes the row and keeps focus in the grid', async () => {
    render(DataGrid, { value: [['h'], ['a'], ['b'], ['c']] })
    const root = await screen.findByTestId('data-grid')
    await fireEvent.mouseDown(rowSelector(root, 1))
    await fireEvent.keyDown(rowSelector(root, 1), { key: 'Delete' })
    await vi.waitFor(() => expect(root.textContent).toContain('3 rows · 1 columns'))
    expect(hasCellValue(root, 'a')).toBe(false)
    expect(hasCellValue(root, 'b')).toBe(true)
    await vi.waitFor(() => expect(document.activeElement).toBe(rowSelector(root, 1)))
  })

  it('Delete on a selected column removes the column and keeps focus in the grid', async () => {
    render(DataGrid, {
      value: [
        ['a', 'b', 'c'],
        ['1', '2', '3'],
      ],
    })
    const root = await screen.findByTestId('data-grid')
    await fireEvent.mouseDown(colSelector(root, 1))
    await fireEvent.keyDown(colSelector(root, 1), { key: 'Delete' })
    await vi.waitFor(() => expect(root.textContent).toContain('2 rows · 2 columns'))
    expect(hasCellValue(root, 'b')).toBe(false)
    expect(hasCellValue(root, 'a')).toBe(true)
    await vi.waitFor(() => expect(document.activeElement).toBe(colSelector(root, 1)))
  })

  it('Delete on a selected row removes all selected rows', async () => {
    render(DataGrid, { value: [['h'], ['a'], ['b'], ['c']] })
    const root = await screen.findByTestId('data-grid')
    await fireEvent.mouseDown(rowSelector(root, 1))
    await fireEvent.mouseDown(rowSelector(root, 3), { ctrlKey: true })
    await fireEvent.keyDown(rowSelector(root, 1), { key: 'Delete' })
    await vi.waitFor(() => expect(root.textContent).toContain('2 rows · 1 columns'))
    expect(hasCellValue(root, 'a')).toBe(false)
    expect(hasCellValue(root, 'b')).toBe(true)
    expect(hasCellValue(root, 'c')).toBe(false)
  })

  it('ArrowDown on the last selected row appends a new row and selects it', async () => {
    render(DataGrid, {
      value: [
        ['h1', 'h2'],
        ['a1', 'a2'],
        ['b1', 'b2'],
      ],
    })
    const root = await screen.findByTestId('data-grid')
    await fireEvent.mouseDown(rowSelector(root, 2))
    await fireEvent.keyDown(rowSelector(root, 2), { key: 'ArrowDown' })
    await vi.waitFor(() => expect(root.textContent).toContain('4 rows · 2 columns'))
    expect(boxOf(root, 3, 0).className).toContain('bg-slate-800')
    await vi.waitFor(() => expect(document.activeElement).toBe(rowSelector(root, 3)))
  })

  it('ArrowRight on the last selected column appends a new column and selects it', async () => {
    render(DataGrid, {
      value: [
        ['a', 'b'],
        ['1', '2'],
      ],
    })
    const root = await screen.findByTestId('data-grid')
    await fireEvent.mouseDown(colSelector(root, 1))
    await fireEvent.keyDown(colSelector(root, 1), { key: 'ArrowRight' })
    await vi.waitFor(() => expect(root.textContent).toContain('2 rows · 3 columns'))
    expect(boxOf(root, 0, 2).className).toContain('bg-slate-800')
    await vi.waitFor(() => expect(document.activeElement).toBe(colSelector(root, 2)))
  })

  it('Ctrl+drag adds a second disjoint region to the selection', async () => {
    render(DataGrid, {
      value: [
        ['h1', 'h2', 'h3'],
        ['a1', 'a2', 'a3'],
        ['b1', 'b2', 'b3'],
      ],
    })
    const root = await screen.findByTestId('data-grid')
    await fireEvent.mouseDown(boxOf(root, 1, 0))
    await fireEvent.mouseDown(boxOf(root, 1, 0), { ctrlKey: true })
    await fireEvent.mouseEnter(boxOf(root, 2, 1))
    await fireEvent.mouseUp(window)
    expect(boxOf(root, 1, 0).className).toContain('bg-slate-800')
    expect(boxOf(root, 2, 1).className).toContain('bg-slate-800')
    expect(boxOf(root, 2, 0).className).toContain('bg-slate-800')
    expect(boxOf(root, 1, 1).className).toContain('bg-slate-800')
    await fireEvent.mouseDown(boxOf(root, 1, 2), { ctrlKey: true })
    await fireEvent.mouseEnter(boxOf(root, 2, 2))
    await fireEvent.mouseUp(window)
    expect(boxOf(root, 1, 2).className).toContain('bg-slate-800')
    expect(boxOf(root, 2, 2).className).toContain('bg-slate-800')
    expect(boxOf(root, 0, 1).className).not.toContain('bg-slate-800')
    expect(boxOf(root, 0, 2).className).not.toContain('bg-slate-800')
  })

  it('after deleting columns clears the column selection and focuses the first deleted index', async () => {
    render(DataGrid, {
      value: [
        ['a', 'b', 'c'],
        ['1', '2', '3'],
      ],
    })
    const root = await screen.findByTestId('data-grid')
    await fireEvent.mouseDown(colSelector(root, 0))
    await fireEvent.mouseDown(colSelector(root, 2), { ctrlKey: true })
    await fireEvent.keyDown(colSelector(root, 2), { key: 'Delete' })
    await vi.waitFor(() => expect(root.textContent).toContain('2 rows · 1 columns'))
    expect(hasCellValue(root, '1')).toBe(false)
    expect(hasCellValue(root, '3')).toBe(false)
    expect(boxOf(root, 0, 0).className).not.toContain('bg-slate-800')
    await vi.waitFor(() => expect(document.activeElement).toBe(colSelector(root, 0)))
  })

  it('ArrowRight at the last column expands the column from a data cell', async () => {
    render(DataGrid, {
      value: [
        ['h1', 'h2'],
        ['a1', 'a2'],
        ['b1', 'b2'],
      ],
    })
    const root = await screen.findByTestId('data-grid')
    const box = boxOf(root, 2, 1)
    box.focus()
    await fireEvent.keyDown(box, { key: 'ArrowRight' })
    await vi.waitFor(() => expect(root.textContent).toContain('3 rows · 3 columns'))
    expect(boxOf(root, 2, 2).className).toContain('ring-cyan-500/60')
    await vi.waitFor(() => expect(document.activeElement).toBe(boxOf(root, 2, 2)))
  })

  it('clicking a cell without modifiers clears the current selection and selects only that cell', async () => {
    render(DataGrid, {
      value: [
        ['a', 'b'],
        ['1', '2'],
        ['3', '4'],
      ],
    })
    const root = await screen.findByTestId('data-grid')
    await fireEvent.mouseDown(boxOf(root, 1, 0))
    await fireEvent.mouseEnter(boxOf(root, 2, 1))
    await fireEvent.mouseUp(window)
    expect(boxOf(root, 1, 1).className).toContain('bg-slate-800')
    expect(boxOf(root, 2, 0).className).toContain('bg-slate-800')
    await fireEvent.mouseDown(boxOf(root, 2, 0))
    expect(boxOf(root, 1, 1).className).not.toContain('bg-slate-800')
    expect(boxOf(root, 2, 1).className).not.toContain('bg-slate-800')
    expect(boxOf(root, 2, 0).className).toContain('ring-cyan-500/60')
  })
})
