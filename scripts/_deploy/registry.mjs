#!/usr/bin/env node
// _deploy/registry.mjs — deploy target registry shared by the entry point and
// the interview. Plugin capability selection lives in the project's
// `deploy.config.mjs`; targets are always available.

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

export const TARGETS = [
  { value: 'vercel', description: 'Deploy the app to Vercel' },
  {
    value: 'cloudflare',
    description: 'Deploy the app to Cloudflare Pages (D1 backend when CLOUDFLARE_D1_DATABASE is set, otherwise Neon)',
  },
]

// Vercel stays the default target so existing invocations behave as before.
export const DEFAULT_TARGET = 'vercel'

// Expand one `--target` value into the running selection: `all` fans out to
// every registered target, comma-separated values are split, and duplicates
// are dropped. Order follows registration.
export function expandTargetFlag(raw, selected = []) {
  const next = [...selected]
  for (const part of String(raw || '')
    .split(',')
    .map(piece => piece.trim().toLowerCase())
    .filter(Boolean)) {
    if (part === 'all') {
      for (const entry of TARGETS) {
        if (!next.includes(entry.value)) {
          next.push(entry.value)
        }
      }
    } else if (!next.includes(part)) {
      next.push(part)
    }
  }
  return next
}
