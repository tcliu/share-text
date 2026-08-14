// @vitest-environment jsdom
import { render } from '@testing-library/svelte'
import { afterEach, describe, expect, it } from 'vitest'
import { tick } from 'svelte'
import { EditorState } from '@codemirror/state'
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