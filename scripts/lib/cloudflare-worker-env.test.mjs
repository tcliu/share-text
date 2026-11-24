import { describe, expect, it } from 'vitest'

import {
  diffDesiredSecrets,
  findOrphanSecrets,
  parseWorkerSecretList,
  readWorkerSecretNames,
} from './cloudflare-worker-env.mjs'

describe('parseWorkerSecretList', () => {
  it('returns the names from wrangler JSON output', () => {
    expect(parseWorkerSecretList('[{"name":"A","type":"secret_text"},{"name":"B"}]')).toEqual(['A', 'B'])
  })

  it('returns null for non-JSON or non-array output', () => {
    expect(parseWorkerSecretList('not json')).toBeNull()
    expect(parseWorkerSecretList('{"name":"A"}')).toBeNull()
    expect(parseWorkerSecretList('')).toBeNull()
  })

  it('drops entries without a name', () => {
    expect(parseWorkerSecretList('[{"name":"A"},{"type":"secret_text"}]')).toEqual(['A'])
  })
})

describe('readWorkerSecretNames', () => {
  it('reads names through the injected runner', () => {
    const calls = []
    const runner = args => {
      calls.push(args.join(' '))
      return { status: 0, output: '[{"name":"SESSION_SECRET"}]' }
    }
    expect(readWorkerSecretNames({ worker: 'sample-app', runner, cwd: '/root' })).toEqual(['SESSION_SECRET'])
    expect(calls).toEqual(['secret list --name sample-app --format json'])
  })

  it('returns null when the Worker is not deployed yet', () => {
    const runner = () => ({ status: 1, output: 'No access to the specified resource.' })
    expect(readWorkerSecretNames({ worker: 'missing', runner, cwd: '/root' })).toBeNull()
  })
})

describe('diffDesiredSecrets', () => {
  it('separates missing from present names', () => {
    expect(diffDesiredSecrets({ A: 'a', B: 'b' }, ['B', 'C'])).toEqual({ missing: ['A'], present: ['B'] })
  })
})

describe('findOrphanSecrets', () => {
  it('lists deployed secrets outside the desired universe', () => {
    expect(findOrphanSecrets(['A', 'OLD'], ['A', 'B', 'C'])).toEqual(['OLD'])
  })
})
