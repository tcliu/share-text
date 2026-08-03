import type { RequestEvent } from '@sveltejs/kit'

export function logAccess(input: { event: RequestEvent; action: string; details?: Record<string, unknown> }): void {
  const { event, action, details = {} } = input
  const ip = getRequestIp(event)
  logEvent({ ip, action, details })
}

export function logEvent(input: { ip: string; action: string; details?: Record<string, unknown> }): void {
  const { ip, action, details = {} } = input
  const timestamp = new Date().toISOString()
  const defaultLevel = action.endsWith('_error') ? 'ERROR' : 'INFO'
  const { level = defaultLevel, ...rest } = details
  const serializedDetails = Object.entries(rest)
    .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
    .join(' ')
  console.log(
    `${timestamp} ${level} ip=${ip || 'unknown'} action=${action}${serializedDetails ? ` ${serializedDetails}` : ''}`,
  )
}

function getRequestIp(event: { request: Request; getClientAddress: () => string }): string {
  const { request, getClientAddress } = event
  try {
    return getClientAddress()
  } catch {
    const forwardedFor = request.headers.get('x-forwarded-for')
    if (forwardedFor) {
      return forwardedFor.split(',')[0].trim()
    }
    return 'unknown'
  }
}
