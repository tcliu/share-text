#!/usr/bin/env node
// Worker secret state through wrangler: list the deployed secret names, then
// diff them against the desired set. Secret values are write-only, so only
// existence can be compared (that is why `--secrets=always` stays the default).
// Plain `[vars]` need no remote read: `wrangler deploy` replaces all vars with
// the generated `[vars]`, so omitting a key deletes it.
//
// The runner is injectable so unit tests never touch the network.
import { defaultWranglerRunner } from './cloudflare.mjs'

// Parses `wrangler secret list --format json`; null when the output is not a
// JSON array (the caller treats that as "remote state unavailable").
export function parseWorkerSecretList(output) {
  try {
    const parsed = JSON.parse(String(output || ''))
    if (!Array.isArray(parsed)) {
      return null
    }
    return parsed.map(entry => String(entry?.name || '').trim()).filter(Boolean)
  } catch {
    return null
  }
}

// Deployed secret names for `worker`, or null when the Worker is missing (first
// deploy) or the read failed. Never throws: a missing Worker is a normal state
// before the first deploy, and the caller falls back to a full write.
export function readWorkerSecretNames({ worker, runner = defaultWranglerRunner, cwd = process.cwd() } = {}) {
  const result = runner(['secret', 'list', '--name', worker, '--format', 'json'], { cwd, capture: true })
  if (result.status !== 0) {
    return null
  }
  return parseWorkerSecretList(result.output)
}

// Secret drift by name only.
export function diffDesiredSecrets(desiredSecrets = {}, presentNames = []) {
  const present = new Set(presentNames)
  const missing = []
  const existing = []
  for (const key of Object.keys(desiredSecrets)) {
    if (present.has(key)) {
      existing.push(key)
    } else {
      missing.push(key)
    }
  }
  return { missing, present: existing }
}

// Deployed secret names absent from the desired universe. Prune candidates;
// the caller decides whether to delete them (opt-in, like the Vercel sync).
export function findOrphanSecrets(presentNames = [], desiredKeys = []) {
  const wanted = new Set(desiredKeys)
  return presentNames.filter(name => !wanted.has(name))
}
