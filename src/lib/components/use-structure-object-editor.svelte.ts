// The StructureTree node's own object-edit dialog: the open flag, the seed/draft
// pair (the parsed document only commits on save, so cancelling never touches
// live state), and the save/format/reset/close transitions.
export interface StructureObjectEditorOptions {
  getValue: () => object | unknown[]
  getPath: () => string[]
  getOnChange: () => ((path: string[], newValue: unknown) => void) | undefined
}

export function createStructureObjectEditor(opts: StructureObjectEditorOptions) {
  let open = $state(false)
  let seed = $state('')
  let draft = $state('')

  const dirty = $derived(draft !== seed)
  const valid = $derived.by(() => {
    try {
      JSON.parse(draft)
      return true
    } catch {
      return false
    }
  })

  function openEditor() {
    seed = JSON.stringify(opts.getValue(), null, 2)
    draft = seed
    open = true
  }

  function save() {
    const change = opts.getOnChange()
    if (!change) {
      open = false
      return
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(draft)
    } catch {
      return
    }
    change(opts.getPath(), parsed)
    open = false
  }

  function format() {
    try {
      draft = JSON.stringify(JSON.parse(draft), null, 2)
    } catch {
      // Unreachable while the Format button is enabled; never half-applies.
    }
  }

  function reset() {
    draft = seed
  }

  function close() {
    open = false
  }

  return {
    get open() {
      return open
    },
    get draft() {
      return draft
    },
    set draft(value: string) {
      draft = value
    },
    get dirty() {
      return dirty
    },
    get valid() {
      return valid
    },
    openEditor,
    save,
    format,
    reset,
    close,
  }
}
