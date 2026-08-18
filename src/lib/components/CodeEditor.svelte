<script lang="ts">
  import { tick } from 'svelte'
  import { EditorState, EditorSelection, type Extension } from '@codemirror/state'
  import { EditorView, keymap, lineNumbers } from '@codemirror/view'
  import { defaultKeymap, history, historyKeymap, indentLess } from '@codemirror/commands'
  import { bracketMatching, indentOnInput, indentUnit } from '@codemirror/language'
  import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete'
  import { search, searchKeymap } from '@codemirror/search'
  import { githubDark } from '@uiw/codemirror-theme-github'
  import { getDocumentType } from '$lib/document-types'
  import { maxContentLengthFilter } from './code-editor-max-content'

  interface Props {
    content: string
    editable?: boolean
    docType?: string
    containerClass?: string
    editorClass?: string
    editorAriaLabel?: string
    autoFocus?: boolean
    recreateKey?: string
    maxContentLength?: number
    onReady?: () => void
    onAutoFocused?: () => void
    onContentChange?: (content: string) => void
  }

  let {
    content = $bindable(),
    editable = true,
    docType = 'text',
    containerClass = '',
    editorClass = '',
    editorAriaLabel = 'Content',
    autoFocus = false,
    recreateKey = '',
    maxContentLength = 0,
    onReady,
    onAutoFocused,
    onContentChange,
  }: Props = $props()

  let editorContainerRef = $state<HTMLDivElement | null>(null)
  let editorView = $state<EditorView | null>(null)

  function insertTwoSpaces(): boolean {
    if (!editorView) return false
    editorView.dispatch(editorView.state.replaceSelection('  '), { userEvent: 'input', scrollIntoView: true })
    return true
  }

  function removeTwoSpaces(): boolean {
    if (!editorView) return false
    const state = editorView.state
    const main = state.selection.main
    if (!main.empty) {
      return indentLess({ state, dispatch: editorView.dispatch })
    }
    const line = state.doc.lineAt(main.from)
    let from: number
    let to: number
    const before = state.doc.sliceString(Math.max(line.from, main.from - 2), main.from)
    if (before.length > 0 && /^[ \t]+$/.test(before)) {
      from = main.from - before.length
      to = main.from
    } else {
      const leading = /^[ \t]*/.exec(line.text)?.[0] ?? ''
      const removeCount = Math.min(leading.length, 2)
      if (removeCount === 0) return false
      from = line.from
      to = line.from + removeCount
    }
    editorView.dispatch({ changes: { from, to }, userEvent: 'delete.dedent', scrollIntoView: true })
    return true
  }

  function createEditorExtensions(languageExtensions: Extension[] = []): Extension[] {
    return [
      githubDark,
      ...languageExtensions,
      EditorView.editable.of(editable),
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
      EditorView.theme({
        '&': {
          height: '100%',
          maxHeight: '100%',
          fontSize: '0.875rem',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace',
        },
        '.cm-scroller': {
          height: '100%',
          overflow: 'auto',
        },
        '.cm-content': {
          paddingTop: '0.75rem',
          paddingRight: '1rem',
          paddingBottom: '0.75rem',
          paddingLeft: '0.5rem',
          minHeight: '100%',
          caretColor: 'rgb(103 232 249)',
        },
        '.cm-gutters': {
          color: 'rgb(100 116 139)',
          borderRight: '1px solid rgb(51 65 85)',
        },
        '.cm-activeLineGutter': {
          backgroundColor: 'rgba(22, 27, 34, 0.95)',
        },
        '.cm-activeLine': {
          backgroundColor: 'rgba(48, 54, 61, 0.45)',
        },
        '.cm-cursor, .cm-dropCursor': {
          borderLeftColor: 'rgb(103 232 249)',
        },
        '.cm-selectionBackground, ::selection': {
          backgroundColor: 'rgba(56, 139, 253, 0.35)',
        },
        '.cm-focused': {
          outline: 'none',
        },
      }),
      EditorView.updateListener.of(update => {
        if (update.docChanged) {
          const next = update.state.doc.toString()
          content = next
          onContentChange?.(next)
        }
      }),
      keymap.of([
        { key: 'Tab', run: insertTwoSpaces, preventDefault: true },
        { key: 'Shift-Tab', run: removeTwoSpaces, preventDefault: true },
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
        const languageExtension = await getDocumentType(docType).editorLanguage()
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

  export function focus() {
    editorView?.focus()
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
  <div
    bind:this={editorContainerRef}
    role="textbox"
    aria-label={editorAriaLabel}
    class={editorClass}></div>
</div>
