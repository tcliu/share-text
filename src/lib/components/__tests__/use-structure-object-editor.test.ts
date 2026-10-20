import { describe, expect, it, vi } from 'vitest'
import { createStructureObjectEditor } from '../use-structure-object-editor.svelte'

type ChangeHandler = (path: string[], nextValue: unknown) => void

function createEditor(value: object | unknown[], onChange?: ChangeHandler) {
  return createStructureObjectEditor({
    getValue: () => value,
    getPath: () => ['config'],
    getOnChange: () => onChange,
  })
}

describe('createStructureObjectEditor', () => {
  it('seeds the draft from the node value and starts clean', () => {
    const editor = createEditor({ a: 1, b: [2] })

    editor.openEditor()

    expect(editor.open).toBe(true)
    expect(editor.draft).toBe(JSON.stringify({ a: 1, b: [2] }, null, 2))
    expect(editor.dirty).toBe(false)
    expect(editor.valid).toBe(true)
  })

  it('tracks dirtiness and JSON validity as the draft is edited', () => {
    const editor = createEditor({ a: 1 })
    editor.openEditor()

    editor.draft = '{ "a": 2 }'
    expect(editor.dirty).toBe(true)
    expect(editor.valid).toBe(true)

    editor.draft = '{ "a": '
    expect(editor.valid).toBe(false)
  })

  it('formats the draft without changing its meaning', () => {
    const editor = createEditor({})
    editor.openEditor()
    editor.draft = '{"a":1,"b":[2,3]}'

    editor.format()

    expect(editor.draft).toBe(JSON.stringify({ a: 1, b: [2, 3] }, null, 2))
  })

  it('resets back to the seed captured when the editor opened', () => {
    const editor = createEditor({ a: 1 })
    editor.openEditor()
    editor.draft = '{ "a": 2 }'

    editor.reset()

    expect(editor.draft).toBe(JSON.stringify({ a: 1 }, null, 2))
    expect(editor.dirty).toBe(false)
  })

  it('commits the parsed draft at the node path on save', () => {
    const onChange = vi.fn()
    const editor = createEditor({ a: 1 }, onChange)
    editor.openEditor()
    editor.draft = '{ "a": 2, "b": [3] }'

    editor.save()

    expect(onChange).toHaveBeenCalledWith(['config'], { a: 2, b: [3] })
    expect(editor.open).toBe(false)
  })

  it('does not commit invalid JSON and stays open', () => {
    const onChange = vi.fn()
    const editor = createEditor({ a: 1 }, onChange)
    editor.openEditor()
    editor.draft = '{ "a": '

    editor.save()

    expect(onChange).not.toHaveBeenCalled()
    expect(editor.open).toBe(true)
  })

  it('closes without a change handler', () => {
    const editor = createEditor({ a: 1 })
    editor.openEditor()
    editor.draft = '{ "a": 2 }'

    editor.save()

    expect(editor.open).toBe(false)
  })
})
