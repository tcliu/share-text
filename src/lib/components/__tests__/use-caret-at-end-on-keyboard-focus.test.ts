// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { useCaretAtEndOnKeyboardFocus } from '../use-caret-at-end-on-keyboard-focus.svelte'

function setup() {
  const container = document.createElement('div')
  const input = document.createElement('input')
  input.value = 'hello'
  container.appendChild(input)
  document.body.appendChild(container)
  const action = useCaretAtEndOnKeyboardFocus(container)
  return { container, input, destroy: action.destroy }
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('useCaretAtEndOnKeyboardFocus', () => {
  it('places the caret at the end of the value on keyboard focus', () => {
    const { input, destroy } = setup()
    input.focus()
    input.setSelectionRange(2, 2)
    input.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    expect(input.selectionStart).toBe(input.value.length)
    expect(input.selectionEnd).toBe(input.value.length)
    destroy()
  })

  it('keeps the natural caret placement when focused by mouse', () => {
    const { input, destroy } = setup()
    input.setSelectionRange(0, 0)
    input.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    input.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    expect(input.selectionStart).toBe(0)
    expect(input.selectionEnd).toBe(0)
    destroy()
  })

  it('ignores disabled inputs', () => {
    const { input, destroy } = setup()
    input.disabled = true
    input.setSelectionRange(0, 0)
    input.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    expect(input.selectionStart).toBe(0)
    expect(input.selectionEnd).toBe(0)
    destroy()
  })

  it('stops placing the caret after the action is destroyed', () => {
    const { input, destroy } = setup()
    destroy()
    input.setSelectionRange(0, 0)
    input.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    expect(input.selectionStart).toBe(0)
    expect(input.selectionEnd).toBe(0)
  })
})
