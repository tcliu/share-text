import { describe, expect, it } from 'vitest'

import { parseFlags } from './lib/cloudflare-env-flags.mjs'

describe('parseFlags', () => {
  it('defaults to a full, non-pruning sync', () => {
    expect(parseFlags([])).toEqual({ dryRun: false, prune: false, secrets: 'always' })
  })

  it('reads --dry-run and --prune', () => {
    expect(parseFlags(['--dry-run', '--prune'])).toEqual({ dryRun: true, prune: true, secrets: 'always' })
  })

  it('accepts --secrets=missing', () => {
    expect(parseFlags(['--secrets=missing'])).toEqual({ dryRun: false, prune: false, secrets: 'missing' })
  })

  it('accepts a repeated flag carrying the same value', () => {
    expect(parseFlags(['--secrets=missing', '--secrets=missing']).secrets).toBe('missing')
  })

  it('rejects conflicting --secrets values', () => {
    expect(() => parseFlags(['--secrets=missing', '--secrets=always'])).toThrow('Conflicting --secrets values')
  })

  it('rejects an unknown --secrets mode', () => {
    expect(() => parseFlags(['--secrets=never'])).toThrow('Unknown --secrets mode: never')
  })

  it('rejects an unknown flag', () => {
    expect(() => parseFlags(['--bogus'])).toThrow('expected --dry-run, --prune, --secrets=always|missing')
  })
})
