<script lang="ts">
  import { tick } from 'svelte'
  import { EditorState, EditorSelection, type Extension } from '@codemirror/state'
  import { EditorView, keymap, lineNumbers } from '@codemirror/view'
  import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
  import { bracketMatching, indentOnInput, indentUnit } from '@codemirror/language'
  import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete'
  import { githubDark } from '@uiw/codemirror-theme-github'

  interface Props {
    content: string
    editable?: boolean
    containerClass?: string
    editorClass?: string
    editorAriaLabel?: string
    autoFocus?: boolean
    recreateKey?: string
    maxContentLength?: number
    onContentChange?: (content: string) => void
  }

  let {
    content = $bindable(),
    editable = true,
    containerClass = '',
    editorClass = '',
    editorAriaLabel = 'Content',
    autoFocus = false,
    recreateKey = '',
    maxContentLength = 0,
    onContentChange,
  }: Props = $props()

  let editorContainerRef = $state<HTMLDivElement | null>(null)
  let editorView = $state<EditorView | null>(null)

  function insertTwoSpaces(): boolean {
    if (!editorView) return false
    editorView.dispatch(editorView.state.replaceSelection('  '))
    return true
  }

  function createEditorExtensions(): Extension[] {
    return [
      githubDark,
      EditorView.editable.of(editable),
      lineNumbers(),
      history(),
      bracketMatching(),
      closeBrackets(),
      indentOnInput(),
      indentUnit.of('  '),
      EditorState.tabSize.of(2),
      EditorView.lineWrapping,
      EditorState.transactionFilter.of(tr => {
        if (!tr.docChanged || maxContentLength <= 0 || tr.newDoc.length <= maxContentLength) {
          return tr
        }
        const insert = tr.newDoc.toString().slice(0, maxContentLength)
        return [
          tr,
          {
            changes: { from: 0, to: tr.newDoc.length, insert },
            selection: EditorSelection.single(maxContentLength),
            scrollIntoView: true,
          },
        ]
      }),
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
        ...closeBracketsKeymap,
        ...defaultKeymap,
        ...historyKeymap,
      ]),
    ]
  }

  function syncEditorDocument(nextContent: string) {
    if (!editorView) return
    const current = editorView.state.doc.toString()
    if (current === nextContent) return
    editorView.dispatch({
      changes: { from: 0, to: current.length, insert: nextContent },
    })
  }

  $effect(() => {
    void recreateKey
    let cancelled = false
    tick()
      .then(() => {
        if (cancelled || !editorContainerRef) {
          editorView?.destroy()
          editorView = null
          return
        }
        editorView?.destroy()
        editorView = new EditorView({
          state: EditorState.create({
            doc: content,
            extensions: createEditorExtensions(),
          }),
          parent: editorContainerRef,
        })
        if (autoFocus) {
          editorView.focus()
        }
      })
      .catch(error => {
        if (!cancelled) {
          console.error('Failed to initialize editor', error)
        }
      })
    return () => {
      cancelled = true
    }
  })

  export function focus() {
    editorView?.focus()
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
