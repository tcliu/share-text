<script lang="ts">
  import { tick } from 'svelte'
  import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
  import { bracketMatching, indentOnInput, indentUnit } from '@codemirror/language'
  import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete'
  import { search, searchKeymap } from '@codemirror/search'
  import { EditorSelection, EditorState, Compartment, type Extension } from '@codemirror/state'
  import { EditorView, drawSelection, keymap, lineNumbers } from '@codemirror/view'
  import { maxContentLengthFilter } from './code-editor-max-content'
  import {
    colorThemeExtensions,
    insertTwoSpaces,
    loadEditorLanguage,
    pasteExtension,
    playbackHighlightField,
    removeTwoSpaces,
    selectionAttrExtension,
    selectionGuardExtension,
  } from './code-editor-extensions'

  interface Props {
    content: string
    editable?: boolean
    docType?: string
    selectionEnabled?: boolean
    theme?: string
    containerClass?: string
    editorClass?: string
    editorAriaLabel?: string
    autoFocus?: boolean
    recreateKey?: string
    maxContentLength?: number
    onReady?: () => void
    onAutoFocused?: () => void
    onContentChange?: (content: string) => void
    onSelectionChange?: (range: { from: number; to: number } | null) => void
  }

  let {
    content = $bindable(),
    editable = true,
    docType = 'text',
    selectionEnabled = true,
    theme = 'dark',
    containerClass = '',
    editorClass = '',
    editorAriaLabel = 'Content',
    autoFocus = false,
    recreateKey = '',
    maxContentLength = 0,
    onReady,
    onAutoFocused,
    onContentChange,
    onSelectionChange,
  }: Props = $props()

  let editorContainerRef = $state<HTMLDivElement | null>(null)
  let editorView = $state<EditorView | null>(null)
  let lastEditable = false
  let lastSelectionEnabled = true
  let lastTheme = 'dark'
  const editableCompartment = new Compartment()
  const colorThemeCompartment = new Compartment()
  const playbackHighlightCompartment = new Compartment()
  const selectionGuardCompartment = new Compartment()
  const selectionAttrCompartment = new Compartment()

  function createEditorExtensions(languageExtensions: Extension[] = []): Extension[] {
    return [
      colorThemeCompartment.of(colorThemeExtensions(theme)),
      editableCompartment.of(EditorView.editable.of(editable)),
      selectionGuardCompartment.of(selectionGuardExtension(selectionEnabled)),
      selectionAttrCompartment.of(selectionAttrExtension(selectionEnabled)),
      pasteExtension(() => editable),
      ...languageExtensions,
      drawSelection(),
      playbackHighlightCompartment.of(playbackHighlightField(null, null)),
      lineNumbers(),
      search({ top: true }),
      history(),
      bracketMatching(),
      closeBrackets(),
      indentOnInput(),
      indentUnit.of('  '),
      EditorState.tabSize.of(2),
      EditorView.lineWrapping,
      maxContentLengthFilter(maxContentLength),
      EditorView.contentAttributes.of({
        'aria-label': editorAriaLabel,
        'aria-multiline': 'true',
      }),
      EditorView.updateListener.of(update => {
        if (update.docChanged) {
          const next = update.state.doc.toString()
          content = next
          onContentChange?.(next)
        }
        if (update.selectionSet) {
          const main = update.state.selection.main
          if (!lastSelectionEnabled && main.from !== main.to) {
            update.view.dispatch({
              selection: EditorSelection.cursor(main.head),
              userEvent: 'select.pointer.collapse',
            })
            return
          }
          onSelectionChange?.(main.from === main.to ? null : { from: main.from, to: main.to })
        }
      }),
      keymap.of([
        { key: 'Tab', run: () => insertTwoSpaces(editorView), preventDefault: true },
        { key: 'Shift-Tab', run: () => removeTwoSpaces(editorView), preventDefault: true },
        ...closeBracketsKeymap,
        ...defaultKeymap,
        ...historyKeymap,
        ...searchKeymap,
      ]),
    ]
  }

  function syncEditorDocument(nextContent: string) {
    if (!editorView) return
    const current = editorView.state.doc.toString()
    if (current === nextContent) return
    if (onSelectionChange) {
      // The host observes selection, so a wholesale replacement invalidates
      // any selection computed against the previous document; mapping it
      // instead would leak the old highlight into the new document as a
      // phantom range. Collapse to the start of the incoming text explicitly.
      editorView.dispatch({
        changes: { from: 0, to: current.length, insert: nextContent },
        selection: EditorSelection.cursor(0),
      })
      return
    }
    editorView.dispatch({
      changes: { from: 0, to: current.length, insert: nextContent },
      filter: false,
    })
  }

  $effect(() => {
    void recreateKey
    void docType
    let cancelled = false
    tick()
      .then(async () => {
        if (cancelled || !editorContainerRef) {
          editorView?.destroy()
          editorView = null
          return
        }
        const languageExtension = await loadEditorLanguage(docType)
        if (cancelled) {
          return
        }
        const languageExtensions = languageExtension ? [languageExtension] : []
        editorView?.destroy()
        editorView = new EditorView({
          state: EditorState.create({
            doc: content,
            extensions: createEditorExtensions(languageExtensions),
          }),
          parent: editorContainerRef,
        })
        lastEditable = editable
        lastSelectionEnabled = selectionEnabled
        lastTheme = theme
        if (autoFocus) {
          editorView.focus()
          onAutoFocused?.()
        }
        // Notify parent that the EditorView is ready so pending selections can be applied
        onReady?.()
      })
      .catch(error => {
        if (!cancelled) {
          console.error('Failed to load editor language support', error)
        }
      })
    return () => {
      cancelled = true
    }
  })

  $effect(() => {
    void editable
    if (!editorView || editable === lastEditable) return
    lastEditable = editable
    editorView.dispatch({
      effects: editableCompartment.reconfigure(EditorView.editable.of(editable)),
    })
  })

  $effect(() => {
    void selectionEnabled
    if (!editorView || selectionEnabled === lastSelectionEnabled) return
    lastSelectionEnabled = selectionEnabled
    editorView.dispatch({
      effects: [
        selectionGuardCompartment.reconfigure(selectionGuardExtension(selectionEnabled)),
        selectionAttrCompartment.reconfigure(selectionAttrExtension(selectionEnabled)),
      ],
    })
  })

  $effect(() => {
    void theme
    if (!editorView || theme === lastTheme) return
    lastTheme = theme
    editorView.dispatch({
      effects: colorThemeCompartment.reconfigure(colorThemeExtensions(theme)),
    })
  })

  export function focus() {
    editorView?.focus()
  }

  export function hasFocus(): boolean {
    return editorView?.hasFocus ?? false
  }

  export function getSelectionText(): string {
    if (!editorView) return ''
    const { from, to } = editorView.state.selection.main
    if (from === to) return ''
    return editorView.state.sliceDoc(from, to)
  }

  export function getSelectionRange(): { from: number; to: number } | null {
    if (!editorView) return null
    const { from, to } = editorView.state.selection.main
    if (from === to) return null
    return { from, to }
  }

  export function getCaretPosition(): number | null {
    if (!editorView) return null
    return editorView.state.selection.main.head
  }

  export function setSelection(from: number, to: number): boolean {
    if (!editorView) return false
    editorView.focus()
    const sel = EditorSelection.create([EditorSelection.range(from, to)])
    editorView.dispatch({ selection: sel, scrollIntoView: true })
    return true
  }

  export function clearSelection() {
    if (!editorView) return
    const pos = editorView.state.selection.main.anchor
    const sel = EditorSelection.create([EditorSelection.range(pos, pos)])
    editorView.dispatch({ selection: sel })
  }

  export function setPlaybackHighlight(from: number, to: number) {
    if (!editorView) return
    editorView.dispatch({
      effects: playbackHighlightCompartment.reconfigure(playbackHighlightField(from, to, false)),
      scrollIntoView: true,
    })
  }

  export function setPlaybackHighlightSelected(from: number, to: number) {
    if (!editorView) return
    editorView.dispatch({
      effects: playbackHighlightCompartment.reconfigure(playbackHighlightField(from, to, true)),
      scrollIntoView: true,
    })
  }

  export function clearPlaybackHighlight() {
    if (!editorView) return
    editorView.dispatch({
      effects: playbackHighlightCompartment.reconfigure(playbackHighlightField(null, null)),
    })
  }

  $effect(() => {
    if (!editorView) return
    void content
    syncEditorDocument(content)
  })

  $effect(() => {
    return () => {
      editorView?.destroy()
      editorView = null
    }
  })
</script>

<div class={containerClass}>
  <div bind:this={editorContainerRef} role="textbox" aria-label={editorAriaLabel} class={editorClass}></div>
</div>
