#!/usr/bin/env node
// Unified per-target env helpers. `loadTargetEnv` is the full resolution order
// everywhere: `.env` < `.env.local` < `.env.prod` < overlay < shell, with
// `.env.local` carrying operator-only keys (tokens, CRONJOB_API_KEY) that are
// never synced and shell always winning. `loadTargetEnvFiles` is that order
// without the shell (for callers that must not let an empty shell value mask a
// file value) and `loadTargetOperatorEnv` is the operator layer alone
// (`.env.local` overlaid by the shell). `targetSourceFiles`/`loadTargetFileEnv`
// are the narrower push universe — the files a target's env sync actually
// pushes (Vercel: `.env.vercel`; Cloudflare: `.env.prod` + its overlay), shared
// by the deploy preflight and both env-sync scripts. The remaining read-only
// tooling loaders (`db-config.mjs`, `vercel.mjs`) keep their own Vercel-scoped
// merges.
import { join } from 'node:path'
import { parseEnvFile } from '../env-file.mjs'
import { ROOT as DEFAULT_ROOT } from './root.mjs'

export const TARGET_OVERLAYS = {
  vercel: '.env.vercel',
  cloudflare: '.env.cloudflare',
}

// File-only resolution layers (`loadTargetEnv` without the shell): `.env` <
// `.env.local` < `.env.prod` < overlay. Kept separate so a caller that must not
// let an empty shell value mask a file value reads the same order.
export function loadTargetEnvFiles(target = 'vercel', root = DEFAULT_ROOT) {
  return {
    ...parseEnvFile(join(root, '.env')),
    ...parseEnvFile(join(root, '.env.local')),
    ...parseEnvFile(join(root, '.env.prod')),
    ...parseEnvFile(join(root, targetOverlayFile(target))),
  }
}

// Merged env for a target: the file layers overlaid by the shell. `root` is
// injectable so tests can point at a fixture dir; production callers omit it.
export function loadTargetEnv(target = 'vercel', root = DEFAULT_ROOT) {
  return { ...loadTargetEnvFiles(target, root), ...process.env }
}

// Operator layer: `.env.local` overlaid by the shell. Never synced; carries the
// tokens/credentials the deploy preflight validates and the targets seed from.
export function loadTargetOperatorEnv(root = DEFAULT_ROOT) {
  return { ...parseEnvFile(join(root, '.env.local')), ...process.env }
}

// Files-only merge of the target's push universe (`targetSourceFiles`). `.env`
// and `.env.local` are deliberately excluded — they hold local/operator keys
// (dev overrides, tokens) that must never be pushed to a target. Shell never
// invents synced keys either.
export function loadTargetFileEnv(target = 'vercel', root = DEFAULT_ROOT) {
  const merged = {}
  for (const file of targetSourceFiles(target)) {
    Object.assign(merged, parseEnvFile(join(root, file)))
  }
  return merged
}

// Overlay filename for a target (heartbeat + sync scripts).
export function targetOverlayFile(target = 'vercel') {
  return TARGET_OVERLAYS[target] || TARGET_OVERLAYS.vercel
}

// Files a target's env sync pushes to its remote env, in merge order, so the
// deploy preflight and the per-target sync scripts share one list. Vercel
// pushes only `.env.vercel`; Cloudflare pushes `.env.prod` overlaid by its
// target file. Unknown targets fall back to the Vercel overlay.
export function targetSourceFiles(target = 'vercel') {
  if (target === 'vercel') {
    return [TARGET_OVERLAYS.vercel]
  }
  return ['.env.prod', targetOverlayFile(target)]
}

export function targetSourceLabel(target = 'vercel') {
  return targetSourceFiles(target).join(' + ')
}

// Seeds the Cloudflare operator credentials into `process.env` from the
// caller's already-resolved layers: each key is written only when the shell has
// not set it and the resolved value is non-empty (shell values always win).
// Callers resolve different layers (deploy target, standalone sync, heartbeat),
// so each passes its own `token`/`accountId` maps and shares the write here.
export function seedCloudflareCredentials({ token = {}, accountId = {} } = {}) {
  for (const [key, source] of [
    ['CLOUDFLARE_API_TOKEN', token],
    ['CLOUDFLARE_ACCOUNT_ID', accountId],
  ]) {
    if (!process.env[key] && String(source[key] || '').trim()) {
      process.env[key] = String(source[key]).trim()
    }
  }
}
