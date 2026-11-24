#!/usr/bin/env node
// parity: app-owned — project deploy selection
// deploy.config.mjs — shared loader for this project's deploy capability
// selection. Base targets (vercel, cloudflare) are offered when their required
// config resolves at runtime; a plugin that is not selected is inert even
// though its module ships with the shared lib. `heartbeat` is intentionally
// absent: it activates only when CRONJOB_API_KEY is present.
//
// The module is identical in every app; the project-owned selection lives in
// `deploy.config.json` at the repo root, carrying the `plugins` and
// `requiredEnv` values `deploy.mjs` reads. When that file is absent, `plugins`
// is left undefined (the registry falls back to the full default set) and
// `requiredEnv` to `{}`.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { ROOT } from './lib/root.mjs'

const CONFIG_PATH = join(ROOT, 'deploy.config.json')

function loadConfig() {
  if (!existsSync(CONFIG_PATH)) return {}
  let parsed
  try {
    parsed = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'))
  } catch (error) {
    throw new Error(`Invalid deploy config ${CONFIG_PATH}: ${error.message}`)
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`Invalid deploy config ${CONFIG_PATH}: expected a JSON object`)
  }
  return parsed
}

const config = loadConfig()

export const plugins = config.plugins
export const requiredEnv = config.requiredEnv
// Credential key names this app must push to the secret store rather than a
// plaintext [vars] entry. App-specific names live in `deploy.config.json` so
// this module stays identical across apps.
export const secretKeys = config.secretKeys
// Deployment Protection for the production aliases (`public`, `preview`, or
// `all`); absent leaves the dashboard setting untouched.
export const vercelProtection = config.vercelProtection
