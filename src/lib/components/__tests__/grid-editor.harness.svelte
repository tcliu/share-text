<script lang="ts">
  import { createGridModel } from '../use-grid-model.svelte'
  import { createGridSelection, createInitialSelectionState } from '../use-grid-selection.svelte'
  import { createGridClipboard } from '../use-grid-clipboard'
  import { createGridEditor } from '../use-grid-editor.svelte'
  import type { SelectionFocusHooks } from '../grid-selection-state'

  interface Props {
    rows: string[][]
    headers?: boolean
  }

  let { rows, headers = false }: Props = $props()

  // The editor controller runs against the real model and selection; only the
  // focus hooks are recorded, so the test can assert where the controller moves
  // focus without a real grid in the DOM. The recorded moves also drive the
  // active cell, so a second keystroke lands where the first one moved to.
  const focusCalls = $state<string[]>([])
  let active = $state({ ri: 0, ci: 0 })
  const focus: SelectionFocusHooks = {
    cellBox: (ri, ci) => {
      focusCalls.push(`cellBox:${ri}:${ci}`)
      active = { ri, ci }
    },
    cellInput: (ri, ci) => {
      focusCalls.push(`cellInput:${ri}:${ci}`)
      active = { ri, ci }
    },
    cellInputAtEnd: (ri, ci) => {
      focusCalls.push(`cellInputAtEnd:${ri}:${ci}`)
      active = { ri, ci }
    },
    cellInputSelectAll: (ri, ci) => {
      focusCalls.push(`cellInputSelectAll:${ri}:${ci}`)
      active = { ri, ci }
    },
    startEdit: (ri, ci) => {
      focusCalls.push(`startEdit:${ri}:${ci}`)
      active = { ri, ci }
    },
    rowSelector: ri => focusCalls.push(`rowSelector:${ri}`),
    columnSelector: ci => focusCalls.push(`columnSelector:${ci}`),
    isCellInputFocused: () => false,
  }

  const model = createGridModel({
    getValue: () => rows.map(row => [...row]),
    getHeaders: () => headers,
    onChange: () => {},
  })
  const sel = createGridSelection({
    model,
    focus,
    clipboard: createGridClipboard(),
    state: createInitialSelectionState(),
    isEditable: () => true,
  })
  const editor = createGridEditor({ model, focus, sel, isEditable: () => true })

  // A paste carries its text on the event, so the harness feeds the controller
  // the same shape the browser hands it.
  function paste(text: string) {
    editor.handleBoxPaste(
      {
        target: null,
        currentTarget: null,
        clipboardData: { getData: () => text },
        preventDefault: () => {},
      } as unknown as ClipboardEvent,
      0,
      0,
    )
  }
</script>

<textarea
  data-testid="cell"
  value={model.rows[active.ri]?.cells[active.ci]?.value ?? ''}
  onfocus={() => editor.handleInputFocus(active.ri, active.ci)}
  onkeydown={event => editor.handleInputKeydown(event, active.ri, active.ci)}
  onblur={() => editor.handleBodyBlur()}></textarea>
<button type="button" data-testid="paste" onclick={() => paste('pasted')}>paste</button>
<button type="button" data-testid="set-value" onclick={() => model.setValue(0, 0, 'typed')}>set-value</button>
<div data-testid="values">{JSON.stringify(model.matrix())}</div>
<div data-testid="focus-calls">{focusCalls.join(' ')}</div>
<div data-testid="editing">{editor.isCellEditing(0, 0) ? 'editing' : 'idle'}</div>
