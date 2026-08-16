export function useCaretAtEndOnKeyboardFocus(node: HTMLElement) {
  let suppressCaretToEnd = false
  let suppressTimer: ReturnType<typeof setTimeout> | undefined

  const onMousedown = () => {
    suppressCaretToEnd = true
    clearTimeout(suppressTimer)
    suppressTimer = setTimeout(() => {
      suppressCaretToEnd = false
    })
  }

  const onFocusin = (event: FocusEvent) => {
    if (suppressCaretToEnd) return
    const target = event.target
    if (!(target instanceof HTMLInputElement) || target.disabled) return
    try {
      target.setSelectionRange(target.value.length, target.value.length)
    } catch {
      // Input types without selection support (e.g. type="number").
    }
  }

  node.addEventListener('mousedown', onMousedown)
  node.addEventListener('focusin', onFocusin)

  return {
    destroy() {
      node.removeEventListener('mousedown', onMousedown)
      node.removeEventListener('focusin', onFocusin)
      clearTimeout(suppressTimer)
    },
  }
}
