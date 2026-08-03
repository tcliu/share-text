import { describe, expect, it } from 'vitest'
import { resolveProfile } from '$lib/server/profile'

describe('resolveProfile', () => {
  it('defaults to dev', () => {
    expect(resolveProfile({})).toBe('dev')
    expect(resolveProfile({ NODE_ENV: 'development' })).toBe('dev')
    expect(resolveProfile({ NODE_ENV: 'test' })).toBe('dev')
  })

  it('resolves prod when NODE_ENV is production', () => {
    expect(resolveProfile({ NODE_ENV: 'production' })).toBe('prod')
  })

  it('honors an explicit PROFILE override', () => {
    expect(resolveProfile({ PROFILE: 'prod', NODE_ENV: 'development' })).toBe('prod')
    expect(resolveProfile({ PROFILE: 'dev', NODE_ENV: 'production' })).toBe('dev')
    expect(resolveProfile({ PROFILE: 'PROD' })).toBe('prod')
    expect(resolveProfile({ PROFILE: 'Dev' })).toBe('dev')
  })

  it('ignores unknown PROFILE values', () => {
    expect(resolveProfile({ PROFILE: 'staging', NODE_ENV: 'production' })).toBe('prod')
    expect(resolveProfile({ PROFILE: 'staging' })).toBe('dev')
  })
})
