import { describe, expect, it } from 'vitest'
import { formatTimestamp } from '$lib/date-format'

describe('formatTimestamp', () => {
  it('formats an ISO timestamp as YYYY-MM-DD HH:MM:SS in local time', () => {
    const date = new Date(2026, 7, 3, 8, 5, 9)
    expect(formatTimestamp(date.toISOString())).toBe('2026-08-03 08:05:09')
  })

  it('zero-pads months, days, hours, minutes, and seconds', () => {
    const date = new Date(2026, 0, 5, 1, 2, 3)
    expect(formatTimestamp(date.toISOString())).toBe('2026-01-05 01:02:03')
  })

  it('passes through unparseable values unchanged', () => {
    expect(formatTimestamp('not-a-date')).toBe('not-a-date')
    expect(formatTimestamp('')).toBe('')
  })
})
