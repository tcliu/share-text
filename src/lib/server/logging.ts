// Shared server-side event logging: one line per event in the documented format
// `<ISO timestamp> <LEVEL> ip=<ip> action=<action> <key>=<JSON value> ...`. The
// CLI-side sibling is `scripts/log-event.mjs`, which emits the same shape with
// `ip=unknown` (scripts run without a request context); the format itself lives
// in `src/lib/server/log-format.mjs` so a change lands once.
//
// Never pass connection strings, secrets, passwords, or session contents — only
// identifiers, counts, and error messages.
import type { RequestEvent } from '@sveltejs/kit'
import { errorMessage, formatLogLine as baseFormatLogLine } from './log-format.mjs'

// The script-side log line and the server's describe a failure the same way, so
// the message extractor lives with the format in `log-format.mjs`.
export { errorMessage }

export type LogLevel = 'INFO' | 'WARN' | 'ERROR'

/** Format one event as `key=JSON` fields; a `level` detail overrides the default. */
export function formatLogLine(input: { action: string; ip?: string; details?: Record<string, unknown> }): string {
  return baseFormatLogLine(input)
}

export interface LogEventInput {
  action: string
  /** Client IP; defaults to `unknown` when there is no request context. */
  ip?: string
  details?: Record<string, unknown>
}

/** Emit one structured event line; the stream is injectable so tests capture it. */
export function logEvent(input: LogEventInput, stream: (line: string) => void = console.log): void {
  stream(formatLogLine({ ...input, ip: input.ip ?? 'unknown' }))
}

export function logAccess(input: { event: RequestEvent; action: string; details?: Record<string, unknown> }): void {
  const { event, action, details = {} } = input
  const ip = getRequestIp(event)
  logEvent({ ip, action, details })
}

/** Best-effort client IP from a SvelteKit `getClientAddress`; `unknown` off-request. */
export function clientIp(getClientAddress: () => string): string {
  try {
    return getClientAddress() || 'unknown'
  } catch {
    return 'unknown'
  }
}

export function getRequestIp(event: { request: Request; getClientAddress: () => string }): string {
  try {
    return event.getClientAddress()
  } catch (error) {
    const trustedProxy = process.env.VERCEL === '1' || process.env.TRUSTED_PROXY === '1'
    const forwardedFor = trustedProxy ? (event.request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? '') : ''
    logEvent({
      ip: forwardedFor || 'unknown',
      action: 'client_ip_resolve_error',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
        source: forwardedFor ? 'x-forwarded-for' : 'none',
      },
    })
    return forwardedFor
  }
}

