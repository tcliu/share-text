let yamlModulePromise: Promise<typeof import('yaml')> | null = null

function loadYaml() {
  if (!yamlModulePromise) {
    yamlModulePromise = import('yaml').catch(error => {
      yamlModulePromise = null
      throw error
    })
  }
  return yamlModulePromise
}

export interface ValidationResult {
  valid: boolean
  error?: string
}

export function validateJson(text: string): ValidationResult {
  try {
    JSON.parse(text)
    return { valid: true }
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Invalid JSON',
    }
  }
}

export async function validateYaml(text: string): Promise<ValidationResult> {
  try {
    const { parse } = await loadYaml()
    parse(text)
    return { valid: true }
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Invalid YAML',
    }
  }
}

export function validateCsv(text: string): ValidationResult {
  if (text.trim() === '') {
    return { valid: true }
  }
  const lines = text.split(/\r\n|\r|\n/)
  let expectedColumns: number | null = null
  let lineNumber = 0
  for (const line of lines) {
    lineNumber += 1
    if (line.trim() === '') {
      continue
    }
    const columns = countCsvColumns(line)
    if (columns === null) {
      return { valid: false, error: `Unclosed quote in line ${lineNumber}` }
    }
    if (expectedColumns === null) {
      expectedColumns = columns
    } else if (columns !== expectedColumns) {
      return {
        valid: false,
        error: `Line ${lineNumber} has ${columns} columns; expected ${expectedColumns}`,
      }
    }
  }
  return { valid: true }
}

function countCsvColumns(line: string): number | null {
  let count = 1
  let inQuotes = false
  let i = 0
  while (i < line.length) {
    const char = line[i]
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          i += 2
          continue
        }
        inQuotes = false
      }
      i += 1
    } else if (char === '"') {
      inQuotes = true
      i += 1
    } else if (char === ',') {
      count += 1
      i += 1
    } else {
      i += 1
    }
  }
  return inQuotes ? null : count
}

export function formatJson(text: string, indent: number): { ok: boolean; value?: string; error?: string } {
  try {
    const parsed = JSON.parse(text)
    return { ok: true, value: JSON.stringify(parsed, null, indent) }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Invalid JSON',
    }
  }
}

export async function formatYaml(text: string, indent = 2): Promise<{ ok: boolean; value?: string; error?: string }> {
  if (text.trim() === '') {
    return { ok: true, value: '' }
  }
  try {
    const { parse, stringify } = await loadYaml()
    const parsed = parse(text)
    return { ok: true, value: stringify(parsed, { indent, lineWidth: 0 }) }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Invalid YAML',
    }
  }
}

export async function convertJsonToYaml(
  text: string,
  indent = 2,
): Promise<{ ok: boolean; value?: string; error?: string }> {
  try {
    const { stringify } = await loadYaml()
    const parsed = JSON.parse(text)
    return { ok: true, value: stringify(parsed, { indent, lineWidth: 0 }) }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Invalid JSON',
    }
  }
}

export async function convertYamlToJson(
  text: string,
  indent = 2,
): Promise<{ ok: boolean; value?: string; error?: string }> {
  if (text.trim() === '') {
    return { ok: true, value: '' }
  }
  try {
    const { parse } = await loadYaml()
    const parsed = parse(text)
    return { ok: true, value: JSON.stringify(parsed, null, indent) }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Invalid YAML',
    }
  }
}

function parseXml(text: string): { error?: string } {
  if (typeof DOMParser === 'undefined') {
    return { error: 'XML parsing is not available' }
  }
  const doc = new DOMParser().parseFromString(text, 'application/xml')
  const parserError = doc.querySelector('parsererror')
  if (parserError) {
    return { error: (parserError.textContent ?? 'Invalid XML').trim() }
  }
  return {}
}

export function validateXml(text: string): ValidationResult {
  if (text.trim() === '') {
    return { valid: true }
  }
  const { error } = parseXml(text)
  return error ? { valid: false, error } : { valid: true }
}

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

function formatMarkup(
  text: string,
  indent: number,
  html: boolean,
): { ok: boolean; value?: string; error?: string } {
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
