#!/usr/bin/env node
// _deploy/registry.mjs — deploy target registry shared by the entry point and
// the interview. Plugin capability selection lives in the project's
// `deploy.config.mjs`; a target's availability is derived from its required
// config at runtime (see `_deploy/preflight.mjs`), never from a support flag.

import { envSyncPlugin } from './plugins/env-sync.mjs'
import { heartbeatPlugin } from './plugins/heartbeat.mjs'
import { vercelLinkPlugin } from './plugins/vercel-link.mjs'

// Selectable capabilities, keyed by the name used in deploy.config.mjs.
export const PLUGINS = new Map([
  [envSyncPlugin.name, envSyncPlugin],
  [heartbeatPlugin.name, heartbeatPlugin],
  [vercelLinkPlugin.name, vercelLinkPlugin],
])

// Plugins loaded in every project; each self-gates at runtime (heartbeat runs
// only when CRONJOB_API_KEY resolves), so a project never lists them.
export const AUTO_PLUGINS = [heartbeatPlugin.name]

// Selection used when a project ships no deploy.config.mjs.
export const DEFAULT_PLUGINS = [...PLUGINS.keys()]

export function resolvePlugins(names = DEFAULT_PLUGINS) {
  return names.map(name => {
    const plugin = PLUGINS.get(name)
    if (!plugin) {
      throw new Error(`Unknown deploy plugin: ${name}`)
    }
    return plugin
  })
}

// Plugin selection unioned with the auto-gated plugins; a project that ships no
// config uses the full default set.
export function resolveConfiguredPlugins(config = {}) {
  const selected = config.plugins ?? DEFAULT_PLUGINS
  return resolvePlugins([...new Set([...AUTO_PLUGINS, ...selected])])
}

// Per-project required env props (`deploy.config.mjs` → `requiredEnv`); empty
// when the project declares none. Enforced by the preflight before any CLI.
export function requiredEnvFromConfig(config = {}) {
  return config.requiredEnv ?? {}
}

export const TARGETS = [
  { value: 'vercel', description: 'Deploy the app to Vercel' },
  {
    value: 'cloudflare',
    description: 'Deploy the app to Cloudflare Pages',
  },
]

// Preferred default target when it is available; `selectDefaultTargets` falls
// back to the first available target otherwise.
export const DEFAULT_TARGET = 'vercel'

// Every registered target value, in registration order.
export const TARGET_VALUES = TARGETS.map(entry => entry.value)

// Expand one `--target` value into the running selection: `all` fans out to
// every available target, comma-separated values are split, and duplicates are
// dropped. Order follows registration. An explicit value is kept even when
// unavailable so the caller can reject it with a clear message.
export function expandTargetFlag({ raw, selected = [], availableValues = TARGET_VALUES } = {}) {
  const next = [...selected]
  for (const part of String(raw || '')
    .split(',')
    .map(piece => piece.trim().toLowerCase())
    .filter(Boolean)) {
    if (part === 'all') {
      for (const value of availableValues) {
        if (!next.includes(value)) {
          next.push(value)
        }
      }
    } else if (!next.includes(part)) {
      next.push(part)
    }
  }
  return next
}

// Default target selection: explicit flags win; otherwise the default target
// when available, else the first available target. `availableValues` is never
// empty here (the entry point rejects a checkout with no reachable target).
export function selectDefaultTargets(targetFlags = [], availableValues = TARGET_VALUES) {
  if (targetFlags.length > 0) return [...targetFlags]
  const fallback = availableValues.includes(DEFAULT_TARGET) ? DEFAULT_TARGET : availableValues[0]
  return fallback ? [fallback] : []
}

// Split target flags into `unknown` (not registered) and `unavailable`
// (registered but missing required config in this checkout) so the entry point
// rejects each with a clear message.
export function classifyTargetFlags(targetFlags = [], availableValues = TARGET_VALUES) {
  const known = new Set(TARGET_VALUES)
  const available = new Set(availableValues)
  return {
    unknown: targetFlags.filter(value => !known.has(value)),
    unavailable: targetFlags.filter(value => known.has(value) && !available.has(value)),
  }
}

// Target values a selected plugin can link on demand (the Vercel link step is a
// plugin). A target without such a plugin cannot be linked from an unlinked
// checkout, so an interactive run must not imply it.
export function linkableTargetValues(plugins = []) {
  return [
    ...new Set(
      plugins
        .filter(plugin => plugin.providesLink)
        .map(plugin => plugin.target)
        .filter(Boolean),
    ),
  ]
}

// Resolve one or more raw `--target` values (repeatable, comma-separated, or
// `all`) into the running selection; `all` expands against the available
// targets while an explicit unavailable value is kept for the caller to reject.
export function resolveTargetFlags(raws = [], availableValues = TARGET_VALUES) {
  let flags = []
  for (const raw of raws) {
    flags = expandTargetFlag({ raw, selected: flags, availableValues })
  }
  return flags
}

// Rejection text for `--target` values that are registered but not deployable
// in this checkout, naming the missing config per target.
export function describeUnavailableTargets(values = [], availability = []) {
  const detail = values
    .map(value => {
      const entry = availability.find(item => item.value === value)
      return `${value} (${(entry?.missing ?? []).join('; ')})`
    })
    .join(', ')
  return `Target not deployable from this checkout: ${detail}. Set the listed config and retry.`
}

// Rejection text for a checkout where no registered target has its config.
export function describeNoAvailableTargets(availability = []) {
  const detail = availability.map(entry => `${entry.value} needs ${entry.missing.join('; ')}`).join('; ')
  return `No deploy target is available from this checkout: ${detail}.`
}

// Resolve raw `--target` values into the running selection against this
// checkout's availability, throwing for an unknown or unavailable target so the
// entry point fails before any deploy CLI runs.
export function resolveRunTargets({ raws = [], availableValues = TARGET_VALUES, availability = [] } = {}) {
  const flags = resolveTargetFlags(raws, availableValues)
  const { unknown, unavailable } = classifyTargetFlags(flags, availableValues)
  if (unknown.length > 0) {
    throw new Error(`Unknown target: ${unknown.join(', ')} (expected ${TARGET_VALUES.join('|')} or all).`)
  }
  if (unavailable.length > 0) {
    throw new Error(describeUnavailableTargets(unavailable, availability))
  }
  return flags
}

// Plan the run's target selection from the raw flags and this checkout's
// availability: the resolved flags, the deployable values, and the TARGETS
// entries the interview may offer. Rejects an explicit unknown/unavailable
// target first (its message is specific), then a checkout with no deployable
// target at all.
export function planTargetSelection({ raws = [], availability = [] } = {}) {
  const availableValues = availability.filter(entry => entry.available).map(entry => entry.value)
  const flags = resolveRunTargets({ raws, availableValues, availability })
  if (availableValues.length === 0) {
    throw new Error(describeNoAvailableTargets(availability))
  }
  return { flags, availableValues, entries: TARGETS.filter(entry => availableValues.includes(entry.value)) }
}
