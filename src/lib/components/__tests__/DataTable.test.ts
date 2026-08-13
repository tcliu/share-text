// @vitest-environment jsdom
import { fireEvent, render } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'
import DataTable, { type DataTableColumn } from '../DataTable.svelte'

interface Row {
  key: string
  name: string
}

const columns: DataTableColumn<Row>[] = [
  { key: 'key', header: 'Key', width: '10%', minWidth: 160 },
  { key: 'name', header: 'Name', width: '20%', minWidth: 200 },
]

const rows: Row[] = [{ key: 'a1b2c3', name: 'Design notes' }]

function baseProps() {
  return {
    rows,
    rowId: (row: Row) => row.key,
    columns,
    searchAriaLabel: 'Search rows',
    total: 1,
    pageSize: 10,
    currentPage: 1,
    onPageChange: vi.fn(),
    onPageSizeChange: vi.fn(),
  } as any
}

describe('DataTable column width derivation', () => {
  it('applies derived percentage widths rebased to sum to 100', () => {
    const { getByText } = render(DataTable<Row>, { props: baseProps() })

    const keyTh = getByText('Key').closest('th')!
    const nameTh = getByText('Name').closest('th')!

    expect(keyTh.style.width).toBe('33.33%')
    expect(nameTh.style.width).toBe('66.67%')
  })

  it('applies the derived min width to both header and body cells', () => {
    const { getByText } = render(DataTable<Row>, { props: baseProps() })

    const keyTh = getByText('Key').closest('th')!
    const nameTh = getByText('Name').closest('th')!
    expect(keyTh.style.minWidth).toBe('160px')
    expect(nameTh.style.minWidth).toBe('200px')

    const rowCells = Array.from(document.querySelectorAll<HTMLTableCellElement>('tbody tr td'))
    expect(rowCells[0].style.minWidth).toBe('160px')
    expect(rowCells[1].style.minWidth).toBe('200px')
  })

  it('prefers an explicit widthClass over the width prop', () => {
    const { getByText } = render(DataTable<Row>, {
      props: {
        ...baseProps(),
        columns: [{ key: 'name', header: 'Name', widthClass: 'w-[40%]', width: '20%', minWidth: 200 }],
      },
    })

    const nameTh = getByText('Name').closest('th')!
    expect(nameTh.className).toContain('w-[40%]')
    expect(nameTh.style.width).toBe('')
    expect(nameTh.style.minWidth).toBe('200px')
  })

  it('passes through a valid CSS length width', () => {
    const { getByText } = render(DataTable<Row>, {
      props: {
        ...baseProps(),
        columns: [{ key: 'name', header: 'Name', width: '20rem', minWidth: 100 }],
      },
    })

    const nameTh = getByText('Name').closest('th')!
    expect(nameTh.style.width).toBe('20rem')
    expect(nameTh.style.minWidth).toBe('100px')
  })

  it('ignores malformed width and min-width strings and reports them', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { getByText } = render(DataTable<Row>, {
      props: {
        ...baseProps(),
        columns: [{ key: 'name', header: 'Name', width: '12pxfoo', minWidth: 'bogus' }],
      },
    })

    const nameTh = getByText('Name').closest('th')!
    expect(nameTh.style.width).toBe('')
    expect(nameTh.style.minWidth).toBe('')
    expect(errorSpy).toHaveBeenCalledTimes(2)
    errorSpy.mockRestore()
  })

  it('does not crash on a malformed percentage width', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { getByText } = render(DataTable<Row>, {
      props: {
        ...baseProps(),
        columns: [{ key: 'name', header: 'Name', width: '%', minWidth: 100 }],
      },
    })

    const nameTh = getByText('Name').closest('th')!
    expect(nameTh.style.width).toBe('')
    expect(nameTh.style.minWidth).toBe('100px')
    errorSpy.mockRestore()
  })
})

