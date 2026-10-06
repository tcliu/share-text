// @vitest-environment node
import { describe, expect, it } from 'vitest'

import {
  TARGETS,
  classifyTargetFlags,
  describeNoAvailableTargets,
  describeUnavailableTargets,
  expandTargetFlag,
  linkableTargetValues,
  planTargetSelection,
  requiredEnvFromConfig,
  resolveConfiguredPlugins,
  resolveRunTargets,
  resolveTargetFlags,
  selectDefaultTargets,
} from './registry.mjs'

describe('expandTargetFlag', () => {
  it('expands all to every registered target by default', () => {
    expect(expandTargetFlag({ raw: 'all' })).toEqual(TARGETS.map(entry => entry.value))
  })

  it('expands all to only the available targets', () => {
    expect(expandTargetFlag({ raw: 'all', availableValues: ['cloudflare'] })).toEqual(['cloudflare'])
  })

  it('keeps an explicit unavailable target so the caller can reject it', () => {
    expect(expandTargetFlag({ raw: 'cloudflare', availableValues: ['vercel'] })).toEqual(['cloudflare'])
  })

  it('splits comma-separated values and drops duplicates', () => {
    expect(expandTargetFlag({ raw: 'vercel,cloudflare,vercel' })).toEqual(['vercel', 'cloudflare'])
  })
})

describe('selectDefaultTargets', () => {
  it('prefers vercel when it is available', () => {
    expect(selectDefaultTargets([], ['vercel', 'cloudflare'])).toEqual(['vercel'])
  })

  it('falls back to the first available target when vercel is unavailable', () => {
    expect(selectDefaultTargets([], ['cloudflare'])).toEqual(['cloudflare'])
  })

  it('keeps an explicit selection unchanged', () => {
    expect(selectDefaultTargets(['cloudflare'], ['vercel', 'cloudflare'])).toEqual(['cloudflare'])
  })
})

describe('classifyTargetFlags', () => {
  it('separates unknown from unavailable targets', () => {
    expect(classifyTargetFlags(['vercel', 'cloudflare', 'nope'], ['vercel'])).toEqual({
      unknown: ['nope'],
      unavailable: ['cloudflare'],
    })
  })

  it('reports nothing for an available selection', () => {
    expect(classifyTargetFlags(['vercel'], ['vercel', 'cloudflare'])).toEqual({ unknown: [], unavailable: [] })
  })
})

describe('resolveTargetFlags', () => {
  it('expands repeated and comma-separated values in order', () => {
    expect(resolveTargetFlags(['vercel,cloudflare', 'vercel'], ['vercel', 'cloudflare'])).toEqual([
      'vercel',
      'cloudflare',
    ])
  })

  it('expands all against only the available targets', () => {
    expect(resolveTargetFlags(['all'], ['cloudflare'])).toEqual(['cloudflare'])
  })
})

describe('target rejection messages', () => {
  const availability = [
    { value: 'vercel', available: false, missing: ['.vercel/project.json (run `vercel link`)'] },
    { value: 'cloudflare', available: true, missing: [] },
  ]

  it('names the missing config for an unavailable target', () => {
    expect(describeUnavailableTargets(['vercel'], availability)).toMatch(/vercel \(\.vercel\/project\.json/)
  })

  it('lists every target when none is available', () => {
    expect(describeNoAvailableTargets(availability)).toMatch(/No deploy target is available/)
  })
})

describe('resolveRunTargets', () => {
  const availability = [
    { value: 'vercel', available: true, missing: [] },
    { value: 'cloudflare', available: false, missing: ['CLOUDFLARE_API_TOKEN (shell or .env.local)'] },
  ]

  it('returns the selection when every target is available', () => {
    expect(resolveRunTargets({ raws: ['vercel'], availableValues: ['vercel'], availability })).toEqual(['vercel'])
  })

  it('throws for an unknown target', () => {
    expect(() => resolveRunTargets({ raws: ['nope'], availableValues: ['vercel'], availability })).toThrow(
      /Unknown target/,
    )
  })

  it('throws for a registered but unavailable target', () => {
    expect(() => resolveRunTargets({ raws: ['cloudflare'], availableValues: ['vercel'], availability })).toThrow(
      /not deployable/,
    )
  })
})

describe('linkableTargetValues', () => {
  it('collects the target of every link-providing plugin', () => {
    expect(
      linkableTargetValues([{ name: 'env-sync' }, { name: 'vercel-link', target: 'vercel', providesLink: true }]),
    ).toEqual(['vercel'])
  })

  it('reports nothing when no plugin links', () => {
    expect(linkableTargetValues([{ name: 'env-sync' }])).toEqual([])
  })
})

describe('resolveConfiguredPlugins', () => {
  it('unions the configured plugins with the auto-gated ones', () => {
    expect(
      resolveConfiguredPlugins({ plugins: ['env-sync'] })
        .map(plugin => plugin.name)
        .sort(),
    ).toEqual(['env-sync', 'heartbeat'])
  })

  it('falls back to the full default set when the config lists no plugins', () => {
    const names = resolveConfiguredPlugins({}).map(plugin => plugin.name)
    expect(names).toContain('env-sync')
    expect(names).toContain('vercel-link')
    expect(names).toContain('heartbeat')
  })
})

describe('requiredEnvFromConfig', () => {
  it('returns the declared per-target required env', () => {
    expect(requiredEnvFromConfig({ requiredEnv: { vercel: ['A'] } })).toEqual({ vercel: ['A'] })
  })

  it('returns an empty map when none is declared', () => {
    expect(requiredEnvFromConfig({})).toEqual({})
  })
})

describe('planTargetSelection', () => {
  const availability = [
    { value: 'vercel', available: true, missing: [] },
    { value: 'cloudflare', available: false, missing: ['CLOUDFLARE_API_TOKEN (shell or .env.local)'] },
  ]

  it('returns the resolved flags, deployable values, and entries', () => {
    const plan = planTargetSelection({ raws: ['vercel'], availability })
    expect(plan.flags).toEqual(['vercel'])
    expect(plan.availableValues).toEqual(['vercel'])
    expect(plan.entries).toEqual([TARGETS[0]])
  })

  it('throws for an explicit unavailable target', () => {
    expect(() => planTargetSelection({ raws: ['cloudflare'], availability })).toThrow(/not deployable/)
  })

  it('throws when no target is deployable', () => {
    const none = availability.map(entry => ({ ...entry, available: false }))
    expect(() => planTargetSelection({ raws: [], availability: none })).toThrow(/No deploy target is available/)
  })
})
