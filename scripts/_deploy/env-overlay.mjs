#!/usr/bin/env node
// _deploy/env-overlay.mjs — persist a single key into a gitignored env overlay
// file (line-preserving upsert), logging the save. Shared by the Vercel link
// prompt and the domain-conflict retry.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { parseEnvFile } from '../env-file.mjs'
import { logEvent } from '../log-event.mjs'
import { upsertEnvLine } from '../vercel-project.mjs'

export function persistEnvValue(file, label, key, value) {
  let current = ''
  try {
    current = String(parseEnvFile(file)[key] || '').trim()
  } catch {
    current = ''
  }
  if (current === value) {
    return
  }
  let content = ''
  try {
    content = existsSync(file) ? readFileSync(file, 'utf8') : ''
  } catch {
    content = ''
  }
  writeFileSync(file, upsertEnvLine(content, key, value))
  logEvent({ action: 'env_saved', details: { key, label } })
}
