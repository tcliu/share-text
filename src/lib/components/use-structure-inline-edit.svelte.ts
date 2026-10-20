// An inline text field: the edit key/text/width/input ref, the focus-on-begin
// effect, and the begin/cancel transitions. The width is the measured width of
// the text being edited, so the field occupies exactly that text's box and the
// surrounding row never moves; typing scrolls inside the field instead of
// widening it. Focusing places the caret at the end (not a select-all), and the
// press gesture that opened the field does not select either, so an edit
// continues the existing text; once the field is open, a double-click selects
// its text normally. The three StructureTree rename/edit flows share this
// machinery; the surrounding component owns the commit and keydown logic.
export function createInlineEdit<K>() {
  let key = $state<K | null>(null)
  let text = $state('')
  let width = $state(0)
  let input = $state<HTMLInputElement | null>(null)

  $effect(() => {
    if (key === null || !input) return
    // An HTML input not focused by a pointer gesture can come up fully
    // selected; collapse the selection to the end so the caret lands there.
    input.focus()
    caretToEnd()
  })

  // Place the caret at the end of the current text.
  function caretToEnd() {
    const el = input
    if (!el) return
    el.setSelectionRange(el.value.length, el.value.length)
  }

  // True from `begin` until the field receives an ordinary press inside it. The
  // gesture that opened the field — the second press of a double-click can land
  // on the freshly mounted input — must not select; once the field has been
  // open and an ordinary press arrives, a double-click selects normally again.
  let entryPress = false

  function isEntryPress(event: MouseEvent): boolean {
    if (!entryPress) return false
    if (event.type === 'dblclick') {
      entryPress = false
      return true
    }
    if (event.detail <= 1) {
      entryPress = false
      return false
    }
    return true
  }

  function begin(nextKey: K, initial: string, nextWidth: number) {
    width = nextWidth
    key = nextKey
    text = initial
    entryPress = true
  }

  function cancel() {
    key = null
    entryPress = false
  }

  return {
    get key() {
      return key
    },
    get text() {
      return text
    },
    set text(value: string) {
      text = value
    },
    get input() {
      return input
    },
    set input(value: HTMLInputElement | null) {
      input = value
    },
    get width() {
      return width
    },
    caretToEnd,
    isEntryPress,
    begin,
    cancel,
  }
}
