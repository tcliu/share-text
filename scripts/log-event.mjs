// CLI-side sibling of src/lib/server/logging: one line per event in the shared
// format (`<ISO timestamp> <LEVEL> ip=<ip> action=<action> <key>=<JSON>`), so
// script output stays greppable next to server logs. Scripts run without a
// request context, so ip is always `unknown`. The format lives in
// `src/lib/server/log-format.mjs` and is imported by both runtimes so a change lands
// once.
//
// Never pass connection strings, secrets, passwords, or document contents —
// only identifiers and counts.
import { formatLogLine } from '../src/lib/server/log-format.mjs'

export function logEvent({ action, details = {} }) {
  console.log(formatLogLine({ action, ip: 'unknown', details }))
}

export function errorMessage(error) {
  if (error instanceof Error && error.message) return error.message
  if (error && typeof error.message === 'string' && error.message) return error.message
  return String(error)
}
