import type { ValidationResult } from './xml-utils'

export interface PropertiesParseResult {
  ok: boolean
  value?: Record<string, string>
  error?: string
}

function logicalPropertiesLines(text: string): string[] {
  const rawLines = text.split(/\r\n|\r|\n/)
  const lines: string[] = []
  let buffer = ''

  for (const rawLine of rawLines) {
    let line = rawLine
    if (buffer !== '') {
      line = line.replace(/^[ \t\f]+/, '')
    }
    let backslashes = 0
    for (let index = line.length - 1; index >= 0 && line[index] === '\\'; index--) {
      backslashes += 1
    }
    if (backslashes % 2 === 1) {
      buffer += line.slice(0, -1)
      continue
    }
    lines.push(buffer + line)
    buffer = ''
  }

  if (buffer !== '') {
    lines.push(buffer)
  }
  return lines
}

function unescapeProperties(text: string): string {
  let out = ''
  for (let index = 0; index < text.length; index++) {
    const char = text[index]
    if (char !== '\\') {
      out += char
      continue
    }
    index += 1
    if (index >= text.length) {
      out += '\\'
      break
    }
    const next = text[index]
    if (next === 'u') {
      const hex = text.slice(index + 1, index + 5)
      if (!/^[0-9a-fA-F]{4}$/.test(hex)) {
        throw new Error('Malformed \\uxxxx encoding')
      }
      out += String.fromCharCode(parseInt(hex, 16))
      index += 4
      continue
    }
    switch (next) {
      case 't':
        out += '\t'
        break
      case 'n':
        out += '\n'
        break
      case 'r':
        out += '\r'
        break
      case 'f':
        out += '\f'
        break
      default:
        out += next
    }
  }
  return out
}

export function parseProperties(text: string): PropertiesParseResult {
  const result: Record<string, string> = {}
  try {
    for (const line of logicalPropertiesLines(text)) {
      const trimmed = line.replace(/^[ \t\f]+/, '')
      if (trimmed === '' || trimmed.startsWith('#') || trimmed.startsWith('!')) continue

      let keyEnd = 0
      for (; keyEnd < trimmed.length; keyEnd++) {
        const char = trimmed[keyEnd]
        if (char === '\\') {
          keyEnd += 1
          continue
        }
        if (char === '=' || char === ':' || char === ' ' || char === '\t' || char === '\f') break
      }
      const key = unescapeProperties(trimmed.slice(0, keyEnd))

      let valueStart = keyEnd
      while (valueStart < trimmed.length && ' \t\f'.includes(trimmed[valueStart])) valueStart += 1
      if (valueStart < trimmed.length && (trimmed[valueStart] === '=' || trimmed[valueStart] === ':')) {
        valueStart += 1
        while (valueStart < trimmed.length && ' \t\f'.includes(trimmed[valueStart])) valueStart += 1
      }
      const value = unescapeProperties(trimmed.slice(valueStart))
      result[key] = value
    }
    return { ok: true, value: result }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Invalid properties',
    }
  }
}

function escapeProperties(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
    .replace(/\f/g, '\\f')
    .replace(/[=:#!]/g, char => `\\${char}`)
}

function escapePropertiesKey(key: string): string {
  return escapeProperties(key).replace(/ /g, '\\ ')
}

function escapePropertiesValue(value: string): string {
  return escapeProperties(value).replace(/^ +/, spaces => '\\ '.repeat(spaces.length))
}

export function serializeProperties(record: Record<string, string>): string {
  return Object.entries(record)
    .map(([key, value]) => `${escapePropertiesKey(key)}=${escapePropertiesValue(value)}`)
    .join('\n')
}

export function validateProperties(text: string): ValidationResult {
  if (text.trim() === '') {
    return { valid: true }
  }
  const parsed = parseProperties(text)
  return parsed.ok ? { valid: true } : { valid: false, error: parsed.error }
}

export function formatProperties(text: string): { ok: boolean; value?: string; error?: string } {
  if (text.trim() === '') {
    return { ok: true, value: '' }
  }
  const parsed = parseProperties(text)
  if (!parsed.ok) {
    return { ok: false, error: parsed.error }
  }
  const entries = parsed.value ?? {}
  const sorted: Record<string, string> = {}
  for (const key of Object.keys(entries).sort()) {
    sorted[key] = entries[key]
  }
  return { ok: true, value: serializeProperties(sorted) }
}

export async function convertPropertiesToJson(
  text: string,
  indent = 2,
): Promise<{ ok: boolean; value?: string; error?: string }> {
  if (text.trim() === '') {
    return { ok: true, value: '' }
  }
  const parsed = parseProperties(text)
  if (!parsed.ok) {
    return { ok: false, error: parsed.error }
  }
  return { ok: true, value: JSON.stringify(parsed.value, null, indent) }
}
