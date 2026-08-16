// @vitest-environment jsdom
import { fireEvent, render } from '@testing-library/svelte'
import { afterEach, describe, expect, it } from 'vitest'
import { tick } from 'svelte'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import CodeEditorHost from './CodeEditorHost.svelte'
import { maxContentLengthFilter } from '../code-editor-max-content'

const MAX_CONTENT_LENGTH = 100000
const SHORT_CONTENT = 'y'.repeat(311)
const OVER_LIMIT_CONTENT = 'x'.repeat(MAX_CONTENT_LENGTH + 22889)

async function settle() {
  await tick()
  await tick()
  await new Promise(resolve => setTimeout(resolve, 100))
}

describe('CodeEditor syncing document content', () => {
  const rejectionHandlers: ((reason: unknown) => void)[] = []

  afterEach(() => {
    for (const handler of rejectionHandlers) {
      process.removeListener('unhandledRejection', handler)
    }
    rejectionHandlers.length = 0
  })

  it('loads content that exceeds the limit in full instead of truncating it', async () => {
    const rejections: unknown[] = []
    const onRejection = (reason: unknown) => rejections.push(reason)
    process.on('unhandledRejection', onRejection)
    rejectionHandlers.push(onRejection)

    const { getByTestId, rerender } = render(CodeEditorHost, {
      content: SHORT_CONTENT,
      recreateKey: 'A',
      docType: 'text',
      maxContentLength: MAX_CONTENT_LENGTH,
    })
    await settle()

    rerender({
      content: OVER_LIMIT_CONTENT,
      recreateKey: 'B',
      docType: 'text',
      maxContentLength: MAX_CONTENT_LENGTH,
    })
    await settle()

    expect(getByTestId('content-length').textContent).toBe(String(OVER_LIMIT_CONTENT.length))

    rerender({
      content: SHORT_CONTENT,
      recreateKey: 'C',
      docType: 'text',
      maxContentLength: MAX_CONTENT_LENGTH,
    })
    await settle()

    expect(getByTestId('content-length').textContent).toBe(String(SHORT_CONTENT.length))
    expect(rejections.map(reason => reason instanceof Error ? reason.message : String(reason))).toEqual([])
  })
})

describe('CodeEditor Tab / Shift-Tab indentation', () => {
  it('reverts a Tab-added indent with Shift-Tab on the same line', async () => {
    const { container } = render(CodeEditorHost, { content: '  hello' })
    await settle()

    const contentEl = container.querySelector('.cm-content')
    expect(contentEl).not.toBeNull()

    fireEvent.keyDown(contentEl!, { key: 'Tab', shiftKey: true })
    await tick()

    expect(contentEl!.textContent).toBe('hello')
  })

  it('adds two spaces on Tab and removes them on Shift-Tab', async () => {
    const { container } = render(CodeEditorHost, { content: 'hello' })
    await settle()

    const contentEl = container.querySelector('.cm-content')

    fireEvent.keyDown(contentEl!, { key: 'Tab' })
    await tick()
    expect(contentEl!.textContent).toBe('  hello')

    fireEvent.keyDown(contentEl!, { key: 'Tab', shiftKey: true })
    await tick()
    expect(contentEl!.textContent).toBe('hello')
  })

  it('removes Tab-added spaces at the cursor mid-line', async () => {
    const { container } = render(CodeEditorHost, { content: 'hello world' })
    await settle()

    const contentEl = container.querySelector('.cm-content')
    const view = EditorView.findFromDOM(contentEl as HTMLElement)
    view?.dispatch({ selection: { anchor: 5 } })
    await tick()

    fireEvent.keyDown(contentEl!, { key: 'Tab' })
    await tick()
    expect(contentEl!.textContent).toBe('hello   world')

    fireEvent.keyDown(contentEl!, { key: 'Tab', shiftKey: true })
    await tick()
    expect(contentEl!.textContent).toBe('hello world')
  })

  it('removes trailing Tab-added spaces at end of line', async () => {
    const { container } = render(CodeEditorHost, { content: 'hello' })
    await settle()

    const contentEl = container.querySelector('.cm-content')
    const view = EditorView.findFromDOM(contentEl as HTMLElement)
    view?.dispatch({ selection: { anchor: 5 } })
    await tick()

    fireEvent.keyDown(contentEl!, { key: 'Tab' })
    await tick()
    expect(contentEl!.textContent).toBe('hello  ')

    fireEvent.keyDown(contentEl!, { key: 'Tab', shiftKey: true })
    await tick()
    expect(contentEl!.textContent).toBe('hello')
  })

  it('keeps Shift-Tab from moving focus when there is nothing to remove', async () => {
    const { container } = render(CodeEditorHost, { content: 'hello world' })
    await settle()

    const contentEl = container.querySelector('.cm-content')
    const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true })
    contentEl!.dispatchEvent(event)
    await tick()

    expect(event.defaultPrevented).toBe(true)
  })

  it('keeps inserting spaces while Tab is held (auto-repeat)', async () => {
    const { container } = render(CodeEditorHost, { content: '' })
    await settle()

    const contentEl = container.querySelector('.cm-content')
    for (let i = 0; i < 20; i++) {
      fireEvent.keyDown(contentEl!, { key: 'Tab' })
    }
    await tick()

    expect(contentEl!.textContent).toBe(' '.repeat(40))
  })
})

describe('maxContentLengthFilter', () => {
  it('truncates an edit that pushes the doc past the limit', () => {
    const state = EditorState.create({
      doc: 'x'.repeat(MAX_CONTENT_LENGTH),
      extensions: [maxContentLengthFilter(MAX_CONTENT_LENGTH)],
    })
    const { state: after } = state.update({ changes: { from: MAX_CONTENT_LENGTH, insert: 'y' } })
    expect(after.doc.length).toBe(MAX_CONTENT_LENGTH)
  })

  it('keeps the user edit when truncating a mid-document edit past the limit', () => {
    const state = EditorState.create({
      doc: 'x'.repeat(MAX_CONTENT_LENGTH - 1),
      extensions: [maxContentLengthFilter(MAX_CONTENT_LENGTH)],
    })
    const { state: after } = state.update({ changes: { from: 50000, insert: 'ab' } })
    expect(after.doc.length).toBe(MAX_CONTENT_LENGTH)
    expect(after.doc.sliceString(49999, 50003)).toBe('xabx')
  })

  it('leaves in-range edits untouched', () => {
    const state = EditorState.create({
      doc: 'x'.repeat(10),
      extensions: [maxContentLengthFilter(MAX_CONTENT_LENGTH)],
    })
    const { state: after } = state.update({ changes: { from: 10, insert: 'yyy' } })
    expect(after.doc.toString()).toBe('x'.repeat(10) + 'yyy')
  })
})