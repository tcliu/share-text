import { indentLess } from '@codemirror/commands'
import { EditorSelection, RangeSetBuilder, type Extension } from '@codemirror/state'
import { Decoration, EditorView } from '@codemirror/view'
import { githubDark, githubLight } from '@uiw/codemirror-theme-github'

// Language packs are loaded on demand, one chunk per document type, so the
// editor never bundles the languages a given document does not use. A host
// that never passes `docType` (it defaults to `'text'`) loads no language,
// exactly like an editor without language support.
export const LANGUAGE_LOADERS: Record<string, () => Promise<Extension | null>> = {
  html: () => import('@codemirror/lang-html').then(m => m.html()),
  javascript: () => import('@codemirror/lang-javascript').then(m => m.javascript()),
  json: () => import('@codemirror/lang-json').then(m => m.json()),
  markdown: () => import('@codemirror/lang-markdown').then(m => m.markdown()),
  xml: () => import('@codemirror/lang-xml').then(m => m.xml()),
  yaml: () => import('@codemirror/lang-yaml').then(m => m.yaml()),
}

export function loadEditorLanguage(documentType: string): Promise<Extension | null> {
  return LANGUAGE_LOADERS[documentType]?.() ?? Promise.resolve(null)
}

// Chrome colors are CSS variables when the host theme defines them (the
// themed host keeps its palette in its stylesheet) and fall back to the
// fixed dark values otherwise, so an unthemed host renders the same dark
// chrome it always did. `theme` stays a plain string so the shared file
// never imports a per-app settings module.
export function colorThemeExtensions(theme: string): Extension[] {
  return [
    theme === 'dark' || theme === 'ember' || theme === 'forest' || theme === 'midnight' || theme === 'nebula'
      ? githubDark
      : githubLight,
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
        caretColor: 'var(--cm-caret, rgb(103 232 249))',
      },
      '.cm-gutters': {
        color: 'var(--cm-gutterColor, rgb(100 116 139))',
        borderRight: '1px solid var(--cm-gutterBorder, rgb(51 65 85))',
      },
      '.cm-activeLineGutter': {
        backgroundColor: 'var(--cm-activeLineGutter, rgba(22, 27, 34, 0.95))',
      },
      '.cm-activeLine': {
        backgroundColor: 'var(--cm-activeLine, rgba(48, 54, 61, 0.45))',
      },
      '.cm-cursor, .cm-dropCursor': {
        borderLeftColor: 'var(--cm-caret, rgb(103 232 249))',
      },
      '.cm-selectionBackground, ::selection': {
        backgroundColor: 'var(--cm-selection, rgba(56, 139, 253, 0.35))',
      },
      // Playback marks take their color from a theme token. Without a fallback
      // a host that defines no token paints no highlight at all, because the
      // unresolved `var()` drops the whole declaration. The defaults match
      // the dark palette the other CodeMirror chrome fallbacks above use.
      '.cm-playbackHighlight': {
        backgroundColor: 'var(--cm-playbackHighlight, rgba(34, 211, 238, 0.28))',
        borderRadius: '0.125rem',
      },
      '.cm-playbackHighlightSelected': {
        backgroundColor: 'var(--cm-playbackHighlightSelected, rgba(52, 211, 153, 0.32))',
        borderRadius: '0.125rem',
      },
      '.cm-selectionBackground .cm-playbackHighlight, .cm-playbackHighlight.cm-selectionBackground, .cm-content:has(.cm-selectionBackground) .cm-playbackHighlight':
        {
          backgroundColor: 'var(--cm-playbackHighlightSelected, rgba(52, 211, 153, 0.32)) !important',
        },
      '.cm-selectionDisabled': {
        userSelect: 'none',
      },
      '.cm-focused': {
        outline: 'none',
      },
    }),
  ]
}

export const playbackHighlightMark = Decoration.mark({ class: 'cm-playbackHighlight' })
export const playbackHighlightSelectedMark = Decoration.mark({ class: 'cm-playbackHighlightSelected' })

export function playbackHighlightField(from: number | null, to: number | null, selected = false): Extension {
  return EditorView.decorations.compute([], () => {
    if (from == null || to == null || from >= to) {
      return Decoration.none
    }
    const builder = new RangeSetBuilder<Decoration>()
    builder.add(from, to, selected ? playbackHighlightSelectedMark : playbackHighlightMark)
    return builder.finish()
  })
}

export function selectionGuardExtension(enabled: boolean): Extension {
  if (enabled) return []
  return EditorView.domEventHandlers({
    dragstart(event) {
      event.preventDefault()
      return true
    },
  })
}

export function selectionAttrExtension(enabled: boolean): Extension {
  return EditorView.contentAttributes.of({
    class: enabled ? '' : 'cm-selectionDisabled',
  })
}

// Large pastes through the browser's native contenteditable path force
// CodeMirror to reverse-engineer the change from DOM mutations (seconds
// for hundreds of KB). Applying the plain-text clipboard payload as a
// single transaction reaches the same document state without that pass.
export function pasteExtension(isEditable: () => boolean): Extension {
  return EditorView.domEventHandlers({
    paste(event, view) {
      // While playback locks the editor the DOM is not editable, so a
      // paste event cannot arrive; refuse defensively to match that.
      if (!isEditable()) {
        return false
      }
      const text = event.clipboardData?.getData('text/plain') ?? ''
      if (text.length === 0) {
        return false
      }
      event.preventDefault()
      view.dispatch(view.state.replaceSelection(text), { userEvent: 'input.paste', scrollIntoView: true })
      return true
    },
  })
}

export function insertTwoSpaces(view: EditorView | null): boolean {
  if (!view) return false
  view.dispatch(view.state.replaceSelection('  '), { userEvent: 'input', scrollIntoView: true })
  return true
}

export function removeTwoSpaces(view: EditorView | null): boolean {
  if (!view) return false
  const state = view.state
  const main = state.selection.main
  if (!main.empty) {
    return indentLess({ state, dispatch: view.dispatch })
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
  view.dispatch({ changes: { from, to }, userEvent: 'delete.dedent', scrollIntoView: true })
  return true
}

export { EditorSelection }
