// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'
import StructurePreview from '../StructurePreview.svelte'

describe('StructurePreview', () => {
  it('renders a JSON node tree with first level expanded', async () => {
    render(StructurePreview, {
      content: '{"name":"root","nested":{"a":1,"b":2}}',
    })
    const root = await screen.findByTestId('structure-preview')
    await vi.waitFor(() => expect(root.textContent).toContain('name'))
    expect(root.textContent).toContain('nested')
    // nested children are collapsed by default
    expect(root.textContent).not.toContain('"a"')
    expect(root.textContent).not.toContain('"b"')
  })

  it('parses YAML content into a node tree', async () => {
    render(StructurePreview, { content: 'name: root\ncount: 3' })
    const root = await screen.findByTestId('structure-preview')
    await vi.waitFor(() => expect(root.textContent).toContain('name'))
    expect(root.textContent).toContain('"root"')
    expect(root.textContent).toContain('count')
  })

  it('expands nested containers when toggled', async () => {
    render(StructurePreview, {
      content: '{"nested":{"a":1}}',
    })
    const root = await screen.findByTestId('structure-preview')
    await vi.waitFor(() => expect(root.textContent).toContain('nested'))
    const toggle = within(root).getByRole('button', { name: /expand nested/i }) as HTMLButtonElement
    await fireEvent.click(toggle)
    await vi.waitFor(() => expect(root.textContent).toContain('1'))
  })

  it('shows an error for unparseable content', async () => {
    render(StructurePreview, { content: '{not valid' })
    const root = await screen.findByTestId('structure-preview')
    await vi.waitFor(() => expect(root.textContent).toMatch(/Unable to parse/))
  })

  it('shows a placeholder for empty content', async () => {
    render(StructurePreview, { content: '' })
    const root = await screen.findByTestId('structure-preview')
    await vi.waitFor(() => expect(root.textContent).toContain('No content to preview'))
  })

  it('copies a sub-node value, not the parent node', async () => {
    const writeText = vi.fn()
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })

    render(StructurePreview, { content: '{"parent":{"child":{"grand":1}}}' })
    const root = await screen.findByTestId('structure-preview')
    await vi.waitFor(() => expect(root.textContent).toContain('parent'))

    const parentToggle = within(root).getByRole('button', { name: /expand parent/i }) as HTMLButtonElement
    await fireEvent.click(parentToggle)
    await vi.waitFor(() => expect(root.textContent).toContain('child'))

    const childCopy = within(root).getByRole('button', { name: 'Copy child' }) as HTMLButtonElement
    await fireEvent.click(childCopy)

    expect(writeText).toHaveBeenCalledWith('{\n  "grand": 1\n}')
    expect(writeText).not.toHaveBeenCalledWith('{\n  "child": {\n    "grand": 1\n  }\n}')
  })
})
