// Five-field POSIX cron expressions, evaluated in UTC at minute resolution.
// Numeric fields only: `*`, `n`, `a-b`, `*/s`, `a-b/s`, and comma-separated
// lists of those, plus the `@minutely`/`@hourly`/`@daily`/`@weekly`/`@monthly`/
// `@yearly` macros. Day-of-month and day-of-week combine as OR when both are
// restricted (POSIX), which `cronMatches`/`nextCronMatch` implement through
// `dayMatches`.

export interface CronField {
  /** Sorted allowed values. */
  values: number[]
  set: Set<number>
  /** False when the field was `*` (every value allowed). */
  restricted: boolean
}

export interface ParsedCron {
  minute: CronField
  hour: CronField
  dayOfMonth: CronField
  month: CronField
  dayOfWeek: CronField
}

const MACROS: Record<string, string> = {
  '@minutely': '* * * * *',
  '@hourly': '0 * * * *',
  '@daily': '0 0 * * *',
  '@midnight': '0 0 * * *',
  '@weekly': '0 0 * * 0',
  '@monthly': '0 0 1 * *',
  '@yearly': '0 0 1 1 *',
  '@annually': '0 0 1 1 *',
}

// A search beyond this many days is treated as "no upcoming run": only
// calendar-defying expressions (e.g. Feb 29 under a day-of-month rule) reach it.
const MAX_SEARCH_DAYS = 1826

const MINUTE_MS = 60_000
const DAY_MS = 86_400_000

function parseField(text: string, min: number, max: number, wrapValue?: number): CronField | null {
  const values = new Set<number>()
  let restricted = false

  for (const token of text.split(',')) {
    if (!token) {
      return null
    }
    const [rangeText, stepText] = token.split('/')
    let step = 1
    if (stepText !== undefined) {
      if (!/^\d+$/.test(stepText)) {
        return null
      }
      step = Number(stepText)
      if (step < 1) {
        return null
      }
    }
    if (rangeText === '*') {
      restricted = restricted || stepText !== undefined
      addRange(values, min, max, step, wrapValue)
      continue
    }
    const bounds = rangeText.split('-')
    if (bounds.length === 1) {
      const single = parseFieldNumber(bounds[0], min, max)
      if (single === null) {
        return null
      }
      // `n/s` runs from n to the field maximum, matching common cron dialects.
      if (stepText !== undefined) {
        addRange(values, single, max, step, wrapValue)
      } else {
        values.add(normalize(single, wrapValue))
      }
      restricted = true
      continue
    }
    if (bounds.length !== 2) {
      return null
    }
    const from = parseFieldNumber(bounds[0], min, max)
    const to = parseFieldNumber(bounds[1], min, max)
    if (from === null || to === null || from > to) {
      return null
    }
    addRange(values, from, to, step, wrapValue)
    restricted = true
  }

  if (values.size === 0) {
    return null
  }
  return { values: [...values].sort((a, b) => a - b), set: values, restricted }
}

function parseFieldNumber(text: string, min: number, max: number): number | null {
  if (!/^\d+$/.test(text)) {
    return null
  }
  const value = Number(text)
  if (value < min || value > max) {
    return null
  }
  return value
}

function addRange(values: Set<number>, from: number, to: number, step: number, wrapValue?: number): void {
  for (let value = from; value <= to; value += step) {
    values.add(normalize(value, wrapValue))
  }
}

// Day-of-week accepts both 0 and 7 for Sunday; the stored field is 0-based.
function normalize(value: number, wrapValue?: number): number {
  return wrapValue !== undefined && value === wrapValue ? 0 : value
}

export function parseCronExpression(text: string): ParsedCron | null {
  const trimmed = (text || '').trim()
  if (!trimmed) {
    return null
  }
  const expanded = trimmed.startsWith('@') ? MACROS[trimmed.toLowerCase()] : trimmed
  if (!expanded) {
    return null
  }
  const fields = expanded.split(/\s+/)
  if (fields.length !== 5) {
    return null
  }
  const minute = parseField(fields[0], 0, 59)
  const hour = parseField(fields[1], 0, 23)
  const dayOfMonth = parseField(fields[2], 1, 31)
  const month = parseField(fields[3], 1, 12)
  const dayOfWeek = parseField(fields[4], 0, 7, 7)
  if (!minute || !hour || !dayOfMonth || !month || !dayOfWeek) {
    return null
  }
  return { minute, hour, dayOfMonth, month, dayOfWeek }
}

// POSIX day rule: when both day fields are restricted the day matches if
// either does; a single restricted field must match on its own.
function dayMatches(parsed: ParsedCron, day: Date): boolean {
  if (!parsed.month.set.has(day.getUTCMonth() + 1)) {
    return false
  }
  const domMatch = parsed.dayOfMonth.set.has(day.getUTCDate())
  const dowMatch = parsed.dayOfWeek.set.has(day.getUTCDay())
  if (parsed.dayOfMonth.restricted && parsed.dayOfWeek.restricted) {
    return domMatch || dowMatch
  }
  if (parsed.dayOfMonth.restricted) {
    return domMatch
  }
  if (parsed.dayOfWeek.restricted) {
    return dowMatch
  }
  return true
}

export function cronMatches(parsed: ParsedCron, date: Date): boolean {
  return (
    parsed.minute.set.has(date.getUTCMinutes()) && parsed.hour.set.has(date.getUTCHours()) && dayMatches(parsed, date)
  )
}

// First matching minute strictly after `from`, or null when no match occurs
// within the search horizon.
export function nextCronMatch(parsed: ParsedCron, from: Date): Date | null {
  const startMs = Math.floor(from.getTime() / MINUTE_MS) * MINUTE_MS + MINUTE_MS
  const start = new Date(startMs)
  const startDayMs = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate())

  for (let dayOffset = 0; dayOffset <= MAX_SEARCH_DAYS; dayOffset += 1) {
    const dayMs = startDayMs + dayOffset * DAY_MS
    const day = new Date(dayMs)
    if (!dayMatches(parsed, day)) {
      continue
    }
    for (const hour of parsed.hour.values) {
      for (const minute of parsed.minute.values) {
        const candidateMs = dayMs + hour * 3_600_000 + minute * MINUTE_MS
        if (candidateMs >= startMs) {
          return new Date(candidateMs)
        }
      }
    }
  }

  return null
}
