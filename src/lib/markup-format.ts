import { parseXml } from './xml-utils'

const MARKUP_VOID_TAGS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
])

const MARKUP_RAW_BLOCK_TAGS = ['script', 'style', 'pre', 'textarea']

function tokenizeMarkup(text: string, html: boolean): string[] {
  const rawBlocks = html
    ? '<script\\b[^>]*>[\\s\\S]*?<\\/script\\s*>|<style\\b[^>]*>[\\s\\S]*?<\\/style\\s*>|<pre\\b[^>]*>[\\s\\S]*?<\\/pre\\s*>|<textarea\\b[^>]*>[\\s\\S]*?<\\/textarea\\s*>|'
    : ''
  const re = new RegExp(
    `(<!--[\\s\\S]*?-->|<!\\[CDATA\\[[\\s\\S]*?\\]\\]>|<!DOCTYPE[\\s\\S]*?>|<\\?[\\s\\S]*?\\?>|${rawBlocks}<[^>]+>|[^<]+)`,
    'gi',
  )
  return text.match(re) ?? []
}

function formatMarkup(text: string, indent: number, html: boolean): { ok: boolean; value?: string; error?: string } {
  if (text.trim() === '') {
    return { ok: true, value: '' }
  }
  if (!html) {
    const { error } = parseXml(text)
    if (error) {
      return { ok: false, error }
    }
  }
  const pad = ' '.repeat(indent)
  const lines: string[] = []
  let depth = 0
  for (const token of tokenizeMarkup(text, html)) {
    if (token.startsWith('<!--') || token.startsWith('<![CDATA[')) {
      lines.push(pad.repeat(depth) + token)
      continue
    }
    if (token.startsWith('<!DOCTYPE') || token.startsWith('<?')) {
      lines.push(pad.repeat(depth) + token)
      continue
    }
    const rawOpen = token.match(/^<(script|style|pre|textarea)\b[^>]*>/i)
    if (rawOpen) {
      const closeStart = token.lastIndexOf('</')
      const openEnd = token.indexOf('>') + 1
      if (closeStart > openEnd) {
        lines.push(pad.repeat(depth) + token.slice(0, openEnd))
        const inner = token
          .slice(openEnd, closeStart)
          .replace(/^\r?\n/, '')
          .replace(/\r?\n$/, '')
        for (const line of inner.split(/\r?\n/)) {
          lines.push(pad.repeat(depth) + line)
        }
        lines.push(pad.repeat(depth) + token.slice(closeStart))
        continue
      }
    }
    if (token.startsWith('</')) {
      depth = Math.max(0, depth - 1)
      lines.push(pad.repeat(depth) + token)
      continue
    }
    if (token.startsWith('<')) {
      const name = token.match(/^<([\w:-]+)/)?.[1]?.toLowerCase()
      const isSelfClosing = token.endsWith('/>') || (html && name !== undefined && MARKUP_VOID_TAGS.has(name))
      lines.push(pad.repeat(depth) + token)
      if (!isSelfClosing && name !== undefined) {
        depth += 1
      }
      continue
    }
    const collapsed = token.replace(/\s+/g, ' ').trim()
    if (collapsed !== '') {
      lines.push(pad.repeat(depth) + collapsed)
    }
  }
  return { ok: true, value: lines.join('\n') }
}

export function formatHtml(text: string, indent = 2): { ok: boolean; value?: string; error?: string } {
  return formatMarkup(text, indent, true)
}

export function formatXml(text: string, indent = 2): { ok: boolean; value?: string; error?: string } {
  return formatMarkup(text, indent, false)
}
