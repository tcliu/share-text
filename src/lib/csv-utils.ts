import Papa from 'papaparse'
import type { ValidationResult } from './document-type-utils'

export function validateCsv(text: string): ValidationResult {
  if (text.trim() === '') {
    return { valid: true }
  }
  const result = Papa.parse<string[]>(text, { header: false, skipEmptyLines: true })
  if (result.errors.length > 0) {
    const first = result.errors[0]
    return { valid: false, error: first.message }
  }
  if (result.data.length > 0) {
    const cols = result.data[0].length
    for (let i = 1; i < result.data.length; i++) {
      if (result.data[i].length !== cols) {
        return {
          valid: false,
          error: `Line ${i + 1} has ${result.data[i].length} columns; expected ${cols}`,
        }
      }
    }
  }
  return { valid: true }
}

export function parseCsv(text: string): string[][] {
  const result = Papa.parse<string[]>(text, { header: false, skipEmptyLines: 'greedy' })
  const rows = result.data
  while (rows.length > 0) {
    const last = rows[rows.length - 1]
    if (last.every(v => v.trim() === '')) {
      rows.pop()
    } else {
      break
    }
  }
  return rows
}

export function serializeCsv(rows: string[][]): string {
  return Papa.unparse(rows, { newline: '\n' })
}
