<script lang="ts">
  import { marked } from 'marked'
  import type { PreviewProps } from '$lib/document-types'

  let { content }: PreviewProps = $props()

  const srcdoc = $derived(renderDocument(content))

  function renderDocument(md: string): string {
    const bodyHtml = md.trim()
      ? marked.parse(md, { breaks: true, gfm: true }) as string
      : '<div class="placeholder">No content to preview</div>'

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html { -webkit-text-size-adjust: 100%; }
  body {
    background: #020617;
    color: #cbd5e1;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    font-size: 0.9375rem;
    line-height: 1.7;
    padding: 1.5rem 2rem;
    max-width: 52rem;
    margin: 0;
  }
  h1, h2, h3, h4, h5, h6 {
    color: #f1f5f9;
    font-weight: 600;
    line-height: 1.35;
    margin-bottom: 0.5rem;
  }
  h1 { font-size: 1.75rem; margin-top: 2rem; border-bottom: 1px solid #334155; padding-bottom: 0.4rem; }
  h2 { font-size: 1.375rem; margin-top: 1.75rem; border-bottom: 1px solid #1e293b; padding-bottom: 0.3rem; }
  h3 { font-size: 1.125rem; margin-top: 1.5rem; }
  h4 { font-size: 1rem; margin-top: 1.25rem; }
  h1:first-child, h2:first-child, h3:first-child { margin-top: 0; }
  p { margin-bottom: 0.75rem; }
  a { color: #22d3ee; text-decoration: none; }
  a:hover { text-decoration: underline; }
  strong { color: #f1f5f9; }
  ul, ol { margin: 0.5rem 0 0.75rem 1.5rem; }
  li { margin-bottom: 0.25rem; }
  li > ul, li > ol { margin-bottom: 0; }
  blockquote {
    border-left: 3px solid #0e7490;
    background: rgba(14, 116, 144, 0.08);
    margin: 0.75rem 0;
    padding: 0.5rem 1rem;
    color: #94a3b8;
  }
  blockquote p:last-child { margin-bottom: 0; }
  code {
    background: #1e293b;
    color: #f1f5f9;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 0.8125rem;
    padding: 0.15rem 0.35rem;
    border-radius: 0.25rem;
  }
  pre {
    background: #0f172a;
    border: 1px solid #334155;
    border-radius: 0.375rem;
    margin: 0.75rem 0;
    padding: 1rem;
    overflow-x: auto;
  }
  pre code {
    background: none;
    color: #cbd5e1;
    padding: 0;
    font-size: 0.8125rem;
    line-height: 1.55;
  }
  hr {
    border: 0;
    border-top: 1px solid #334155;
    margin: 1.5rem 0;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 0.75rem 0;
    font-size: 0.875rem;
  }
  th, td {
    border: 1px solid #334155;
    padding: 0.4rem 0.75rem;
    text-align: left;
  }
  th {
    background: #0f172a;
    color: #f1f5f9;
    font-weight: 600;
  }
  img { max-width: 100%; border-radius: 0.375rem; }
  .placeholder { color: #475569; font-style: italic; }
</style>
</head>
<body>${bodyHtml}</body>
</html>`
  }
</script>

<iframe
  title="Markdown preview"
  sandbox="allow-same-origin"
  srcdoc={srcdoc}
  class="h-full w-full rounded-lg border border-slate-700 bg-slate-950"></iframe>
