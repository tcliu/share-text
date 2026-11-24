#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs'

// Keys that are local tooling config and must never be synced to a deploy
// target: VERCEL_PROJECT is the CLI link slug (deploy.mjs only),
// CLOUDFLARE_PROJECT owns the Worker name (generator input only),
// APP_BASE_URL is read by local scripts only (deploy domain sync, heartbeat
// job URL) — no server module reads any of them at runtime.
export const LOCAL_ONLY_ENV_KEYS = new Set(['APP_BASE_URL', 'VERCEL_PROJECT', 'CLOUDFLARE_PROJECT'])

// Dependency-free dotenv parser shared by CLI scripts. db-config.mjs pulls in
// the Neon driver at import time, which deploy-only scripts must not pay for.
export function parseEnvFile(filePath) {
  if (!existsSync(filePath)) return {}

  const values = {}
  const content = readFileSync(filePath, 'utf8')

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    // A shell-style `export FOO=bar` is valid dotenv syntax; the prefix is
    // syntax, not part of the key, so a key would otherwise be stored as
    // "export FOO" and synced under a name no server reads.
    const assignment = trimmed.startsWith('export ') ? trimmed.slice('export '.length).trim() : trimmed
    const separatorIndex = assignment.indexOf('=')
    if (separatorIndex === -1) continue
    const key = assignment.slice(0, separatorIndex).trim()
    if (!key) continue
    let value = assignment.slice(separatorIndex + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    values[key] = value
  }

  return values
}

// Parse a JSON file, returning `fallback` only when it is missing. A file that
// is present but malformed stops the run with the path and the parser message:
// silently degrading to "no data" turns a typo'd `package.json` or
// `.vercel/project.json` into a misleading "not linked" state.
export function readJsonFile(filePath, fallback = null) {
  let content
  try {
    content = readFileSync(filePath, 'utf8')
  } catch (error) {
    if (error?.code === 'ENOENT') return fallback
    throw error
  }
  try {
    return JSON.parse(content)
  } catch (error) {
    throw new Error(`Invalid JSON in ${filePath}: ${error.message}`)
  }
}
