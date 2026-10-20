import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RequestEvent } from '@sveltejs/kit'
import { clientIp, errorMessage, formatLogLine, getRequestIp, logAccess, logEvent } from './logging'

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('formatLogLine', () => {
  it('emits timestamp, default INFO level, ip and JSON-serialized details', () => {
    const line = formatLogLine({ action: 'document_save', ip: '203.0.113.7', details: { id: 42, ok: true } })

    const [timestamp, level, ip, action, ...rest] = line.split(' ')
    expect(timestamp).toMatch(ISO)
    expect(level).toBe('INFO')
    expect(ip).toBe('ip=203.0.113.7')
    expect(action).toBe('action=document_save')
    expect(rest.join(' ')).toBe('id=42 ok=true')
  })

  it('defaults to ERROR for an _error action and lets an explicit level win', () => {
    expect(formatLogLine({ action: 'db_read_error' })).toContain(' ERROR ')
    expect(formatLogLine({ action: 'db_read_error', details: { level: 'WARN' } })).toContain(' WARN ')
    expect(formatLogLine({ action: 'db_read_error', details: { level: 'nonsense' } })).toContain(' ERROR ')
  })

  it('falls back to an unknown ip when none is given', () => {
    expect(formatLogLine({ action: 'boot' })).toContain(' ip=unknown ')
  })
})

describe('logEvent', () => {
  it('writes one formatted line to the injected stream', () => {
    const stream = vi.fn()
    logEvent({ action: 'document_delete', ip: '1.2.3.4', details: { id: 'a1b2c3' } }, stream)

    expect(stream).toHaveBeenCalledOnce()
    expect(stream.mock.calls[0][0]).toContain('action=document_delete')
    expect(stream.mock.calls[0][0]).toContain('id="a1b2c3"')
  })

  it('defaults a missing ip to unknown', () => {
    const stream = vi.fn()
    logEvent({ action: 'startup' }, stream)
    expect(stream.mock.calls[0][0]).toContain(' ip=unknown ')
  })
})

describe('clientIp', () => {
  it('returns the resolved address', () => {
    expect(clientIp(() => '198.51.100.4')).toBe('198.51.100.4')
  })

  it('returns unknown for an empty address or a throwing resolver', () => {
    expect(clientIp(() => '')).toBe('unknown')
    expect(
      clientIp(() => {
        throw new Error('no request context')
      }),
    ).toBe('unknown')
  })
})

function fakeEvent(getClientAddress: () => string, headers: Record<string, string> = {}) {
  return {
    getClientAddress,
    request: new Request('http://localhost/', { headers }),
  } as unknown as Pick<RequestEvent, 'request' | 'getClientAddress'>
}

describe('getRequestIp', () => {
  it('returns the address when the resolver succeeds', () => {
    expect(getRequestIp(fakeEvent(() => '198.51.100.9'))).toBe('198.51.100.9')
  })

  it('falls back to the first x-forwarded-for hop behind a trusted proxy', () => {
    vi.stubEnv('TRUSTED_PROXY', '1')
    const event = fakeEvent(
      () => {
        throw new Error('no adapter address')
      },
      { 'x-forwarded-for': '203.0.113.5, 10.0.0.1' },
    )

    expect(getRequestIp(event)).toBe('203.0.113.5')
  })

  it('honours the VERCEL flag as a trusted proxy', () => {
    vi.stubEnv('VERCEL', '1')
    const event = fakeEvent(
      () => {
        throw new Error('no adapter address')
      },
      { 'x-forwarded-for': '203.0.113.6' },
    )

    expect(getRequestIp(event)).toBe('203.0.113.6')
  })

  it('logs a client_ip_resolve_error and returns unknown without a trusted proxy', () => {
    const stream = vi.spyOn(console, 'log').mockImplementation(() => {})
    const event = fakeEvent(
      () => {
        throw new Error('no adapter address')
      },
      { 'x-forwarded-for': '203.0.113.7' },
    )

    expect(getRequestIp(event)).toBe('')
    const logged = stream.mock.calls.map(call => call.join(' ')).join('\n')
    expect(logged).toContain('action=client_ip_resolve_error')
    expect(logged).toContain('source="none"')
    expect(logged).toContain('error="no adapter address"')
  })
})

describe('logAccess', () => {
  it('resolves the request ip and streams the access line', () => {
    const stream = vi.spyOn(console, 'log').mockImplementation(() => {})
    const event = fakeEvent(() => '198.51.100.10')
    logAccess({ event: event as RequestEvent, action: 'document_get', details: { id: 'a1b2c3' } })

    const logged = stream.mock.calls.map(call => call.join(' ')).join('\n')
    expect(logged).toContain('ip=198.51.100.10')
    expect(logged).toContain('action=document_get')
  })
})

describe('errorMessage', () => {
  it('returns the message of an Error', () => {
    expect(errorMessage(new Error('boom'))).toBe('boom')
  })

  it('falls back to a string message property then String()', () => {
    expect(errorMessage({ message: 'shape error' })).toBe('shape error')
    expect(errorMessage('plain')).toBe('plain')
    expect(errorMessage(null)).toBe('null')
  })
})