describe('DataTable fillHeight', () => {
  it('caps the table at the available space without forcing it to stretch', () => {
    const { container } = render(DataTable<Row>, { props: { ...baseProps(), fillHeight: true } })

    const root = container.querySelector('div')!
    expect(root.className).toContain('flex-1')
    expect(root.className).toContain('min-h-0')

    const scroll = container.querySelector('.overflow-auto')!
    expect(scroll.className).toContain('min-h-0')
    expect(scroll.className).not.toContain('flex-1')
    expect(scroll.className).not.toContain('max-h-')
  })

  it('keeps the fixed max height when fillHeight is off', () => {
    const { container } = render(DataTable<Row>, { props: baseProps() })

    const root = container.querySelector('div')!
    expect(root.className).not.toContain('flex-1')

    const scroll = container.querySelector('.overflow-auto')!
    expect(scroll.className).toContain('max-h-')
  })
})

describe('DataTable resizable columns', () => {
  it('renders a resize handle per data column only when resizable', () => {
    const { container } = render(DataTable<Row>, { props: baseProps() })
    expect(container.querySelector('button[aria-label^="Resize"]')).toBeNull()

    const resizable = render(DataTable<Row>, { props: { ...baseProps(), resizable: true } })
    const handles = Array.from(
      resizable.container.querySelectorAll('button[aria-label^="Resize "]'),
    )
    expect(handles).toHaveLength(2)
    expect(handles.every(h => h.className.includes('cursor-col-resize'))).toBe(true)
  })

  it('switches to fixed layout with a colgroup once a column starts resizing', async () => {
    const { container } = render(DataTable<Row>, { props: { ...baseProps(), resizable: true } })
    const table = container.querySelector('table') as HTMLTableElement
    expect(table.className).toContain('w-full')
    expect(table.querySelector('colgroup')).toBeNull()

    const handle = container.querySelector('button[aria-label^="Resize "]') as HTMLButtonElement
    await fireEvent.mouseDown(handle)
    await fireEvent.mouseUp(window)

    expect(table.style.tableLayout).toBe('fixed')
    const cols = table.querySelectorAll('colgroup col')
    expect(cols).toHaveLength(2)
  })

  it('persists resized column widths to localStorage under the storageKey', async () => {
    localStorage.clear()
    const { container } = render(DataTable<Row>, { props: { ...baseProps(), resizable: true, storageKey: 'admin-documents' } })
    const ths = Array.from(container.querySelectorAll('th[data-col-index]'))
    Object.defineProperty(ths[0], 'offsetWidth', { configurable: true, value: 200 })
    Object.defineProperty(ths[1], 'offsetWidth', { configurable: true, value: 250 })
    const handle = container.querySelector('button[aria-label^="Resize "]') as HTMLButtonElement
    await fireEvent.mouseDown(handle)
    await fireEvent.keyDown(handle, { key: 'ArrowRight' })
    await fireEvent.mouseUp(window)

    await vi.waitFor(() => expect(localStorage.getItem('share-text:column-widths:admin-documents')).not.toBeNull())
    const stored = JSON.parse(localStorage.getItem('share-text:column-widths:admin-documents')!)
    expect(stored).toEqual([210, 240])
    localStorage.clear()
  })

  it('restores persisted column widths on mount', async () => {
    localStorage.clear()
    localStorage.setItem('share-text:column-widths:admin-documents', JSON.stringify([220, 160]))
    const { container } = render(DataTable<Row>, { props: { ...baseProps(), resizable: true, storageKey: 'admin-documents' } })
    await vi.waitFor(() => {
      const cols = container.querySelectorAll('colgroup col')
      expect(cols).toHaveLength(2)
    })
    const widths = Array.from(container.querySelectorAll('colgroup col')).map(c => parseInt((c as HTMLElement).style.width, 10))
    expect(widths).toEqual([220, 160])
    localStorage.clear()
  })
})
