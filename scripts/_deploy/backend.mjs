#!/usr/bin/env node
// _deploy/backend.mjs — the app's database backend at deploy time, resolved
// from configuration rather than from the deployment target. A configured D1
// database (`CLOUDFLARE_D1_DATABASE`) selects D1; everything else selects Neon.
// D1 is a Cloudflare binding, so only the Cloudflare target can host it — every
// other target reaches the app's Neon database. The app's runtime backend
// selector resolves the same two from the live binding, so the deploy flow and
// the running app cannot drift.
import { resolveD1DatabaseName } from '../lib/cloudflare.mjs'

// Resolve the backend for a target from the supplied env. The env config picks
// the backend; `target` only bounds what is hostable (D1 needs a Cloudflare
// binding), so every non-Cloudflare target resolves to Neon.
export function resolveDeployBackend(target, env = {}) {
  return target === 'cloudflare' && resolveD1DatabaseName(env) ? 'd1' : 'neon'
}

// Plan every selected target's backend, plus whether the shared Neon schema must
// run for any of them. `envForTarget(target)` supplies each target's merged env;
// the caller owns the file access so this stays pure and testable.
export function planDeployBackends(targets = [], envForTarget = () => ({})) {
  const backends = new Map(targets.map(target => [target, resolveDeployBackend(target, envForTarget(target))]))
  const needsNeonSchema = targets.some(target => backends.get(target) === 'neon')
  return { backends, needsNeonSchema }
}
