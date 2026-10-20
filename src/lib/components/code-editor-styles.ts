// The editor chrome the eager `CodeEditor` and the lazy `LazyCodeEditor` share.
// It lives in its own side-effect-free module so the lazy surface can import the
// defaults without importing `CodeEditor.svelte`, whose module graph pulls in
// all of CodeMirror: a value import there defeats the dynamic `import()` and
// puts the editor in the initial route bundle.

export const CODE_EDITOR_CONTAINER_CLASS =
  'h-full overflow-hidden rounded-lg border border-slate-700 bg-slate-950'
export const CODE_EDITOR_CLASS = 'h-full'
