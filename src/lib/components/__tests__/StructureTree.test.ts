// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'
import StructureTree from '../StructureTree.svelte'

describe('StructureTree', () => {
  it('renders a container tree with the root expanded', async () => {
    render(StructureTree, { value: { nested: { a: 1 } } })
    const root = screen.getByTestId('structure-tree')
    expect(root.textContent).toContain('object{1}')
    expect(root.textContent).toContain('nested')
    const toggle = within(root).getByRole('button', { name: /expand nested/i }) as HTMLButtonElement
    await fireEvent.click(toggle)
    expect(root.textContent).toContain('1')
  })

  it('renders arrays with an array label', () => {
    render(StructureTree, { value: [1, 2] })
    const root = screen.getByTestId('structure-tree')
    expect(root.textContent).toContain('array[2]')
    expect(root.textContent).toContain('0')
    expect(root.textContent).toContain('2')
  })

  it('renders scalar values directly', () => {
    render(StructureTree, { value: 42 })
    const root = screen.getByTestId('structure-tree')
    expect(root.textContent).toContain('42')
  })

  it('shows a placeholder for undefined values', () => {
    render(StructureTree, { value: undefined })
    const root = screen.getByTestId('structure-tree')
    expect(root.textContent).toContain('No content to preview')
  })

  it('reports leaf value edits through onChange', async () => {
    const onChange = vi.fn()
    render(StructureTree, { value: { name: 'root' }, onChange })
    const root = screen.getByTestId('structure-tree')

    const editBtn = within(root).getByRole('button', { name: 'Edit name' }) as HTMLButtonElement
    await fireEvent.click(editBtn)
    const input = root.querySelector('input') as HTMLInputElement
    await fireEvent.input(input, { target: { value: 'changed' } })
    await fireEvent.keyDown(input, { key: 'Enter' })

    expect(onChange).toHaveBeenCalledWith(['name'], 'changed')
  })

  it('reports key renames with onRenameKey', async () => {
    const onRenameKey = vi.fn()
    render(StructureTree, { value: { oldKey: 42 }, onRenameKey })
    const root = screen.getByTestId('structure-tree')

    const keySpan = within(root).getByText('oldKey')
    await fireEvent.dblClick(keySpan)
    const input = root.querySelector('input') as HTMLInputElement
    await fireEvent.input(input, { target: { value: 'newKey' } })
    await fireEvent.keyDown(input, { key: 'Enter' })

    expect(onRenameKey).toHaveBeenCalledWith([], 'oldKey', 'newKey')
  })

  it('renders a read-only tree when no callbacks are provided', () => {
    render(StructureTree, { value: { name: 'root' } })
    const root = screen.getByTestId('structure-tree')
    expect(within(root).queryByRole('button', { name: 'Edit name' })).toBeNull()
    expect(within(root).getByRole('button', { name: 'Copy name' })).toBeTruthy()
  })
})