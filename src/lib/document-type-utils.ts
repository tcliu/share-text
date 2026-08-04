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
